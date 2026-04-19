/**
 * Analyzer: Market Trend Score（Phase H Step 2）
 *
 * 目的: 「入札市場そのものが伸びているか」を 0〜100 で一目判定できるようにする。
 *
 * ポリシー:
 *   - 新しい重集計を作らず、Step 1（yearly-stats）と Step 4（band-year）の
 *     既存 analyzer を再利用する
 *   - fuzzy / LIKE / LLM / issuer 正規化は不使用
 *   - component 計算・重み・閾値は 1 ファイルに集約（後でチューニング可能）
 *   - inputs / components / weights を全て返して説明可能にする
 *
 * 合成式:
 *   score = 0.4 * volume_trend + 0.4 * amount_trend + 0.2 * premium_shift
 *   各 component は 0〜100 clamp。null は中立 50 として合成に参加。
 */

import { getYearlyStats } from "./yearly-stats.js";
import { fetchBandYearMatrix } from "./band-year.js";
import {
  hasCategoryYearlyForYears,
  fetchCategoryYearlySnapshot,
  marketInputsFromSnapshot,
} from "./category-yearly.js";

const WEIGHTS = {
  volume_trend:  0.4,
  amount_trend:  0.4,
  premium_shift: 0.2,
};

// 高額帯 = 5000万〜1億円 + 1億円以上（Step 1 / Step 4 と同じラベル）
const PREMIUM_BANDS = new Set(["5000万〜1億円", "1億円以上"]);

