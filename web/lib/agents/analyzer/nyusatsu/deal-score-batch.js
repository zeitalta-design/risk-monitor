/**
 * Analyzer: Deal Score（Phase J-1.5 batch 版）
 *
 * 目的: `/api/nyusatsu/analytics/deals/top` 専用に、
 *   entity × 候補 N 件の Deal Score を「共通 bundle + 案件差分」で高速計算する。
 *
 * ポリシー（単体 computeDealScore との互換維持）:
 *   - WEIGHTS / label 閾値 / reasons ルールは単体版 (deal-score.js) の named export を再利用
 *   - 合成式・中立 50 ルール・issuer 識別不能時の扱いは完全に同一
 *   - fuzzy / LIKE / LLM / issuer 推定なし
 *   - 単体 computeDealScore は壊さない（並列・本ファイル・batch route 以外で利用されている）
 *
 * 計算方針:
 *   1. entity_score / market_score を 1 回だけ取得（全候補で共通）
 *   2. category_score は 全カテゴリ一括取得 → Map 化（候補ごとに lookup）
 *   3. issuer_score だけ案件依存だが、同一 issuerKey は memoize
 *   4. 各候補で weighted 合成 + reasons 生成
 *   5. minScore フィルタ → score DESC ソート → limit 件返却
 */

import { computeEntityMomentumScore } from "./entity-score.js";
import { computeMarketTrendScore }    from "./market-score.js";
import { computeCategoryMarketScores } from "./category-score.js";
import { computeIssuerAffinityScore } from "./issuer-score.js";
import {
  DEAL_SCORE_WEIGHTS,
  dealScoreLabelFor,
  dealScoreClamp100,
  buildDealReasons,
} from "./deal-score.js";
import { resolveIssuerKey } from "../../../nyusatsu-issuer.js";

// 候補 N 件の category は同種が繰り返される前提。全カテゴリを 1 回で取りきる十分な上限。
const CATEGORY_LIMIT = 10_000;

function _safe(fn) {
  // 例外を握り潰し null を返す（単体版と同じ「中立 50 合成」挙動を保つため）
  return Promise.resolve().then(fn).catch(() => null);
}

/**
 * @typedef {object} DealCandidate
 * @property {number} id
 * @property {string|null} slug
 * @property {string|null} title
 * @property {string|null} category
 * @property {string|null} date
 * @property {string|null} issuer_name
 * @property {string|null} issuer_dept_hint
 * @property {string|null} issuer_code
 */

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.entityId
 * @param {DealCandidate[]} opts.items   候補案件（呼び出し側で SQL 取得済み）
 * @param {number} [opts.minScore=70]
 * @param {number} [opts.limit=20]
 * @param {string|number} [opts.yearCurrent]
 * @param {string|number} [opts.yearPrev]
 * @returns {Promise<{
 *   items: Array<{
 *     id:number, slug:string|null, title:string|null, category:string|null,
 *     date:string|null, score:number, label:string,
 *     issuer:{ dept_hint:string|null, code:string|null },
 *     reasons:string[],
 *     components:{ entity_score:number, market_score:number, category_score:number, issuer_affinity_score:number },
 *   }>,
 *   stats: { total:number, passed:number, returned:number },
 *   shared: { entity_score:number, market_score:number, years:{current:string|null, prev:string|null} },
 * }>}
 */
