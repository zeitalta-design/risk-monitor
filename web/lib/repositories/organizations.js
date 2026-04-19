/**
 * organizations 一覧 / 単発検索用のリポジトリ。
 * Cross-domain 企業ハブ（/organizations）向けの薄い API が使う。
 *
 * ポリシー:
 *   - 一覧には「件数バッジ」だけ載せる（詳細集計・ダッシュボードは禁止）
 *   - ドメイン別 COUNT は page 単位で 1 クエリに UNION ALL で統合（Turso ラウンドトリップ削減）
 *   - fuzzy / LLM は使わない
 */
import { getDb } from "@/lib/db";

// 全件 COUNT(*) の簡易 memory cache（60秒 TTL）
// 無フィルタ・onlyCorp 両パターンのみ対象。検索条件つきは都度 COUNT。
const TOTAL_CACHE_TTL_MS = 60_000;
const _totalCache = new Map(); // key: "all" | "onlyCorp" -> { at, n }

function getCachedTotal(key, sqlRunner) {
  const now = Date.now();
  const hit = _totalCache.get(key);
  if (hit && now - hit.at < TOTAL_CACHE_TTL_MS) return hit.n;
  const n = sqlRunner();
  _totalCache.set(key, { at: now, n });
  return n;
}

/**
 * @param {Object} opts
 * @param {string} [opts.keyword]   - 表示名 / 正規化名 LIKE
 * @param {string} [opts.corp]      - corporate_number 完全一致
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=20]
 * @param {boolean}[opts.onlyCorp]  - corporate_number ありだけに絞る
 * @param {"newest"|"linked"} [opts.sort="newest"]
 *   - newest: id DESC（= 実質 created_at DESC、ただし PK index が使える）
 *   - linked: corp ありを優先 → id DESC（99.8% の企業は entity_links あり = 実質「件数あり優先」。
 *              EXISTS より index 効率が良い近似）
 * @returns {{
 *   items: Array<{
 *     id: number, display_name: string|null, normalized_name: string|null,
 *     corporate_number: string|null, prefecture: string|null, city: string|null,
 *     source: string|null,
 *     counts: { nyusatsu: number, hojokin: number, kyoninka: number,
 *               gyosei_shobun: number, sanpai: number },
 *     primary_entity_id: number|null
 *         - entity_links で紐づく resolved_entities.id のうち最大 confidence のもの。
 *           Deal Score 系エンドポイントに渡す entityId として使用可能。未接続は null。
 *   }>,
 *   total: number, page: number, pageSize: number, totalPages: number
 * }}
 */