function clamp100(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

// 件数成長率 → 0..100 （+20%=100, 0=50, -20%=0）
function scoreVolumeTrend(cur, prev) {
  if (prev == null || prev <= 0) return cur > 0 ? 100 : 50;
  const g = (cur - prev) / prev;
  return clamp100(50 + g * 250); // 0.20 * 250 = 50
}

// 金額成長率 → 0..100 （+30%=100, 0=50, -30%=0）
function scoreAmountTrend(cur, prev) {
  if (prev == null || prev <= 0) return cur > 0 ? 100 : 50;
  const g = (cur - prev) / prev;
  return clamp100(50 + g * (50 / 0.30)); // ≒166.67
}

// 高額帯比率差 → 0..100 （+5pt=100, 0pt=50, -5pt=0）
function scorePremiumShift(shareCur, sharePrev) {
  if (shareCur == null || sharePrev == null) return null;
  const diff = shareCur - sharePrev; // share 差（-0.05..+0.05 あたりが中心）
  return clamp100(50 + diff * 1000); // 0.05 * 1000 = 50
}

function labelFor(score) {
  if (score >= 80) return "非常に強い";
  if (score >= 60) return "成長市場";
  if (score >= 40) return "横ばい";
  return "減速";
}

// 2026年のような年途中データを避けるため、デフォルトは
// 「前年 vs 前々年」（= ダッシュボードの ranking-diff 初期値と同じ発想）。
function defaultYears() {
  const y = new Date().getFullYear();
  return { yearCurrent: String(y - 1), yearPrev: String(y - 2) };
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number|string} [opts.yearCurrent]  未指定: 前年
 * @param {number|string} [opts.yearPrev]     未指定: 前々年
 * @returns {{
 *   score: number,
 *   label: "非常に強い"|"成長市場"|"横ばい"|"減速",
 *   years: { current: string, prev: string },
 *   components: { volume_trend: number, amount_trend: number, premium_shift: number|null },
 *   inputs: {
 *     count_current: number, count_prev: number,
 *     amount_current: number, amount_prev: number,
 *     premium_share_current: number|null, premium_share_prev: number|null,
 *   },
 *   weights: typeof WEIGHTS,
 * }}
 */
export function computeMarketTrendScore({ db, yearCurrent, yearPrev } = {}) {
  if (!db) throw new TypeError("computeMarketTrendScore: db is required");
  const dy = defaultYears();
  const yc = String(yearCurrent ?? dy.yearCurrent);
  const yp = String(yearPrev    ?? dy.yearPrev);
  if (!/^\d{4}$/.test(yc) || !/^\d{4}$/.test(yp)) {
    throw new TypeError("computeMarketTrendScore: year must be YYYY");
  }

  // [Phase H Step 4.5] precomputed nyusatsu_category_yearly が使えれば最優先。
  //   → yearly-stats + band-year の 2 本の全表集計（冷 cache 時 60s+）を回避。
  //   構造: 全カテゴリを年別に SUM して market inputs を再構成する。
  let inputs;
  if (hasCategoryYearlyForYears({ db, years: [yc, yp] })) {
    const rows = fetchCategoryYearlySnapshot({ db, years: [yc, yp] });
    inputs = marketInputsFromSnapshot(rows, yc, yp);
  } else {
    inputs = _legacyMarketInputs({ db, yc, yp });
  }

  const composed = composeTrendScore({
    countCurrent:  inputs.count_current,  countPrev:  inputs.count_prev,
    amountCurrent: inputs.amount_current, amountPrev: inputs.amount_prev,
    premiumShareCurrent: inputs.premium_share_current,
    premiumSharePrev:    inputs.premium_share_prev,
  });

  return {
    score: composed.score,
    label: composed.label,
    years: { current: yc, prev: yp },
    components: composed.components,
    inputs,
    weights: { ...WEIGHTS },
  };
}

// 従来経路: yearly-stats + band-year をその場で集計して inputs を組み立てる。
function _legacyMarketInputs({ db, yc, yp }) {
  const yFrom = Math.min(Number(yc), Number(yp));
  const yTo   = Math.max(Number(yc), Number(yp));

  const yearly = getYearlyStats(db, { yearFrom: yFrom, yearTo: yTo });
  const byYear = new Map(yearly.map((y) => [y.year, y]));
  const curY  = byYear.get(yc);
  const prevY = byYear.get(yp);
  const count_current  = curY?.count  || 0;
  const count_prev     = prevY?.count || 0;
  const amount_current = curY?.total_amount  || 0;
  const amount_prev    = prevY?.total_amount || 0;

  const bandYear = fetchBandYearMatrix(db, { yearFrom: yFrom, yearTo: yTo });
  const premiumCountFor = (year) => {
    let n = 0;
    for (const row of bandYear.rows) {
      if (!PREMIUM_BANDS.has(row.band)) continue;
      const cell = row.cells.find((c) => c.year === year);
      n += cell?.count || 0;
    }
    return n;
  };
  const totalFor = (year) =>
    bandYear.totals.byYear.find((b) => b.year === year)?.count || 0;
  const pcCur = premiumCountFor(yc);
  const pcPrev = premiumCountFor(yp);
  const ptCur = totalFor(yc);
  const ptPrev = totalFor(yp);

  return {
    count_current, count_prev,
    amount_current, amount_prev,
    premium_share_current: ptCur  > 0 ? pcCur  / ptCur  : null,
    premium_share_prev:    ptPrev > 0 ? pcPrev / ptPrev : null,
  };
}

/**
 * 共通スコア合成（Phase H Step 2 全体市場 / Step 3 業種別 が同じ重み・閾値で動く）。
 * null component は中立 50 として合成に参加（「測定不能＝最低点」ではない）。
 *
 * @param {{ countCurrent:number, countPrev:number, amountCurrent:number, amountPrev:number,
 *           premiumShareCurrent:number|null, premiumSharePrev:number|null }} inputs
 * @returns {{ score:number, label:string, components:{volume_trend:number|null, amount_trend:number|null, premium_shift:number|null} }}
 */
export function composeTrendScore({
  countCurrent, countPrev,
  amountCurrent, amountPrev,
  premiumShareCurrent, premiumSharePrev,
}) {
  const volume_trend  = scoreVolumeTrend(countCurrent, countPrev);
  const amount_trend  = scoreAmountTrend(amountCurrent, amountPrev);
  const premium_shift = scorePremiumShift(premiumShareCurrent, premiumSharePrev);
  const score = clamp100(
    (volume_trend  ?? 50) * WEIGHTS.volume_trend +
    (amount_trend  ?? 50) * WEIGHTS.amount_trend +
    (premium_shift ?? 50) * WEIGHTS.premium_shift
  );
  return { score, label: labelFor(score), components: { volume_trend, amount_trend, premium_shift } };
}

export {
  WEIGHTS        as MARKET_SCORE_WEIGHTS,
  PREMIUM_BANDS  as MARKET_SCORE_PREMIUM_BANDS,
  labelFor       as MARKET_SCORE_LABEL_FOR,
};
