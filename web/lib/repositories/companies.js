/**
 * 企業横断参照リポジトリ（Phase 2 Step D）
 *
 * 責務:
 *   corporate_number または normalized_name を受け取り、
 *   nyusatsu / hojokin / kyoninka / sanpai の関連 id 一覧を返す。
 *
 * 禁止:
 *   - 集計や統合ダッシュボード向け計算はしない（件数とidのみ）
 *   - fuzzy / LLM で自動接続しない（deterministic のみ）
 *   - organizations と resolved_entities を統合しない（entity_links 経由で参照）
 */
import { getDb } from "@/lib/db";

const CORPORATE_NUMBER_RE = /^\d{13}$/;

/**
 * key の種別推定。13 桁数字なら corporate_number、それ以外は normalized_name 扱い。
 * @param {string} key
 */
function detectKind(key) {
  if (!key) return null;
  return CORPORATE_NUMBER_RE.test(String(key).trim()) ? "corporate_number" : "normalized_name";
}

/**
 * organizations / resolved_entities のアンカーを解決。
 * corporate_number 経由で entity_links を引き合うことで両側を同時に特定する。
 *
 * @param {object} db
 * @param {{ kind: string, key: string }} q
 * @returns {{ organization_id: number|null, resolved_entity_id: number|null,
 *             corporate_number: string|null, canonical_name: string|null }}
 */
function resolveAnchors(db, { kind, key }) {
  if (kind === "corporate_number") {
    const org = db.prepare(
      "SELECT id, corporate_number, normalized_name FROM organizations WHERE corporate_number = ? LIMIT 1"
    ).get(key);
    const re = db.prepare(
      "SELECT id, corporate_number, canonical_name FROM resolved_entities WHERE corporate_number = ? LIMIT 1"
    ).get(key);
    return {
      organization_id: org?.id || null,
      resolved_entity_id: re?.id || null,
      corporate_number: key,
      canonical_name: re?.canonical_name || org?.normalized_name || null,
    };
  }

  // normalized_name
  const org = db.prepare(
    "SELECT id, corporate_number, normalized_name FROM organizations WHERE normalized_name = ? LIMIT 1"
  ).get(key);

  let resolved = null;
  if (org?.corporate_number) {
    resolved = db.prepare(
      "SELECT id, corporate_number, canonical_name FROM resolved_entities WHERE corporate_number = ? LIMIT 1"
    ).get(org.corporate_number);
  }
  if (!resolved) {
    // entity_links 経由（名前では引けないので、org → bridge → resolved）
    if (org?.id) {
      const link = db.prepare(
        "SELECT resolved_entity_id FROM entity_links WHERE organization_id = ? LIMIT 1"
      ).get(org.id);
      if (link?.resolved_entity_id) {
        resolved = db.prepare(
          "SELECT id, corporate_number, canonical_name FROM resolved_entities WHERE id = ? LIMIT 1"
        ).get(link.resolved_entity_id);
      }
    }
    // 名前一致 resolved（corporate_number が resolved だけに存在するケース）
    if (!resolved) {
      resolved = db.prepare(
        "SELECT id, corporate_number, canonical_name FROM resolved_entities WHERE normalized_key = ? LIMIT 1"
      ).get(key);
    }
  }

  return {
    organization_id: org?.id || null,
    resolved_entity_id: resolved?.id || null,
    corporate_number: org?.corporate_number || resolved?.corporate_number || null,
    canonical_name: resolved?.canonical_name || org?.normalized_name || null,
  };
}

/**
 * 企業横断参照のメインエントリ。件数 + 各ドメインの id 配列（最大 `limit` 件）を返す。
 *
 * @param {string} key
 * @param {{ limit?: number }} [opts]
 * @returns {{
 *   query: { key: string, kind: "corporate_number"|"normalized_name" },
 *   anchors: { organization_id: number|null, resolved_entity_id: number|null,
 *              corporate_number: string|null, canonical_name: string|null },
 *   nyusatsu: { results: { count: number, ids: number[] } },
 *   hojokin:  { items:   { count: number, ids: number[] } },
 *   kyoninka: { entities:{ count: number, ids: number[] } },
 *   sanpai:   { items:   { count: number, ids: number[] } },
 * }}
 */
