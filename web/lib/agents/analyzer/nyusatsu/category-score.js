/**
 * Analyzer: Category Market Score（Phase H Step 3 / Step 4.5 高速化対応）
 *
 * 目的: 「どの業種カテゴリ市場が伸びているか」を 0〜100 で一目判定できるようにする。
 *
 * ポリシー:
 *   - Phase H Step 2 全体市場スコアと同じ重み・閾値・ラベル（composeTrendScore 経由）
 *   - NULL / 空 category は「未分類」ラベル（category-year / category-band と一貫）
 *   - premium = award_amount > 50,000,000（Step 1 amount-bands の
 *     「5000万〜1億円」+「1億円以上」と等価）
 *
 * 経路:
 *   [Phase H Step 4.5] nyusatsu_category_yearly が利用可能なら precomputed から組み立て。
 *   それ以外は従来の生集計 SQL に fallback。レスポンス形は両経路で同一。
 */

import { composeTrendScore } from "./market-score.js";
import {
  hasCategoryYearlyForYears,
  fetchCategoryYearlySnapshot,
  categoryInputsFromSnapshot,
} from "./category-yearly.js";

const UNCATEGORIZED_LABEL = "未分類";
const PREMIUM_AMOUNT_THRESHOLD = 50_000_000;

const WEIGHTS = {
  volume_trend:  0.4,
  amount_trend:  0.4,
  premium_shift: 0.2,
};

function defaultYears() {
  const y = new Date().getFullYear();
  return { yearCurrent: String(y - 1), yearPrev: String(y - 2) };
}

export function computeCategoryMarketScores({ db, yearCurrent, yearPrev, limit = 10 } = {}) {
  if (!db) throw new TypeError("computeCategoryMarketScores: db is required");
  const dy = defaultYears();
  const yc = String(yearCurrent ?? dy.yearCurrent);
  const yp = String(yearPrev    ?? dy.yearPrev);
  if (!/^\d{4}$/.test(yc) || !/^\d{4}$/.test(yp)) {
    throw new TypeError("computeCategoryMarketScores: year must be YYYY");
  }

  // [Phase H Step 4.5] precomputed が使えれば最優先
  if (hasCategoryYearlyForYears({ db, years: [yc, yp] })) {
    return _fromPrecomputed({ db, yc, yp, limit });
  }
  return _fromLegacyAggregation({ db, yc, yp, limit });
}

// 高速経路: nyusatsu_category_yearly を 1 クエリで読んで JS 側で compose
function _fromPrecomputed({ db, yc, yp, limit }) {
  const rows = fetchCategoryYearlySnapshot({ db, years: [yc, yp] });
  const byCat = categoryInputsFromSnapshot(rows, yc, yp);
  return _composeResponse({ byCat, yc, yp, limit });
}

// 従来経路: nyusatsu_results を date range で絞って (category, year) に GROUP BY
function _fromLegacyAggregation({ db, yc, yp, limit }) {
  const minY = String(Math.min(Number(yc), Number(yp)));
  const maxY = String(Math.max(Number(yc), Number(yp)));
  const rows = db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(category), ''), @uncat)          AS category,
      SUBSTR(award_date, 1, 4)                              AS year,
      COUNT(*)                                              AS count,
      COALESCE(SUM(award_amount), 0)                        AS total_amount,
      SUM(CASE WHEN award_amount > @premium THEN 1 ELSE 0 END) AS premium_count
    FROM nyusatsu_results
    WHERE is_published = 1
      AND award_date IS NOT NULL AND award_date != ''
      AND award_date >= @from AND award_date <= @to
    GROUP BY category, year
  `).all({
    from: `${minY}-01-01`,
    to:   `${maxY}-12-31`,
    uncat:   UNCATEGORIZED_LABEL,
    premium: PREMIUM_AMOUNT_THRESHOLD,
  });

  const byCat = new Map();
  for (const r of rows) {
    if (r.year !== yc && r.year !== yp) continue;
    const cur = byCat.get(r.category) || {
      category: r.category,
      count_current: 0, count_prev: 0,
      amount_current: 0, amount_prev: 0,
      premium_count_current: 0, premium_count_prev: 0,
    };
    if (r.year === yc) {
      cur.count_current         = r.count;
      cur.amount_current        = r.total_amount;
      cur.premium_count_current = r.premium_count || 0;
    } else {
      cur.count_prev         = r.count;
      cur.amount_prev        = r.total_amount;
      cur.premium_count_prev = r.premium_count || 0;
    }
    byCat.set(r.category, cur);
  }
  return _composeResponse({ byCat, yc, yp, limit });
}

// 両経路共通: category 入力 Map → sorted items[]
function _composeResponse({ byCat, yc, yp, limit }) {
  const items = [];
  for (const v of byCat.values()) {
    const premium_share_current =
      v.count_current > 0 ? v.premium_count_current / v.count_current : null;
    const premium_share_prev =
      v.count_prev > 0 ? v.premium_count_prev / v.count_prev : null;

    const composed = composeTrendScore({
      countCurrent:  v.count_current,  countPrev:  v.count_prev,
      amountCurrent: v.amount_current, amountPrev: v.amount_prev,
      premiumShareCurrent: premium_share_current,
      premiumSharePrev:    premium_share_prev,
    });

    items.push({
      category:   v.category,
      score:      composed.score,
      label:      composed.label,
      components: composed.components,
      inputs: {
        count_current:  v.count_current,
        count_prev:     v.count_prev,
        amount_current: v.amount_current,
        amount_prev:    v.amount_prev,
        premium_share_current,
        premium_share_prev,
      },
    });
  }

  items.sort((a, b) =>
    b.score - a.score ||
    b.inputs.count_current - a.inputs.count_current
  );

  const lim = Number.isFinite(limit) && limit > 0 ? limit : items.length;
  return {
    yearCurrent: yc,
    yearPrev: yp,
    items: items.slice(0, lim),
    weights: { ...WEIGHTS },
  };
}

export {
  WEIGHTS as CATEGORY_SCORE_WEIGHTS,
  UNCATEGORIZED_LABEL as CATEGORY_SCORE_UNCATEGORIZED,
  PREMIUM_AMOUNT_THRESHOLD as CATEGORY_SCORE_PREMIUM_THRESHOLD,
};
