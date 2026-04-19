/**
 * Phase H Step 1.5: 事前計算済みの年次 entity ranking 読み取り。
 *
 * テーブル: nyusatsu_entity_yearly_rank（rebuild script で生成）
 *   - year, entity_id, rank_by_count, count, total_amount, avg_amount,
 *     entity_name_snapshot, created_at, updated_at
 *
 * 呼び出し側（fetchRankingDiff / entity score）は「利用可能なら使う」。
 * 使えない場合は従来のオンザフライ集計に fallback する。
 */

/**
 * 指定した年 list に precomputed データが全部あるか。
 * テーブルが存在しない / 1 年でも欠けている場合は false。
 * @returns {boolean}
 */
export function hasYearlyRankForYears({ db, years }) {
  if (!db || !Array.isArray(years) || years.length === 0) return false;
  try {
    const placeholders = years.map((_, i) => `@y${i}`).join(",");
    const params = {};
    years.forEach((y, i) => { params[`y${i}`] = String(y); });
    const rows = db.prepare(`
      SELECT DISTINCT year
      FROM nyusatsu_entity_yearly_rank
      WHERE year IN (${placeholders})
    `).all(params);
    const found = new Set(rows.map(r => r.year));
    return years.every(y => found.has(String(y)));
  } catch {
    // テーブル未作成 / 読み取り不能 → fallback させる
    return false;
  }
}

/**
 * 単一年の上位 N 件を precomputed テーブルから取得。
 * 返却は getAwardRanking(by:"entity",metric:"count") 互換の並び順。
 *
 * @param {object} opts
 * @param {object} opts.db
 * @param {string|number} opts.year
 * @param {number} [opts.limit=200]
 * @returns {Array<{
 *   entity_id: number,
 *   rank: number,
 *   count: number,
 *   total_amount: number,
 *   avg_amount: number,
 *   name: string|null,
 * }>}
 */
export function fetchYearlyEntityRanking({ db, year, limit = 200 }) {
  if (!db) throw new TypeError("fetchYearlyEntityRanking: db is required");
  const rows = db.prepare(`
    SELECT entity_id,
           rank_by_count            AS rank,
           count,
           total_amount,
           avg_amount,
           entity_name_snapshot     AS name
    FROM nyusatsu_entity_yearly_rank
    WHERE year = @y
    ORDER BY rank_by_count ASC
    LIMIT @limit
  `).all({ y: String(year), limit });
  return rows;
}
