/**
 * Analyzer: 落札ランキング
 *
 * 集計軸:
 *   - entity   : resolved_entities.id 単位（表記ゆれ統合）
 *   - cluster  : entity_clusters.id 単位（グループ束）
 *   - issuer   : 発注機関名単位（まだ正規化されていない）
 *
 * 指標:
 *   - count  : 落札件数
 *   - amount : 落札金額合計
 */
import { RESOLVED_RESULTS_SQL, buildFilters } from "./resolved.js";

/**
 * @param {object} opts
 * @param {object} opts.db                       better-sqlite3 互換 DB ハンドル
 * @param {"entity"|"cluster"|"issuer"} [opts.by="entity"]
 * @param {"count"|"amount"} [opts.metric="count"]
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.category]
 * @param {boolean} [opts.resolvedOnly=true]     entity 未解決を除外
 * @param {number} [opts.limit=20]
 * @returns {Array<{
 *   group_id:      (number|string|null),
 *   group_name:    (string|null),
 *   total_awards:  number,
 *   total_amount:  number,
 *   unique_buyers: number,
 *   active_months: number,
 *   first_award:   (string|null),
 *   last_award:    (string|null)
 * }>}
 */
export function getAwardRanking({
  db,
  by = "entity",
  metric = "count",
  dateFrom,
  dateTo,
  category,
  resolvedOnly = true,
  limit = 20,
} = {}) {
  if (!db) throw new TypeError("getAwardRanking: db is required");

  // issuer 軸の場合は resolver JOIN 結果を使うが entity_id は不要
  // entity/cluster 軸は resolved 前提なので resolvedOnly を強制
  const forcedResolvedOnly = by === "entity" || by === "cluster" ? true : resolvedOnly;
  const filters = buildFilters({
    dateFrom, dateTo, category,
    resolvedOnly: forcedResolvedOnly,
  });

  let groupIdExpr, groupNameExpr, groupNotNull;
  switch (by) {
    case "cluster":
      groupIdExpr   = "cluster_id";
      groupNameExpr = "cluster_name";
      groupNotNull  = "AND cluster_id IS NOT NULL";
      break;
    case "issuer":
      groupIdExpr   = "issuer_name";
      groupNameExpr = "issuer_name";
      groupNotNull  = "AND issuer_name IS NOT NULL AND issuer_name != ''";
      break;
    case "entity":
    default:
      groupIdExpr   = "entity_id";
      groupNameExpr = "entity_name";
      groupNotNull  = "AND entity_id IS NOT NULL";
      break;
  }

  const orderMetric = metric === "amount"
    ? "total_amount DESC, total_awards DESC"
    : "total_awards DESC, total_amount DESC";

  // filters.where は AWS CTE 側に挿入。groupNotNull も同様。
  const whereMerged = [filters.where.replace(/^WHERE\s+/, ""), groupNotNull.replace(/^AND\s+/, "")]
    .filter(Boolean)
    .join(" AND ");
  const whereClause = whereMerged ? `WHERE ${whereMerged}` : "";

  const sql = `
    SELECT
      ${groupIdExpr}                     AS group_id,
      MAX(${groupNameExpr})              AS group_name,
      COUNT(*)                           AS total_awards,
      COALESCE(SUM(award_amount), 0)     AS total_amount,
      CASE
        WHEN COUNT(*) > 0
          THEN CAST(COALESCE(SUM(award_amount), 0) AS REAL) / COUNT(*)
        ELSE 0
      END                                AS avg_amount,
      COUNT(DISTINCT issuer_name)        AS unique_buyers,
      MIN(award_date)                    AS first_award,
      MAX(award_date)                    AS last_award
    FROM (${RESOLVED_RESULTS_SQL})
    ${whereClause}
    GROUP BY ${groupIdExpr}
    ORDER BY ${orderMetric}
    LIMIT @limit
  `;

  const rows = db.prepare(sql).all({ ...filters.params, limit });
  // active_months を JS 側で計算（first/last の月差 + 1）
  return rows.map((r) => ({
    ...r,
    active_months: calcActiveMonths(r.first_award, r.last_award),
  }));
}

function calcActiveMonths(from, to) {
  if (!from || !to) return 0;
  const a = parseYm(from), b = parseYm(to);
  if (!a || !b) return 0;
  return (b.y - a.y) * 12 + (b.m - a.m) + 1;
}

function parseYm(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}