export function listOrganizations({
  keyword = "",
  corp = "",
  page = 1,
  pageSize = 20,
  onlyCorp = false,
  sort = "newest",
} = {}) {
  const db = getDb();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

  const where = ["o.is_active = 1"];
  const params = {};
  if (corp) {
    where.push("o.corporate_number = @corp");
    params.corp = String(corp).trim();
  } else if (keyword) {
    where.push("(o.display_name LIKE @kw OR o.normalized_name LIKE @kw OR o.corporate_number = @corpExact)");
    params.kw = `%${String(keyword).trim()}%`;
    params.corpExact = String(keyword).trim();
  }
  if (onlyCorp) {
    where.push("o.corporate_number IS NOT NULL AND o.corporate_number != ''");
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  // ─── 全件 COUNT(*) ───────────────────────────────────────────────
  // 無フィルタ（keyword も corp も無し）時は memory cache で Turso ラウンドトリップ削減。
  const noUserFilter = !keyword && !corp;
  let total;
  if (noUserFilter) {
    const cacheKey = onlyCorp ? "onlyCorp" : "all";
    total = getCachedTotal(cacheKey,
      () => db.prepare(`SELECT COUNT(*) n FROM organizations o ${whereSql}`).get(params)?.n || 0);
  } else {
    total = db.prepare(`SELECT COUNT(*) n FROM organizations o ${whereSql}`).get(params)?.n || 0;
  }
  const totalPages = Math.max(1, Math.ceil(total / ps));

  // ─── 行取得 ──────────────────────────────────────────────────────
  // ORDER BY は index が効くものに限定する:
  //   - "newest": o.id DESC（PRIMARY KEY の逆順スキャン、最速）
  //   - "linked": entity_links に存在する企業を先に、次に id DESC
  // created_at DESC は idx 無しで 22k 行フルソートになるため廃止。
  let orderSql;
  if (sort === "linked") {
    // 「件数あり」を厳密判定すると 22k 行全件に EXISTS/JOIN が必要で重い。
    // 実データでは corp 持ち ≒ entity_links 持ち（接続率 99.8%）なので
    // corp の有無で近似する。CASE 式自体は軽量、id DESC と合わせて
    // 既存 index の範囲で処理できる。
    orderSql = `
      ORDER BY
        CASE WHEN o.corporate_number IS NULL OR o.corporate_number = '' THEN 1 ELSE 0 END,
        o.id DESC
    `;
  } else {
    orderSql = `ORDER BY o.id DESC`;
  }

  const rows = db.prepare(`
    SELECT o.id, o.display_name, o.normalized_name, o.corporate_number,
           o.prefecture, o.city, o.source
    FROM organizations o
    ${whereSql}
    ${orderSql}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: ps, offset: (p - 1) * ps });

  if (rows.length === 0) {
    return { items: [], total, page: p, pageSize: ps, totalPages };
  }

  // ─── 件数バッジ: UNION ALL で 1 クエリ（Turso ラウンドトリップ 5→1） ──
  // nyusatsu / sanpai は corporate_number 経由、他は organization_id 経由。
  // 集約キーが異なるため「o_id」と「corp」両方のカラムを用意して UNION ALL。
  const orgIds = rows.map((r) => r.id);
  const corps = rows.map((r) => r.corporate_number).filter(Boolean);
  const orgIn = `(${orgIds.map(() => "?").join(",")})`;
  const corpIn = corps.length > 0 ? `(${corps.map(() => "?").join(",")})` : null;

  const counts = Object.fromEntries(orgIds.map((id) => [id, {
    nyusatsu: 0, hojokin: 0, kyoninka: 0, gyosei_shobun: 0, sanpai: 0,
  }]));
  const corpToOrg = new Map();
  for (const r of rows) { if (r.corporate_number) corpToOrg.set(r.corporate_number, r.id); }

  // orgId ベース（hojokin / kyoninka / gyosei_shobun）
  const parts = [
    `SELECT 'hojokin' AS d, organization_id AS oid, NULL AS corp, COUNT(*) AS n
       FROM hojokin_items WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
    `SELECT 'kyoninka' AS d, organization_id AS oid, NULL AS corp, COUNT(*) AS n
       FROM kyoninka_entities WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
    `SELECT 'gyosei_shobun' AS d, organization_id AS oid, NULL AS corp, COUNT(*) AS n
       FROM administrative_actions WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
  ];
  const args = [...orgIds, ...orgIds, ...orgIds];

  // corp ベース（nyusatsu / sanpai）— corps が空だと IN () がエラーになるのでガード
  if (corpIn) {
    parts.push(
      `SELECT 'nyusatsu' AS d, NULL AS oid, winner_corporate_number AS corp, COUNT(*) AS n
         FROM nyusatsu_results WHERE winner_corporate_number IN ${corpIn} AND is_published = 1 GROUP BY winner_corporate_number`,
      `SELECT 'sanpai' AS d, NULL AS oid, corporate_number AS corp, COUNT(*) AS n
         FROM sanpai_items WHERE corporate_number IN ${corpIn} AND is_published = 1 GROUP BY corporate_number`,
    );
    args.push(...corps, ...corps);
  }

  const rows2 = db.prepare(parts.join(" UNION ALL ")).all(...args);
  for (const r of rows2) {
    let oid = r.oid;
    if (oid == null && r.corp) oid = corpToOrg.get(r.corp);
    if (oid != null && counts[oid]) counts[oid][r.d] = r.n;
  }

  // ─── entity_links → primary_entity_id（最大 confidence）を 1 クエリで取得 ──
  // Phase J-4: /organizations → /nyusatsu?entityId=X の導線に使う。
  //   corp 一致ではなく resolver を通った entity_id を使うため safety。
  const primaryEntityByOrg = new Map();
  try {
    const linkRows = db.prepare(`
      SELECT organization_id, resolved_entity_id, confidence
      FROM entity_links
      WHERE organization_id IN ${orgIn}
    `).all(...orgIds);
    for (const l of linkRows) {
      const cur = primaryEntityByOrg.get(l.organization_id);
      const c = Number.isFinite(l.confidence) ? l.confidence : 0;
      if (!cur || c > cur.confidence) {
        primaryEntityByOrg.set(l.organization_id, {
          entity_id: l.resolved_entity_id,
          confidence: c,
        });
      }
    }
  } catch {
    // entity_links 未作成 / 読み取り失敗は「接続なし」扱い（導線非表示）
  }

  const items = rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    normalized_name: r.normalized_name,
    corporate_number: r.corporate_number,
    prefecture: r.prefecture,
    city: r.city,
    source: r.source,
    counts: counts[r.id],
    primary_entity_id: primaryEntityByOrg.get(r.id)?.entity_id ?? null,
  }));

  return { items, total, page: p, pageSize: ps, totalPages };
}
