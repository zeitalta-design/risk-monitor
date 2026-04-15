/**
 * 許認可（kyoninka）取得ロジック
 *
 * リスクモニターの文脈に合わせ、行政処分を受けた企業を起点として
 * gBizINFO から許認可・届出認定情報を取得する。
 *
 * フロー:
 *   1. administrative_actions から対象企業を取得（未解決の法人優先）
 *   2. organizations.corporate_number が無ければ gBizINFO の法人名検索で解決
 *   3. certification エンドポイントで許認可情報を取得
 *   4. kyoninka_entities / kyoninka_registrations に upsert
 *
 * Vercel Hobby の10秒制限では回り切らないため、CLI / GitHub Actions で実行。
 */
import { getDb } from "@/lib/db";
import {
  getHojin,
  getCertification,
  searchByName,
  normalizeCertification,
} from "@/lib/gbizinfo-client";
import { normalizeEntityName } from "@/lib/kyoninka-config";

const DEFAULT_LIMIT = 50;
const DELAY_MS = 700; // gBizINFO のrate limit考慮

/**
 * 行政処分対象企業を起点に許認可情報を取得し DB に upsert する
 *
 * @param {object} opts
 * @param {number} [opts.limit=50] 1回に処理する企業数
 * @param {boolean} [opts.onlyMissing=true] corporate_number 未解決の企業のみ対象
 * @param {boolean} [opts.dryRun=false]
 * @param {function} [opts.logger]
 * @returns {Promise<{ok,processed,resolved,certFetched,created,updated,errors,elapsed}>}
 */
