/**
 * Analyzer: 特定 entity 1件向けの詳細集計（最適化版）
 *
 * 背景:
 *   既存の getAwardTimeline / getBuyerRelations は RESOLVED_RESULTS_SQL を
 *   subquery として使い entity_id = ? で outer filter するため、298k 行を
 *   毎回スキャンしてしまう（derived column は push-down できない）。
 *
 * このモジュールは entity の corp_number と alias 一覧を先に取ってから、
 *   nyusatsu_results に対して
 *     winner_corporate_number = @corp  OR  winner_name IN (...aliases)
 *   を WHERE に直接書くことで、idx_nyusatsu_results_winner_corp と
 *   idx_nyusatsu_results_winner を両方使った低コストな検索にする。
 *
 * Phase 2 Priority 1: entity detail API 高速化のため導入。
 */

/**
 * entity 1件分の「関連 nyusatsu_results の基本 row」を返す軽量 fetcher。
 * 集計は呼び出し側で JS or SQL で行う。
 *
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.entityId
 * @returns {{
 *   entity: any|null,
 *   aliases: Array<{ raw_name: string, seen_count: number, first_seen: string, last_seen: string }>,
 *   aliasNames: string[],
 *   targetedWhere: string,     // SQL WHERE 句（nyusatsu_results エイリアス r 用）
 *   targetedParams: object,    // 上記 WHERE のバインドパラメータ
 * }}
 */
export function fetchEntityLookup({ db, entityId }) {
  if (!db) throw new TypeError("fetchEntityLookup: db is required");

  const entity = db.prepare(`
    SELECT e.*, c.canonical_name AS cluster_canonical_name,
           c.signal AS cluster_signal, c.size AS cluster_size
    FROM resolved_entities e
    LEFT JOIN entity_clusters c ON c.id = e.cluster_id
    WHERE e.id = ?
  `).get(entityId);

  if (!entity) {
    return { entity: null, aliases: [], aliasNames: [], targetedWhere: "", targetedParams: {} };
  }

  const aliases = db.prepare(`
    SELECT raw_name, seen_count, first_seen, last_seen
    FROM resolution_aliases
    WHERE entity_id = ?
    ORDER BY seen_count DESC, last_seen DESC
  `).all(entityId);

  const aliasNames = aliases.map((a) => a.raw_name).filter((n) => n && n !== "");

  // WHERE 句: corp OR alias_name。
  // libsql 互換層は @param 形式のみ対応なので IN (...) は展開して @a0 @a1... にする。
  const conds = [];
  const params = {};
  if (entity.corporate_number) {
    conds.push("r.winner_corporate_number = @corp");
    params.corp = entity.corporate_number;
  }
  if (aliasNames.length > 0) {
    const keys = aliasNames.map((_, i) => {
      const k = `alias${i}`;
      params[k] = aliasNames[i];
      return `@${k}`;
    });
    conds.push(`r.winner_name IN (${keys.join(",")})`);
  }
  const targetedWhere = conds.length > 0 ? `(${conds.join(" OR ")})` : "1 = 0"; // ヒットしない WHERE

  return { entity, aliases, aliasNames, targetedWhere, targetedParams: params };
}

/**
 * 「entity に関連する nyusatsu_results 行」の共通 FROM 句。
 *   - corp 一致ブランチ: idx_nyusatsu_results_winner_corp_pub を使う
 *   - alias 一致ブランチ: idx_nyusatsu_results_winner_pub を使う
 *
 * OR で書くと planner が idx_published を選び 298k 行スキャンするため、
 * UNION ALL で各ブランチを独立させて各々 index 検索させる。
 * DISTINCT は重複排除のため必要（corp と alias 両方ヒットするケース）。
 */
