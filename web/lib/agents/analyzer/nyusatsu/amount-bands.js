/**
 * Analyzer: 落札金額の帯分布
 *
 * 目的: 市場感（どの金額レンジが多いか）をざっくり把握する。
 *
 * ポリシー:
 *   - NULL / 0 / 負数は「不明」に分類（捨てずに残す）
 *   - 9 区分固定（外部から増減させない）
 *   - 並びは BAND_ORDER の順で返す（昇順レンジ + 不明は末尾）
 *   - filter (year / category) は全件集計と同じ where を使える
 */

export const BAND_ORDER = [
  "〜10万円",
  "10万〜50万円",
  "50万〜100万円",
  "100万〜500万円",
  "500万〜1000万円",
  "1000万〜5000万円",
  "5000万〜1億円",
  "1億円以上",
  "不明",
];

// SQL CASE 式（reusable）。award_amount 列を直接参照するので、
// targetedFromUnion 等で column alias を残すコンテキストでも動く。
const BAND_CASE_SQL = `
  CASE
    WHEN award_amount IS NULL OR award_amount <= 0 THEN '不明'
    WHEN award_amount <=      100000 THEN '〜10万円'
    WHEN award_amount <=      500000 THEN '10万〜50万円'
    WHEN award_amount <=     1000000 THEN '50万〜100万円'
    WHEN award_amount <=     5000000 THEN '100万〜500万円'
    WHEN award_amount <=    10000000 THEN '500万〜1000万円'
    WHEN award_amount <=    50000000 THEN '1000万〜5000万円'
    WHEN award_amount <=   100000000 THEN '5000万〜1億円'
    ELSE '1億円以上'
  END
`;

function sortByBandOrder(rows) {
  const byBand = new Map(rows.map((r) => [r.band, r]));
  return BAND_ORDER.map((b) => {
    const r = byBand.get(b);
    return {
      band: b,
      count: r?.count || 0,
      total_amount: r?.total_amount || 0,
    };
  });
}

/**
 * 全体の金額帯分布を返す。
 * 合計件数は Σcount == is_published=1 の全行数と一致する（不明も含めて分類）。
 *
 * @param {object} db
 * @param {object} [filters]
 * @param {number} [filters.yearFrom]
 * @param {number} [filters.yearTo]
 * @param {string} [filters.category]
 * @returns {Array<{ band: string, count: number, total_amount: number }>}
 */
export function getAwardAmountBandDistribution(db, filters = {}) {
  if (!db) throw new TypeError("getAwardAmountBandDistribution: db is required");

  const where = ["is_published = 1"];
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

  const rows = db.prepare(`
    SELECT ${BAND_CASE_SQL} AS band,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY band
  `).all(params);

  return sortByBandOrder(rows);
}

// entity-detail 等の内部利用向け（targetedFromUnion と併用）。
export const BAND_CASE_EXPR = BAND_CASE_SQL;
export { sortByBandOrder };
