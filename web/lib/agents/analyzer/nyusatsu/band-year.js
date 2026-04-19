/**
 * Analyzer: 金額帯 × 年度 マトリクス
 *
 * 目的: 「何年にどの価格帯が多かったか」を 1 枚で見せる。
 *       高額帯の増減・低額帯の縮小・価格構造のシフトを把握する。
 *
 * ポリシー:
 *   - 帯定義は Step 1 の amount-bands.js を完全再利用（9区分、重複実装しない）
 *   - 年度は SUBSTR(award_date, 1, 4) の暦年（Step 1 yearly-stats / Step 2 category-year と一貫）
 *   - award_date が欠損の行は集計から除外（年度軸が必須のため）
 *     → 「不明」帯には「日付はあるが金額が NULL/0/負数」の行だけが入る
 *   - 欠損セル（その年・その帯に 1 件も無い）は count=0 で埋める
 *   - fuzzy / LIKE / LLM / issuer 正規化は不使用
 *   - 将来拡張用に total_amount も返すが、UI では件数のみ表示する
 */

import { BAND_CASE_EXPR, BAND_ORDER } from "./amount-bands.js";

/**
 * @param {object} db
 * @param {object} [filters]
 * @param {number} [filters.yearFrom]
 * @param {number} [filters.yearTo]
 * @returns {{
 *   years: string[],                               // 昇順
 *   bands: string[],                               // BAND_ORDER そのまま
 *   rows:  Array<{
 *     band: string,
 *     totalCount: number,
 *     totalAmount: number,
 *     cells: Array<{ year: string, count: number, total_amount: number }>,
 *   }>,
 *   totals: {
 *     count: number,
 *     byYear: Array<{ year: string, count: number }>,
 *   },
 * }}
 */
export function fetchBandYearMatrix(db, filters = {}) {
  if (!db) throw new TypeError("fetchBandYearMatrix: db is required");

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

  // 1 クエリで (year, band) の件数 / 金額合計を取得
  const raw = db.prepare(`
    SELECT SUBSTR(award_date, 1, 4) AS year,
           ${BAND_CASE_EXPR} AS band,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY year, band
  `).all(params);

  const years = [...new Set(raw.map((r) => r.year))].sort();
  const cellMap = new Map(); // key = band|year
  for (const r of raw) cellMap.set(`${r.band}|${r.year}`, r);

  // 行 = band（BAND_ORDER 固定順）、列 = year 昇順。欠損セルは count=0 で埋める。
  const rows = BAND_ORDER.map((band) => {
    let totalCount = 0;
    let totalAmount = 0;
    const cells = years.map((year) => {
      const c = cellMap.get(`${band}|${year}`);
      const count = c?.count || 0;
      const amount = c?.total_amount || 0;
      totalCount += count;
      totalAmount += amount;
      return { year, count, total_amount: amount };
    });
    return { band, totalCount, totalAmount, cells };
  });

  // 列合計（年ごとの件数）
  const byYearMap = new Map(years.map((y) => [y, 0]));
  let grandTotal = 0;
  for (const row of rows) {
    for (const cell of row.cells) {
      byYearMap.set(cell.year, (byYearMap.get(cell.year) || 0) + cell.count);
      grandTotal += cell.count;
    }
  }
  const byYear = years.map((year) => ({ year, count: byYearMap.get(year) || 0 }));

  return {
    years,
    bands: [...BAND_ORDER],
    rows,
    totals: { count: grandTotal, byYear },
  };
}
