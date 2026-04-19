/**
 * Analyzer: 金額帯 × 業種カテゴリ のクロス集計
 *
 * 目的: 「どの業種がどの価格帯に強いか」を一目で見えるようにする。
 *
 * ポリシー:
 *   - 帯定義は Step 1 の amount-bands.js を完全再利用（帯の重複実装はしない）
 *   - category は既存 nyusatsu_results.category 列。NULL/空 → 「未分類」
 *   - 上位 N カテゴリ以外は 「その他」 に集約
 *   - 自然言語分類 / fuzzy / LIKE は使わない
 */

import { BAND_CASE_EXPR, BAND_ORDER } from "./amount-bands.js";

const UNCATEGORIZED_LABEL = "未分類";
const OTHER_LABEL = "その他";

/**
 * @param {object} db
 * @param {object} [filters]
 * @param {number} [filters.yearFrom]
 * @param {number} [filters.yearTo]
 * @param {number} [filters.topCategories=10]
 * @returns {{
 *   bands: string[],                 // 帯の表示順（Step 1 と同一）
 *   categories: Array<{
 *     category:   string,
 *     totalCount: number,
 *     totalAmount:number,
 *     cells:      Array<{ band: string, count: number, total_amount: number }>,
 *   }>,
 *   totals: { count: number, byBand: Record<string, number> },
 * }}
 */
export function getCategoryBandMatrix(db, filters = {}) {
  if (!db) throw new TypeError("getCategoryBandMatrix: db is required");

  const top = Math.max(1, Math.min(20, filters.topCategories ?? 10));
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

  // 1 クエリで (category, band) の件数/金額を全て取得
  const raw = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(category), ''), @uncategorized) AS category,
           ${BAND_CASE_EXPR} AS band,
           COUNT(*) AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY category, band
  `).all({ ...params, uncategorized: UNCATEGORIZED_LABEL });

  // カテゴリ別 totalCount で上位 N を決める
  const byCategory = new Map();
  for (const r of raw) {
    const cur = byCategory.get(r.category) || { category: r.category, totalCount: 0, totalAmount: 0 };
    cur.totalCount  += r.count;
    cur.totalAmount += r.total_amount || 0;
    byCategory.set(r.category, cur);
  }
  const sortedCats = [...byCategory.values()].sort((a, b) => b.totalCount - a.totalCount);
  const topCats = sortedCats.slice(0, top).map((c) => c.category);
  const topSet  = new Set(topCats);
  const hasOther = sortedCats.length > topCats.length;

  // カテゴリ × 帯 のセルを集約（上位外は "その他" に寄せる）
  const cellMap = new Map(); // key = category|band
  for (const r of raw) {
    const cat = topSet.has(r.category) ? r.category : OTHER_LABEL;
    const key = `${cat}|${r.band}`;
    const cur = cellMap.get(key) || { band: r.band, count: 0, total_amount: 0 };
    cur.count        += r.count;
    cur.total_amount += r.total_amount || 0;
    cellMap.set(key, cur);
  }

  // 結果の categories 配列を組み立て。各 category について、BAND_ORDER 順で
  // cells を並べる（ゼロも NULL にせずに count=0 で埋める）。
  function makeCells(cat) {
    return BAND_ORDER.map((band) => {
      const cell = cellMap.get(`${cat}|${band}`);
      return {
        band,
        count: cell?.count || 0,
        total_amount: cell?.total_amount || 0,
      };
    });
  }

  const categoriesOut = topCats.map((cat) => {
    const agg = byCategory.get(cat);
    return {
      category:    cat,
      totalCount:  agg?.totalCount || 0,
      totalAmount: agg?.totalAmount || 0,
      cells:       makeCells(cat),
    };
  });

  if (hasOther) {
    // "その他" の合計を別途計算
    let oc = 0, oa = 0;
    for (const c of sortedCats) {
      if (!topSet.has(c.category)) {
        oc += c.totalCount;
        oa += c.totalAmount;
      }
    }
    categoriesOut.push({
      category:    OTHER_LABEL,
      totalCount:  oc,
      totalAmount: oa,
      cells:       makeCells(OTHER_LABEL),
    });
  }

  // 帯ごとの総件数（列合計）
  const byBand = Object.fromEntries(BAND_ORDER.map((b) => [b, 0]));
  let totalCount = 0;
  for (const cat of categoriesOut) {
    for (const cell of cat.cells) {
      byBand[cell.band] += cell.count;
      totalCount += cell.count;
    }
  }

  return {
    bands: [...BAND_ORDER],
    categories: categoriesOut,
    totals: { count: totalCount, byBand },
  };
}

export const CATEGORY_BAND_UNCATEGORIZED = UNCATEGORIZED_LABEL;
export const CATEGORY_BAND_OTHER = OTHER_LABEL;