function targetedFromUnion(params) {
  // params.corp と params.aliasN の有無で SQL 断片を組み立てる
  // 共通カラムセット: id, award_date, award_amount, issuer_name, category
  //   （category は Step 1 分析深掘りで追加。既存 caller は必要 col のみ参照するため
  //    カラム追加は後方互換）
  const branches = [];
  if (params.corp) {
    branches.push(`
      SELECT r.id, r.award_date, r.award_amount, r.issuer_name, r.category
      FROM nyusatsu_results r
      WHERE r.is_published = 1 AND r.winner_corporate_number = @corp
    `);
  }
  const aliasKeys = Object.keys(params).filter((k) => /^alias\d+$/.test(k));
  if (aliasKeys.length > 0) {
    // 各 alias を個別 UNION ALL に（IN だと idx_winner が使われないことがあるため）
    for (const k of aliasKeys) {
      branches.push(`
        SELECT r.id, r.award_date, r.award_amount, r.issuer_name, r.category
        FROM nyusatsu_results r
        WHERE r.is_published = 1 AND r.winner_name = @${k}
      `);
    }
  }
  if (branches.length === 0) return null;
  return `(
    SELECT DISTINCT id, award_date, award_amount, issuer_name, category FROM (
      ${branches.join(" UNION ALL ")}
    )
  )`;
}

/**
 * entity 1件の timeline（月次 or 年次）。
 */
export function fetchEntityTimeline({ db, granularity = "month", targetedWhere, targetedParams }) {
  if (!targetedWhere) return [];
  const fromUnion = targetedFromUnion(targetedParams);
  if (!fromUnion) return [];
  const periodExpr = granularity === "year"
    ? "SUBSTR(award_date, 1, 4)"
    : "SUBSTR(award_date, 1, 7)";

  const sql = `
    SELECT
      ${periodExpr}                  AS period,
      COUNT(*)                       AS total_awards,
      COALESCE(SUM(award_amount), 0) AS total_amount,
      COUNT(DISTINCT issuer_name)    AS unique_buyers
    FROM ${fromUnion} x
    WHERE award_date IS NOT NULL AND award_date != ''
    GROUP BY period
    ORDER BY period ASC
  `;
  return db.prepare(sql).all(targetedParams);
}

/**
 * entity 1件の 発注機関別内訳 + 集中度。HHI を件数/金額の両方で計算。
 */
export function fetchEntityBuyerRelations({ db, targetedWhere, targetedParams, limit = 10 }) {
  if (!targetedWhere) {
    return { items: [], total_awards: 0, total_amount: 0,
             concentration_count: 0, concentration_amount: 0, top_issuer: null };
  }
  const fromUnion = targetedFromUnion(targetedParams);
  if (!fromUnion) {
    return { items: [], total_awards: 0, total_amount: 0,
             concentration_count: 0, concentration_amount: 0, top_issuer: null, unique_buyers: 0 };
  }
  const allRows = db.prepare(`
    SELECT issuer_name,
           COUNT(*)                       AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM ${fromUnion} x
    WHERE issuer_name IS NOT NULL AND issuer_name != ''
    GROUP BY issuer_name
    ORDER BY count DESC, total_amount DESC
  `).all(targetedParams);

  const totalAwards = allRows.reduce((s, r) => s + r.count, 0);
  const totalAmount = allRows.reduce((s, r) => s + (r.total_amount || 0), 0);

  const concCount = totalAwards > 0
    ? allRows.reduce((s, r) => s + Math.pow(r.count / totalAwards, 2), 0) : 0;
  const concAmount = totalAmount > 0
    ? allRows.reduce((s, r) => s + Math.pow((r.total_amount || 0) / totalAmount, 2), 0) : 0;

  const items = allRows.slice(0, limit).map((r) => ({
    issuer_name: r.issuer_name,
    count: r.count,
    total_amount: r.total_amount || 0,
    share_count:  totalAwards > 0 ? r.count / totalAwards : 0,
    share_amount: totalAmount > 0 ? (r.total_amount || 0) / totalAmount : 0,
  }));

  return {
    items,
    total_awards: totalAwards,
    total_amount: totalAmount,
    concentration_count:  Math.round(concCount  * 10000) / 10000,
    concentration_amount: Math.round(concAmount * 10000) / 10000,
    top_issuer: allRows[0]?.issuer_name || null,
    unique_buyers: allRows.length,
  };
}

/**
 * entity 1件の cluster mates。
 */