export async function fetchAndUpsertKyoninka({
  limit = DEFAULT_LIMIT,
  onlyMissing = true,
  dryRun = false,
  logger = console.log,
} = {}) {
  const db = getDb();
  const startTime = Date.now();
  const log = (msg) => logger(`[kyoninka-fetcher] ${msg}`);

  let processed = 0;
  let resolved = 0; // gBizINFOで法人番号解決できた数
  let certFetched = 0; // certification取得成功数
  let created = 0;
  let updated = 0;
  const errors = [];

  // 対象企業を取得: administrative_actions × organizations の JOIN
  // organizations 経由で corporate_number を持つ/持たない企業を取れる
  const query = onlyMissing
    ? `
      SELECT DISTINCT
        a.organization_name_raw AS name_raw,
        a.prefecture AS prefecture,
        a.industry AS industry,
        o.id AS org_id,
        o.corporate_number AS corporate_number,
        o.display_name AS display_name
      FROM administrative_actions a
      LEFT JOIN organizations o ON o.id = a.organization_id
      WHERE a.is_published = 1
        AND (o.corporate_number IS NULL OR o.corporate_number = '')
      ORDER BY a.action_date DESC
      LIMIT ?
    `
    : `
      SELECT DISTINCT
        a.organization_name_raw AS name_raw,
        a.prefecture AS prefecture,
        a.industry AS industry,
        o.id AS org_id,
        o.corporate_number AS corporate_number,
        o.display_name AS display_name
      FROM administrative_actions a
      LEFT JOIN organizations o ON o.id = a.organization_id
      WHERE a.is_published = 1
      ORDER BY a.action_date DESC
      LIMIT ?
    `;

  const targets = db.prepare(query).all(limit);
  log(`Start: ${targets.length} targets, dryRun=${dryRun}, onlyMissing=${onlyMissing}`);

  for (const row of targets) {
    processed++;
    const displayName = row.display_name || row.name_raw;
    let corporateNumber = row.corporate_number;

    try {
      // 法人番号が未解決なら gBizINFO 名前検索で解決
      if (!corporateNumber) {
        await sleep(DELAY_MS);
        const hits = await searchByName(displayName, { limit: 3 });
        const best = pickBestMatch(hits, displayName, row.prefecture);
        if (!best) {
          log(`  ✗ ${displayName}: gBizINFO で法人番号解決できず`);
          continue;
        }
        corporateNumber = best.corporate_number;
        resolved++;
        log(`  → ${displayName}: 解決 ${corporateNumber} (${best.name})`);

        if (!dryRun) {
          upsertOrganizationCorporateNumber(db, row, corporateNumber, best);
        }
      }

      // certification 取得
      await sleep(DELAY_MS);
      const certs = await getCertification(corporateNumber);
      certFetched++;

      if (certs.length === 0) {
        log(`  - ${displayName}: 許認可情報なし`);
        continue;
      }

      if (!dryRun) {
        const r = upsertKyoninkaForCorporate(db, {
          corporateNumber,
          displayName,
          row,
          certs,
        });
        created += r.created;
        updated += r.updated;
        log(`  ✓ ${displayName}: ${certs.length}件の許認可 (+${r.created} / ~${r.updated})`);
      } else {
        log(`  (dry) ${displayName}: ${certs.length}件の許認可`);
      }
    } catch (e) {
      const detail = e.status ? `HTTP ${e.status} ${e.url || ""}` : e.message;
      errors.push(`${displayName}: ${detail}`);
      log(`  ! ${displayName}: ${detail}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // sync_runs記録
  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, error_summary, started_at, finished_at)
        VALUES ('kyoninka', 'scheduled', 'completed', ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(certFetched, created, updated, errors.length > 0 ? errors.slice(0, 3).join(" | ") : null);
    } catch {
      /* ignore */
    }
  }

  log(`Done: processed=${processed} resolved=${resolved} certFetched=${certFetched} created=${created} updated=${updated} (${elapsed}s)`);

  return {
    ok: true,
    processed,
    resolved,
    certFetched,
    created,
    updated,
    errors,
    elapsed,
  };
}

/** gBizINFO 検索結果から最適なものを1つ選ぶ（名前+都道府県で近い順） */
function pickBestMatch(hits, queryName, queryPref) {
  if (!hits || hits.length === 0) return null;
  const queryNorm = normalizeEntityName(queryName);

  // 完全一致を最優先
  const exact = hits.find((h) => normalizeEntityName(h.name) === queryNorm);
  if (exact) return exact;

  // 都道府県一致
  if (queryPref) {
    const sameP = hits.find((h) => (h.prefecture_name || h.location || "").includes(queryPref));
    if (sameP) return sameP;
  }

  // 先頭のヒット（gBizINFOの関連度順）
  return hits[0];
}

function upsertOrganizationCorporateNumber(db, row, corporateNumber, hojinInfo) {
  if (row.org_id) {
    // 既存organizationを更新
    db.prepare(`
      UPDATE organizations
      SET corporate_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(corporateNumber, row.org_id);
  } else {
    // 新規organization作成
    const normalized = normalizeEntityName(row.name_raw);
    db.prepare(`
      INSERT INTO organizations
        (normalized_name, display_name, corporate_number, prefecture, city, address, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(
      normalized,
      hojinInfo?.name || row.name_raw,
      corporateNumber,
      row.prefecture || null,
      hojinInfo?.location?.city || null,
      hojinInfo?.location?.street_number || hojinInfo?.location || null
    );
  }
}

function upsertKyoninkaForCorporate(db, { corporateNumber, displayName, row, certs }) {
  // kyoninka_entities を upsert
  const slug = `gbiz-${corporateNumber}`;
  const normalizedName = normalizeEntityName(displayName);

  const existing = db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ? OR corporate_number = ?").get(slug, corporateNumber);

  let entityId;
  if (existing) {
    entityId = existing.id;
    db.prepare(`
      UPDATE kyoninka_entities
      SET entity_name = ?, normalized_name = ?, corporate_number = ?,
          prefecture = COALESCE(prefecture, ?),
          registration_count = ?,
          latest_update_date = date('now'),
          source_name = 'gBizINFO',
          source_url = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      displayName.slice(0, 100),
      normalizedName,
      corporateNumber,
      row.prefecture || null,
      certs.length,
      `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`,
      entityId
    );
  } else {
    const primaryFamily = inferPrimaryFamily(certs);
    const info = db.prepare(`
      INSERT INTO kyoninka_entities
        (slug, entity_name, normalized_name, corporate_number, prefecture,
         entity_status, primary_license_family, registration_count,
         latest_update_date, source_name, source_url,
         is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, date('now'), 'gBizINFO', ?, 1, datetime('now'), datetime('now'))
    `).run(
      slug,
      displayName.slice(0, 100),
      normalizedName,
      corporateNumber,
      row.prefecture || null,
      primaryFamily,
      certs.length,
      `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`
    );
    entityId = Number(info.lastInsertRowid);
  }

  // 既存 registrations を一旦削除して入れ直す（シンプルな戦略）
  db.prepare("DELETE FROM kyoninka_registrations WHERE entity_id = ?").run(entityId);

  let created = 0;
  const insertStmt = db.prepare(`
    INSERT INTO kyoninka_registrations
      (entity_id, license_family, license_type, registration_number,
       authority_name, prefecture, valid_from, valid_to, registration_status,
       source_name, source_url, detail_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (const cert of certs) {
    const n = normalizeCertification(cert, { corporateNumber });
    try {
      insertStmt.run(
        entityId,
        n.license_family,
        n.license_type,
        n.registration_number,
        n.authority_name,
        row.prefecture || null,
        n.valid_from,
        n.valid_to,
        n.registration_status,
        n.source_name,
        n.source_url,
        n.detail_url
      );
      created++;
    } catch {
      /* ignore */
    }
  }

  return { created, updated: existing ? 1 : 0 };
}

function inferPrimaryFamily(certs) {
  const counts = {};
  for (const c of certs) {
    const { license_family } = normalizeCertification(c);
    counts[license_family] = (counts[license_family] || 0) + 1;
  }
  let best = "other";
  let max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * トークン不要なドライランヘルパー: 対象候補だけをログに出す
 */
export function previewTargets({ limit = 50, onlyMissing = true } = {}) {
  const db = getDb();
  const query = onlyMissing
    ? `
      SELECT a.organization_name_raw AS name_raw, a.prefecture, a.industry,
             o.corporate_number, o.display_name
      FROM administrative_actions a
      LEFT JOIN organizations o ON o.id = a.organization_id
      WHERE a.is_published = 1 AND (o.corporate_number IS NULL OR o.corporate_number = '')
      GROUP BY a.organization_name_raw
      ORDER BY MAX(a.action_date) DESC
      LIMIT ?
    `
    : `
      SELECT a.organization_name_raw AS name_raw, a.prefecture, a.industry,
             o.corporate_number, o.display_name
      FROM administrative_actions a
      LEFT JOIN organizations o ON o.id = a.organization_id
      WHERE a.is_published = 1
      GROUP BY a.organization_name_raw
      ORDER BY MAX(a.action_date) DESC
      LIMIT ?
    `;
  return db.prepare(query).all(limit);
}
