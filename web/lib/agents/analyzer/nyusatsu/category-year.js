/**
 * Analyzer: 業種カテゴリ × 年度 マトリクス
 *
 * ポリシー:
 *   - category は既存 nyusatsu_results.category 列を正として使う
 *   - NULL / 空は「未分類」に固定
 *   - 自然言語推定・fuzzy 分類は使わない
 *   - 上位 N カテゴリだけ返す（全カテゴリ返すと UI が崩れる）
 *     それ以外は「その他」に集約
 */

const UNCATEGORIZED_LABEL = "未分類";
const OTHER_LABEL = "その他";

/**
 * @param {object} db
 * @param {object} [filters]
 * @param {number} [filters.yearFrom]
 * @param {number} [filters.yearTo]
 * @param {number} [filters.topCategories=12]
 * @returns {{
 *   categories: string[],                   // 表示するカテゴリ順（上位 N + "その他"）
 *   years:      string[],                   // 対象年度（昇順）
 *   matrix:     Array<{ year: string, category: string, count: number, total_amount: number }>
 * }}
 */
export function getCategoryYearMatrix(db, filters = {}) {
  if (!db) throw new TypeError("getCategoryYearMatrix: db is required");

  const top = Math.max(1, Math.min(30, filters.topCategories ?? 12));
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

  const raw = db.prepare(`
    SELECT SUBSTR(award_date, 1, 4) AS year,
           COALESCE(NULLIF(TRIM(category), ''), @uncategorized) AS category,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY year, category
    ORDER BY year ASC, count DESC
  `).all({ ...params, uncategorized: UNCATEGORIZED_LABEL });

  // 全期間の件数で上位カテゴリを決定
  const byCat = new Map();
  for (const r of raw) {
    byCat.set(r.category, (byCat.get(r.category) || 0) + r.count);
  }
  const sortedCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const topCats = sortedCats.slice(0, top).map(([c]) => c);
  const topSet = new Set(topCats);
  const hasOther = sortedCats.length > topCats.length;

  // 上位に入らないものは OTHER_LABEL に集約
  const merged = new Map(); // key = year|category
  for (const r of raw) {
    const cat = topSet.has(r.category) ? r.category : OTHER_LABEL;
    const key = `${r.year}|${cat}`;
    const cur = merged.get(key) || { year: r.year, category: cat, count: 0, total_amount: 0 };
    cur.count += r.count;
    cur.total_amount += r.total_amount || 0;
    merged.set(key, cur);
  }

  const matrix = [...merged.values()].sort(
    (a, b) => a.year.localeCompare(b.year) || b.count - a.count
  );
  const years = [...new Set(matrix.map((m) => m.year))].sort();
  const categories = hasOther ? [...topCats, OTHER_LABEL] : topCats;

  return { categories, years, matrix };
}

export const CATEGORY_MATRIX_UNCATEGORIZED = UNCATEGORIZED_LABEL;
export const CATEGORY_MATRIX_OTHER = OTHER_LABEL;
