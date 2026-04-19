/**
 * Analyzer: Entity Momentum Score（Phase H Step 1）
 *
 * 目的: 「この企業は強いか / 伸びているか」を 0〜100 の 1 指標で判定できるようにする。
 *
 * ポリシー:
 *   - 新しい重集計は作らず、既存 analyzer を再利用する
 *     （ranking-diff / entity yearly-stats）
 *   - fuzzy / LIKE / LLM / issuer 正規化は不使用
 *   - 合成ロジックは完全に説明可能（ブラックボックス禁止）
 *     各 component の元値・スコア・重みを全て API レスポンスに入れる
 *   - 0〜100 の線形 clamp。後でチューニングできるように weight / 閾値を上に出す
 *
 * 合成式:
 *   score = 0.5 * rank_momentum + 0.3 * volume_growth + 0.2 * amount_strength
 *   component が null（測定不能）の場合は中立 50 として合成に参加させる
 *   （これを 0 扱いにすると「新規 entity は全員低スコア」になってしまうため）
 */

import { fetchRankingDiff } from "./ranking-diff.js";
import { fetchEntityLookup, fetchEntityYearlyStats } from "./entity-detail.js";

// rank diff 取得時の TOP-N。この外に落ちる entity は rank_momentum=null（中立扱い）。
const RANK_LOOKUP_LIMIT = 500;

// 合成時の重み（後でチューニングしやすいように定数化）
const WEIGHTS = {
  rank_momentum:   0.5,
  volume_growth:   0.3,
  amount_strength: 0.2,
};

function clamp100(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

// rank_diff → 0..100 （+50以上=100, 0=50, -50以下=0）
// 1 ランクの上昇 = +1 点。線形で直感的。
function scoreRankMomentum(rankDiff) {
  if (rankDiff == null) return null; // TOP-500 外 / new_entry で測定不能
  return clamp100(50 + rankDiff);
}

// 件数成長率 → 0..100 （+100%=100, 0%=50, -50%=0）
function scoreVolumeGrowth(current, prev) {
  if (prev == null || prev <= 0) {
    // new_entry: 前年 0 件 → 今年 >0 なら最大評価、両方 0 なら中立
    if (current > 0) return 100;
    return 50;
  }
  const g = (current - prev) / prev; // -1 .. +∞
  return clamp100(50 + g * 50);
}

// 平均落札額 → 0..100（Step 1 の帯定義に揃えた段階評価）
// 各帯の中央値イメージでざっくりマッピング。1億以上＝95、10万以下＝10。
function scoreAmountStrength(avgAmount) {
  if (!avgAmount || avgAmount <= 0) return null; // 不明
  if (avgAmount <=      100000) return 10;  // 〜10万
  if (avgAmount <=      500000) return 25;  // 10〜50万
  if (avgAmount <=     1000000) return 40;  // 50〜100万
  if (avgAmount <=     5000000) return 55;  // 100〜500万
  if (avgAmount <=    10000000) return 65;  // 500〜1000万
  if (avgAmount <=    50000000) return 75;  // 1000〜5000万
  if (avgAmount <=   100000000) return 85;  // 5000万〜1億
  return 95;                                // 1億以上
}

function defaultYears() {
  // 当年はまだデータが揃わないことが多いため、前年 vs 前々年 を比較する。
  // （ダッシュボードの ranking-diff 初期値と同じ発想）
  const y = new Date().getFullYear();
  return { yearCurrent: String(y - 1), yearPrev: String(y - 2) };
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.entityId
 * @param {number|string} [opts.yearCurrent]  未指定: 前年
 * @param {number|string} [opts.yearPrev]     未指定: 前々年
 * @returns {{
 *   entity_id: number,
 *   name: string|null,
 *   year_current: string,
 *   year_prev: string,
 *   score: number,                     // 0..100（clamp 済）
 *   label: string,                     // 非常に強い / 成長中 / 安定 / 下降傾向
 *   components: { rank_momentum: number|null, volume_growth: number|null, amount_strength: number|null },
 *   inputs: {
 *     rank_current: number|null, rank_prev: number|null, rank_diff: number|null,
 *     count_current: number, count_prev: number,
 *     avg_amount_current: number,
 *     rank_lookup_limit: number,
 *   },
 *   weights: typeof WEIGHTS,
 * }}
 */
export function computeEntityMomentumScore({ db, entityId, yearCurrent, yearPrev } = {}) {
  if (!db) throw new TypeError("computeEntityMomentumScore: db is required");
  if (!entityId) throw new TypeError("computeEntityMomentumScore: entityId is required");

  const defaults = defaultYears();
  const yc = String(yearCurrent ?? defaults.yearCurrent);
  const yp = String(yearPrev    ?? defaults.yearPrev);
  if (!/^\d{4}$/.test(yc) || !/^\d{4}$/.test(yp)) {
    throw new TypeError("computeEntityMomentumScore: year must be YYYY");
  }

  // 1) entity + 年度統計（corp/alias で低コスト取得）
  const lookup = fetchEntityLookup({ db, entityId });
  if (!lookup.entity) return null;
  const { entity, targetedParams } = lookup;
  const yearly = fetchEntityYearlyStats({ db, targetedParams });
  const byYear = new Map(yearly.map((y) => [y.year, y]));
  const curRow  = byYear.get(yc);
  const prevRow = byYear.get(yp);
  const count_current      = curRow?.count || 0;
  const count_prev         = prevRow?.count || 0;
  const avg_amount_current = curRow?.avg_amount || 0;

  // 2) rank diff（TOP RANK_LOOKUP_LIMIT。この entity が居れば rank_diff が取れる）
  const diffs = fetchRankingDiff({
    db, yearCurrent: yc, yearPrev: yp, metric: "count", limit: RANK_LOOKUP_LIMIT,
  });
  const mine = diffs.find((d) => d.entity_id === entityId) || null;
  const rank_current = mine?.rank_current ?? null;
  const rank_prev    = mine?.rank_prev    ?? null;
  const rank_diff    = mine?.rank_diff    ?? null;

  // 3) 各 component → 0..100（null 可）
  const rank_momentum   = scoreRankMomentum(rank_diff);
  const volume_growth   = scoreVolumeGrowth(count_current, count_prev);
  const amount_strength = scoreAmountStrength(avg_amount_current);

  // 4) weighted sum。null は中立 50 として合成（測定不能を最低扱いにしない）
  const score = clamp100(
    (rank_momentum   ?? 50) * WEIGHTS.rank_momentum   +
    (volume_growth   ?? 50) * WEIGHTS.volume_growth   +
    (amount_strength ?? 50) * WEIGHTS.amount_strength
  );

  return {
    entity_id: entity.id,
    name: entity.canonical_name,
    year_current: yc,
    year_prev: yp,
    score,
    label: labelForScore(score),
    components: { rank_momentum, volume_growth, amount_strength },
    inputs: {
      rank_current, rank_prev, rank_diff,
      count_current, count_prev,
      avg_amount_current,
      rank_lookup_limit: RANK_LOOKUP_LIMIT,
    },
    weights: { ...WEIGHTS },
  };
}

function labelForScore(score) {
  if (score >= 80) return "非常に強い";
  if (score >= 60) return "成長中";
  if (score >= 40) return "安定";
  return "下降傾向";
}

export { WEIGHTS as ENTITY_SCORE_WEIGHTS, RANK_LOOKUP_LIMIT as ENTITY_SCORE_RANK_LOOKUP_LIMIT };
