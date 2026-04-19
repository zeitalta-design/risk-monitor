/**
 * Analyzer: 年度別推移（暦年ベース）
 *
 * ポリシー:
 *   - 年度定義は「暦年」（4月始まりの FY ではなく西暦年）。
 *     award_date の先頭4文字を year とする。既存 timeline.js と一貫。
 *   - award_date が欠損の行は集計から除外。
 *   - 平均金額は SUM / COUNT で null safe（count=0 は返さない）。
 *   - RESOLVED_RESULTS_SQL は使わない（全体推移には entity 解決不要で、
 *     余計な JOIN で 298k 行スキャンが重くなるため）。
 */

/**
 * @param {object} db
 * @param {object} [filters]
 * @param {number} [filters.yearFrom]
 * @param {number} [filters.yearTo]
 * @param {string} [filters.category]
 * @returns {Array<{ year: string, count: number, total_amount: number, avg_amount: number }>}
 */
export function getYearlyStats(db, filters = {}) {
  if (!db) throw new TypeError("getYearlyStats: db is required");

  const where = [
    "is_published = 1",
    "award_date IS NOT NULL",
    "award_date != ''",
  ];
  const params = {};
  if (filters.yearFrom != null) {
    where.push("SUBSTR(award_date, 1, 4) >= @yf");
    params.yf = String(filters.yearFrom);
  }
  if (filters.yearTo != null) {
    where.push("SUBSTR(award_date, 1, 4) <= @yt");
    params.yt = String(filters.yearTo);
  }
  if (filters.category) {
    where.push("category = @cat");
    params.cat = filters.category;
  }

  return db.prepare(`
    SELECT SUBSTR(award_date, 1, 4) AS year,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount,
           CASE
             WHEN COUNT(*) > 0
               THEN CAST(COALESCE(SUM(award_amount), 0) AS REAL) / COUNT(*)
             ELSE 0
           END AS avg_amount
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY year
    ORDER BY year ASC
  `).all(params);
}
