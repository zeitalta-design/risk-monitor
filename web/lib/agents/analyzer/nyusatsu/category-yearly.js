/**
 * Phase H Step 4.5: nyusatsu_category_yearly の読み取り + market/category 入力組立。
 *
 * テーブル: (year, category, count, total_amount, premium_count)
 *   - rebuild script で投入される。本モジュールは参照専用。
 *
 * 設計:
 *   - hasCategoryYearlyForYears: precomputed が利用可能か（両年とも存在するか）
 *   - fetchCategoryYearlySnapshot: 両年分の raw 行を 1 クエリで取得
 *   - marketInputsFromSnapshot: 全カテゴリを年別に SUM して全体市場 inputs を構築
 *   - categoryInputsFromSnapshot: category ごとに (current, prev) 入力を構築
 *
 *   market-score / category-score / deal-score の 3 ファイルが本モジュールを
 *   通じて同じ snapshot を共有できる（deal-score の同一 request 内での重複計算
 *   を抑制）。ただし各 score 関数は API 互換性のため独自 fetch するのが基本。
 */

/**
 * @returns {boolean} 指定した全年度に precomputed が存在する場合のみ true。
 * テーブル未作成・一部年欠落・読み取り失敗はすべて false（fallback させる）。
 */
export function hasCategoryYearlyForYears({ db, years }) {
  if (!db || !Array.isArray(years) || years.length === 0) return false;
  try {
    const placeholders = years.map((_, i) => `@y${i}`).join(",");
    const params = {};
    years.forEach((y, i) => { params[`y${i}`] = String(y); });
    const rows = db.prepare(`
      SELECT DISTINCT year
      FROM nyusatsu_category_yearly
      WHERE year IN (${placeholders})
    `).all(params);
    const found = new Set(rows.map((r) => r.year));
    return years.every((y) => found.has(String(y)));
  } catch {
    return false;
  }
}

/**
 * 指定年分の全カテゴリ行を取得。
 * @returns {Array<{ year:string, category:string, count:number, total_amount:number, premium_count:number }>}
 */
export function fetchCategoryYearlySnapshot({ db, years }) {
  if (!db || !Array.isArray(years) || years.length === 0) return [];
  const placeholders = years.map((_, i) => `@y${i}`).join(",");
  const params = {};
  years.forEach((y, i) => { params[`y${i}`] = String(y); });
  return db.prepare(`
    SELECT year, category, count, total_amount, premium_count
    FROM nyusatsu_category_yearly
    WHERE year IN (${placeholders})
  `).all(params);
}

/**
 * 全カテゴリを年別に合算して市場スコアの inputs 形にする。
 * market-score の従来 yearly-stats + band-year と同じ形を返すことで、
 * composeTrendScore に差し込むだけで score が組み立つ。
 */
export function marketInputsFromSnapshot(rows, yc, yp) {
  let count_current = 0, count_prev = 0;
  let amount_current = 0, amount_prev = 0;
  let premium_count_current = 0, premium_count_prev = 0;
  for (const r of rows) {
    if (r.year === String(yc)) {
      count_current         += r.count;
      amount_current        += r.total_amount || 0;
      premium_count_current += r.premium_count || 0;
    } else if (r.year === String(yp)) {
      count_prev         += r.count;
      amount_prev        += r.total_amount || 0;
      premium_count_prev += r.premium_count || 0;
    }
  }
  return {
    count_current, count_prev,
    amount_current, amount_prev,
    premium_share_current: count_current > 0 ? premium_count_current / count_current : null,
    premium_share_prev:    count_prev    > 0 ? premium_count_prev    / count_prev    : null,
  };
}

/**
 * category → { current, prev inputs } の Map に畳み込む。
 * 片年しかデータが無いカテゴリもそのまま含まれる（呼び出し側で判断）。
 */
export function categoryInputsFromSnapshot(rows, yc, yp) {
  const byCat = new Map();
  const YC = String(yc), YP = String(yp);
  for (const r of rows) {
    if (r.year !== YC && r.year !== YP) continue;
    const cur = byCat.get(r.category) || {
      category: r.category,
      count_current: 0,  count_prev: 0,
      amount_current: 0, amount_prev: 0,
      premium_count_current: 0, premium_count_prev: 0,
    };
    if (r.year === YC) {
      cur.count_current         = r.count;
      cur.amount_current        = r.total_amount || 0;
      cur.premium_count_current = r.premium_count || 0;
    } else {
      cur.count_prev         = r.count;
      cur.amount_prev        = r.total_amount || 0;
      cur.premium_count_prev = r.premium_count || 0;
    }
    byCat.set(r.category, cur);
  }
  return byCat;
}