export function fetchClusterMates({ db, entity }) {
  if (!entity?.cluster_id) return [];
  return db.prepare(`
    SELECT id, canonical_name, corporate_number
    FROM resolved_entities
    WHERE cluster_id = ? AND id != ?
    ORDER BY canonical_name
  `).all(entity.cluster_id, entity.id);
}

// ─── Step 1 分析深掘り: entity 単位の帯分布 / 業種 TOP / 年度別 ────────

import { BAND_CASE_EXPR, sortByBandOrder } from "./amount-bands.js";

/**
 * entity 1件の金額帯分布。
 * @returns {Array<{ band: string, count: number, total_amount: number }>}
 */
export function fetchEntityAmountBands({ db, targetedParams }) {
  const fromUnion = targetedFromUnion(targetedParams);
  if (!fromUnion) return [];
  const rows = db.prepare(`
    SELECT ${BAND_CASE_EXPR} AS band,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM ${fromUnion} x
    GROUP BY band
  `).all(targetedParams);
  return sortByBandOrder(rows);
}

/**
 * entity 1件の業種 TOP。
 * @param {number} [limit=5]
 * @returns {Array<{ category: string, count: number, total_amount: number }>}
 */
export function fetchEntityCategoryTop({ db, targetedParams, limit = 5 }) {
  const fromUnion = targetedFromUnion(targetedParams);
  if (!fromUnion) return [];
  return db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(category), ''), '未分類') AS category,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM ${fromUnion} x
    GROUP BY category
    ORDER BY count DESC, total_amount DESC
    LIMIT @limit
  `).all({ ...targetedParams, limit });
}

/**
 * Phase H Step 4: entity 1件の最近の案件（deal score 用のサンプル deal 抽出）。
 * targetedFromUnion と同様の OR 条件を組み立てて、title も含めて取得する。
 *
 * @returns {Array<{ id:number, title:string|null, category:string|null,
 *                   award_date:string|null, award_amount:number|null,
 *                   issuer_name:string|null }>}
 */
export function fetchEntityRecentResults({ db, targetedParams, limit = 3 }) {
  const branches = [];
  if (targetedParams?.corp) {
    branches.push(`
      SELECT r.id, r.title, r.award_date, r.award_amount, r.issuer_name, r.category
      FROM nyusatsu_results r
      WHERE r.is_published = 1 AND r.winner_corporate_number = @corp
    `);
  }
  const aliasKeys = Object.keys(targetedParams || {}).filter((k) => /^alias\d+$/.test(k));
  for (const k of aliasKeys) {
    branches.push(`
      SELECT r.id, r.title, r.award_date, r.award_amount, r.issuer_name, r.category
      FROM nyusatsu_results r
      WHERE r.is_published = 1 AND r.winner_name = @${k}
    `);
  }
  if (branches.length === 0) return [];
  const fromUnion = `(
    SELECT DISTINCT id, title, award_date, award_amount, issuer_name, category
    FROM (${branches.join(" UNION ALL ")})
  )`;
  return db.prepare(`
    SELECT id, title, category, award_date, award_amount, issuer_name
    FROM ${fromUnion} x
    WHERE award_date IS NOT NULL AND award_date != ''
    ORDER BY award_date DESC, id DESC
    LIMIT @limit
  `).all({ ...targetedParams, limit });
}

/**
 * entity 1件の年度別件数・金額（暦年）。
 * timeline は month 粒度で既に返しているが、こちらは年度粒度で avg も含めた
 * サマリー用。カード表示向けに簡潔化。
 * @returns {Array<{ year: string, count: number, total_amount: number, avg_amount: number }>}
 */
export function fetchEntityYearlyStats({ db, targetedParams }) {
  const fromUnion = targetedFromUnion(targetedParams);
  if (!fromUnion) return [];
  return db.prepare(`
    SELECT SUBSTR(award_date, 1, 4) AS year,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount,
           CASE
             WHEN COUNT(*) > 0
               THEN CAST(COALESCE(SUM(award_amount), 0) AS REAL) / COUNT(*)
             ELSE 0
           END AS avg_amount
    FROM ${fromUnion} x
    WHERE award_date IS NOT NULL AND award_date != ''
    GROUP BY year
    ORDER BY year ASC
  `).all(targetedParams);
}