// 共通コア: 候補 items[] を score 化して返す（filter / sort / limit はしない）。
// computeTopDealScores（ランキング）と computeDealScoreMap（一覧バッジ）の両方で再利用。
async function _scoreCandidatesCore({ db, entityId, items, yearCurrent, yearPrev }) {
  const list = Array.isArray(items) ? items : [];

  // ---------- Step 1: 共通 bundle（1 回のみ）----------
  const [entity, market, catResp] = await Promise.all([
    _safe(() => computeEntityMomentumScore({ db, entityId, yearCurrent, yearPrev })),
    _safe(() => computeMarketTrendScore({ db, yearCurrent, yearPrev })),
    _safe(() => computeCategoryMarketScores({ db, yearCurrent, yearPrev, limit: CATEGORY_LIMIT })),
  ]);

  const entity_score = entity?.score ?? 50;
  const market_score = market?.score ?? 50;

  const categoryMap = new Map();
  if (catResp?.items) {
    for (const c of catResp.items) {
      if (c && c.category) categoryMap.set(c.category, c);
    }
  }

  const issuerCache = new Map();
  function getIssuerScoreCached(issuerKeyInfo) {
    if (!issuerKeyInfo) return Promise.resolve(null);
    const cacheKey = `${issuerKeyInfo.type}:${issuerKeyInfo.key}`;
    if (issuerCache.has(cacheKey)) return issuerCache.get(cacheKey);
    const p = _safe(() => computeIssuerAffinityScore({
      db, entityId,
      issuerKey:     issuerKeyInfo.key,
      issuerKeyType: issuerKeyInfo.type,
      yearCurrent,
    }));
    issuerCache.set(cacheKey, p);
    return p;
  }

  // ---------- Step 2: 案件ごとの合成 ----------
  const scored = await Promise.all(list.map(async (it) => {
    const dealCategory = (it.category && String(it.category).trim()) || null;
    const issuerKeyInfo = resolveIssuerKey({
      issuer_dept_hint: it.issuer_dept_hint,
      issuer_code:      it.issuer_code,
    });

    const category = dealCategory ? (categoryMap.get(dealCategory) || null) : null;
    const issuer   = await getIssuerScoreCached(issuerKeyInfo);

    const category_score        = category?.score ?? 50;
    const issuer_affinity_score = issuerKeyInfo ? (issuer?.score ?? 50) : 50;

    const score = dealScoreClamp100(
      entity_score          * DEAL_SCORE_WEIGHTS.entity_score +
      market_score          * DEAL_SCORE_WEIGHTS.market_score +
      category_score        * DEAL_SCORE_WEIGHTS.category_score +
      issuer_affinity_score * DEAL_SCORE_WEIGHTS.issuer_affinity_score
    );

    const reasons = buildDealReasons({
      entity, market, category, issuer,
      dealCategory,
      issuerResolved: !!issuerKeyInfo,
    });

    return {
      id: it.id,
      slug: it.slug || null,
      title: it.title || null,
      category: dealCategory,
      date: it.date || null,
      score,
      label: dealScoreLabelFor(score),
      issuer: {
        dept_hint: it.issuer_dept_hint || null,
        code:      it.issuer_code      || null,
      },
      reasons,
      components: { entity_score, market_score, category_score, issuer_affinity_score },
    };
  }));

  const years = entity
    ? { current: entity.year_current ?? null, prev: entity.year_prev ?? null }
    : market
      ? market.years || { current: null, prev: null }
      : { current: null, prev: null };

  return { scored, entity_score, market_score, years };
}

export async function computeTopDealScores({
  db, entityId, items,
  minScore = 70, limit = 20,
  yearCurrent, yearPrev,
} = {}) {
  if (!db) throw new TypeError("computeTopDealScores: db is required");
  if (!entityId) throw new TypeError("computeTopDealScores: entityId is required");

  const { scored, entity_score, market_score, years } = await _scoreCandidatesCore({
    db, entityId, items, yearCurrent, yearPrev,
  });

  // ---------- Step 3: フィルタ → ソート → limit ----------
  const passedAll = scored.filter((r) => r.score >= minScore);
  const top = passedAll
    .slice() // 非破壊
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    items: top,
    stats: { total: scored.length, passed: passedAll.length, returned: top.length },
    shared: { entity_score, market_score, years },
  };
}

/**
 * Phase J-5 / J-13: 一覧バッジ用の軽量 score map。
 * 指定 items 全件を score 化し、filter / sort / limit しないで返す。
 * Phase J-13: UI の tooltip / 通知文面で「有望な理由」を 1 行出すため `topReason`
 * を添える（reasons[0]、どの要因も尖っていない場合は null）。
 * @returns {Promise<Array<{ id:number, score:number, label:string, topReason:string|null }>>}
 */
export async function computeDealScoreMap({
  db, entityId, items,
  yearCurrent, yearPrev,
} = {}) {
  if (!db) throw new TypeError("computeDealScoreMap: db is required");
  if (!entityId) throw new TypeError("computeDealScoreMap: entityId is required");

  const { scored } = await _scoreCandidatesCore({
    db, entityId, items, yearCurrent, yearPrev,
  });
  return scored.map((r) => ({
    id:        r.id,
    score:     r.score,
    label:     r.label,
    topReason: pickTopReason(r.reasons),
  }));
}

// Phase J-13: reasons[] から UI 表示用の 1 行を選ぶ。
//   - buildDealReasons は「根拠が尖っていない場合」は `各スコアが中位。...` のような
//     判定不能メッセージを返す。それは tooltip / 通知には無意味なので null 化する。
//   - 逆に実際の要因が 1 件でもあれば配列先頭（優先度順に並んでいる）を使う。
function pickTopReason(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return null;
  const head = String(reasons[0] || "");
  if (!head) return null;
  if (head.startsWith("各スコアが中位")) return null;
  return head;
}