export function getCompanyCrossDomain(key, { limit = 50 } = {}) {
  const kind = detectKind(key);
  if (!kind) {
    throw new TypeError("key is required");
  }
  const db = getDb();
  const anchors = resolveAnchors(db, { kind, key: String(key).trim() });

  const nResults = fetchNyusatsuResultsByAnchors(db, anchors, limit);
  const hItems = fetchHojokinItemsByAnchors(db, anchors, limit);
  const kEntities = fetchKyoninkaEntitiesByAnchors(db, anchors, limit);
  const sItems = fetchSanpaiItemsByAnchors(db, anchors, limit);

  return {
    query: { key: String(key).trim(), kind },
    anchors,
    nyusatsu: { results: nResults },
    hojokin: { items: hItems },
    kyoninka: { entities: kEntities },
    sanpai: { items: sItems },
  };
}

// ─── 各ドメイン lookup ──────────────────────

function fetchNyusatsuResultsByAnchors(db, anchors, limit) {
  // winner_corporate_number は resolved_entities.corporate_number と同値想定。
  // anchors.corporate_number を最優先で使う（resolved_entity も結局 corp で紐付く）。
  const corp = anchors.corporate_number;
  if (!corp) return { count: 0, ids: [] };
  const count = db.prepare(
    "SELECT COUNT(*) n FROM nyusatsu_results WHERE winner_corporate_number = ? AND is_published = 1"
  ).get(corp)?.n || 0;
  const ids = db.prepare(
    "SELECT id FROM nyusatsu_results WHERE winner_corporate_number = ? AND is_published = 1 ORDER BY award_date DESC LIMIT ?"
  ).all(corp, limit).map((r) => r.id);
  return { count, ids };
}

function fetchHojokinItemsByAnchors(db, anchors, limit) {
  const orgId = anchors.organization_id;
  if (!orgId) return { count: 0, ids: [] };
  const count = db.prepare(
    "SELECT COUNT(*) n FROM hojokin_items WHERE organization_id = ? AND is_published = 1"
  ).get(orgId)?.n || 0;
  const ids = db.prepare(
    "SELECT id FROM hojokin_items WHERE organization_id = ? AND is_published = 1 ORDER BY updated_at DESC LIMIT ?"
  ).all(orgId, limit).map((r) => r.id);
  return { count, ids };
}

function fetchKyoninkaEntitiesByAnchors(db, anchors, limit) {
  // kyoninka は organization_id が populate されているため、それを優先。
  // 落ちても corporate_number 一致にフォールバック。
  const orgId = anchors.organization_id;
  const corp = anchors.corporate_number;
  if (!orgId && !corp) return { count: 0, ids: [] };

  let where = "";
  const params = [];
  if (orgId) { where = "organization_id = ?"; params.push(orgId); }
  if (corp) {
    where = where
      ? `${where} OR corporate_number = ?`
      : "corporate_number = ?";
    params.push(corp);
  }

  const count = db.prepare(
    `SELECT COUNT(*) n FROM kyoninka_entities WHERE (${where}) AND is_published = 1`
  ).get(...params)?.n || 0;
  const ids = db.prepare(
    `SELECT id FROM kyoninka_entities WHERE (${where}) AND is_published = 1 ORDER BY updated_at DESC LIMIT ?`
  ).all(...params, limit).map((r) => r.id);
  return { count, ids };
}

function fetchSanpaiItemsByAnchors(db, anchors, limit) {
  // sanpai には organization_id カラムがまだ無いので corporate_number のみ。
  const corp = anchors.corporate_number;
  if (!corp) return { count: 0, ids: [] };
  const count = db.prepare(
    "SELECT COUNT(*) n FROM sanpai_items WHERE corporate_number = ? AND is_published = 1"
  ).get(corp)?.n || 0;
  const ids = db.prepare(
    "SELECT id FROM sanpai_items WHERE corporate_number = ? AND is_published = 1 ORDER BY updated_at DESC LIMIT ?"
  ).all(corp, limit).map((r) => r.id);
  return { count, ids };
}
