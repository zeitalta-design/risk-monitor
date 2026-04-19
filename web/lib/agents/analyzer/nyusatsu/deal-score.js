/**
 * Analyzer: Deal Score（Phase H Step 4 / 4.5 高速化 / 5 issuer / I 先行版 items 対応）
 *
 * 目的: 「この案件を特定企業が追う価値があるか」を 0〜100 で一目判定する。
 *
 * ポリシー:
 *   - 既存 4 スコア（entity / market / category / issuer）を weighted 合成するだけ。
 *     新しい重集計は追加しない（すべて precomputed ベース）
 *   - weights / label 閾値 / reasons ルールは本ファイルに集約して調整可能にする
 *   - component が取得不能な場合は中立 50 として合成（ブラックボックス判定を避ける）
 *   - reasons は決め打ちの if/else。LLM や自然言語生成は使わない
 *   - issuer は完全一致のみ。issuer_dept_hint → issuer_code の優先順位。
 *     識別不能な案件は issuer component を中立 50 にし、reasons にその旨を明記。
 *   - [Phase I 先行] source=items にも対応。落札関連カラム（award_date / award_amount /
 *     winner_*）が無いため該当フィールドは null。score 合成には使わないので問題なし。
 *     category / issuer が欠損する場合は既存の中立 50 ルールで処理。
 *
 * 合成式（Step 5 から、items でも共通）:
 *   score = 0.40 * entity_score
 *         + 0.15 * market_score
 *         + 0.25 * category_score
 *         + 0.20 * issuer_affinity_score
 */

import { computeEntityMomentumScore } from "./entity-score.js";
import { computeMarketTrendScore } from "./market-score.js";
import { computeCategoryMarketScores } from "./category-score.js";
import { computeIssuerAffinityScore } from "./issuer-score.js";
import { resolveIssuerKey } from "../../../nyusatsu-issuer.js";

const WEIGHTS = {
  entity_score:           0.40,
  market_score:           0.15,
  category_score:         0.25,
  issuer_affinity_score:  0.20,
};

// ラベル閾値
function labelFor(score) {
  if (score >= 80) return "非常に有望";
  if (score >= 60) return "有望";
  if (score >= 40) return "検討";
  return "慎重";
}

function clamp100(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/**
 * 案件 1 件を取得（source=results / items 対応）。非公開は除外。
 * 返却は Deal Score 側が使う共通形に正規化する（source 差は呼び出し側に伝える）。
 *
 * @param {{ db: object, dealId: number, source?: "results"|"items" }} opts
 * @returns {null | {
 *   id: number, title: string|null, category: string|null,
 *   date: string|null, amount: number|null,
 *   issuer_name: string|null, issuer_dept_hint: string|null, issuer_code: string|null,
 *   winner_name: string|null, winner_corporate_number: string|null,
 *   slug: string|null, source: "results"|"items",
 * }}
 */
function fetchDealRow({ db, dealId, source = "results" }) {
  if (source === "items") {
    const row = db.prepare(`
      SELECT id, slug, title, category,
             announcement_date, budget_amount,
             issuer_name, issuer_dept_hint, issuer_code
      FROM nyusatsu_items
      WHERE id = @id AND is_published = 1
    `).get({ id: dealId });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug || null,
      title: row.title || null,
      category: row.category || null,
      date: row.announcement_date || null, // items は announcement_date
      amount: row.budget_amount != null ? Number(row.budget_amount) : null, // 予算、score には使わない
      issuer_name: row.issuer_name || null,
      issuer_dept_hint: row.issuer_dept_hint || null,
      issuer_code: row.issuer_code || null,
      winner_name: null,                  // items は落札前
      winner_corporate_number: null,
      source: "items",
    };
  }
  // source === "results"
  const row = db.prepare(`
    SELECT id, title, category, award_date, award_amount,
           issuer_name, issuer_dept_hint, issuer_code,
           winner_name, winner_corporate_number
    FROM nyusatsu_results
    WHERE id = @id AND is_published = 1
  `).get({ id: dealId });
  if (!row) return null;
  return {
    id: row.id,
    slug: null,
    title: row.title || null,
    category: row.category || null,
    date: row.award_date || null,
    amount: row.award_amount != null ? Number(row.award_amount) : null,
    issuer_name: row.issuer_name || null,
    issuer_dept_hint: row.issuer_dept_hint || null,
    issuer_code: row.issuer_code || null,
    winner_name: row.winner_name || null,
    winner_corporate_number: row.winner_corporate_number || null,
    source: "results",
  };
}

/**
 * reasons は 2〜3 行に絞る。各スコアが尖っている場合だけ言及する
 * （何も尖っていなければ「判断材料不足」と正直に返す）。
 */
function buildReasons({ entity, market, category, issuer, dealCategory, issuerResolved }) {
  const reasons = [];

  // entity: 強さ / 弱さの直接言及を最優先
  if (entity?.score >= 70) {
    reasons.push("この企業は直近で上昇傾向（entity score 高）");
  } else if (entity?.score != null && entity.score < 40) {
    reasons.push("この企業は直近で下降傾向（entity score 低）");
  }

  // issuer: 発注元相性（勝率に直結）
  if (!issuerResolved) {
    reasons.push("issuer を十分に識別できないため中立扱い");
  } else if (issuer?.score >= 70) {
    reasons.push("この issuer からの過去受注実績が厚い");
  } else if (issuer?.score != null && issuer.score < 40) {
    reasons.push("この issuer からの受注実績は薄い");
  }

  // category: その案件の業種の強弱
  if (category && dealCategory) {
    if (category.score >= 60) {
      reasons.push(`${dealCategory} 市場は成長市場（category score ${category.score}）`);
    } else if (category.score < 40) {
      reasons.push(`${dealCategory} 市場は減速傾向（category score ${category.score}）`);
    }
  } else if (!dealCategory) {
    reasons.push("案件 category が空欄のため、業種市場評価は中立扱い");
  }

  // market: 全体の追い風 / 逆風
  if (market?.score >= 60 && reasons.length < 4) {
    reasons.push("市場全体は成長市場（market score 高）");
  } else if (market?.score != null && market.score < 40 && reasons.length < 4) {
    reasons.push("市場全体は減速傾向（market score 低）");
  }

  if (reasons.length === 0) {
    reasons.push("各スコアが中位。追加情報で判断を補強することを推奨");
  }
  return reasons;
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.entityId        resolved_entities.id
 * @param {number} [opts.dealId]        nyusatsu_results.id or nyusatsu_items.id
 * @param {number} [opts.resultId]      後方互換: dealId の別名（source=results を強制）
 * @param {"results"|"items"} [opts.source="results"]
 * @param {number|string} [opts.yearCurrent]
 * @param {number|string} [opts.yearPrev]
 * @returns {null | object}
 */
export async function computeDealScore({ db, entityId, dealId, resultId, source, yearCurrent, yearPrev } = {}) {
  if (!db) throw new TypeError("computeDealScore: db is required");
  if (!entityId) throw new TypeError("computeDealScore: entityId is required");

  // 後方互換: resultId が渡れば dealId + source=results 相当
  const effectiveDealId = dealId ?? resultId;
  const effectiveSource = source ?? (resultId != null ? "results" : "results");
  if (!effectiveDealId) throw new TypeError("computeDealScore: dealId (or resultId) is required");
  if (effectiveSource !== "results" && effectiveSource !== "items") {
    throw new TypeError("computeDealScore: source must be 'results' or 'items'");
  }

  const deal = fetchDealRow({ db, dealId: effectiveDealId, source: effectiveSource });
  if (!deal) return null;

  const dealCategory = (deal.category && String(deal.category).trim()) || null;
  const issuerKeyInfo = resolveIssuerKey(deal); // { key, type } | null

  // [Step 4.5] 3 スコア＋[Step 5] issuer で 4 スコアを Promise.all 並列化。
  //   どの component が失敗しても中立 50 で合成を続ける（判定を止めない）。
  const [entity, market, category, issuer] = await Promise.all([
    _safe(() => computeEntityMomentumScore({ db, entityId, yearCurrent, yearPrev })),
    _safe(() => computeMarketTrendScore({ db, yearCurrent, yearPrev })),
    dealCategory
      ? _safe(() => {
          const all = computeCategoryMarketScores({ db, yearCurrent, yearPrev, limit: 1000 });
          return all.items.find((i) => i.category === dealCategory) || null;
        })
      : Promise.resolve(null),
    issuerKeyInfo
      ? _safe(() => computeIssuerAffinityScore({
          db,
          entityId,
          issuerKey:     issuerKeyInfo.key,
          issuerKeyType: issuerKeyInfo.type,
          yearCurrent,
        }))
      : Promise.resolve(null),
  ]);

  const entity_score          = entity?.score   ?? 50;
  const market_score          = market?.score   ?? 50;
  const category_score        = category?.score ?? 50;
  // issuer 識別不能 → 中立 50。識別できた上で実績なし/少なければ issuer.score の値。
  const issuer_affinity_score = issuerKeyInfo ? (issuer?.score ?? 50) : 50;

  const score = clamp100(
    entity_score          * WEIGHTS.entity_score +
    market_score          * WEIGHTS.market_score +
    category_score        * WEIGHTS.category_score +
    issuer_affinity_score * WEIGHTS.issuer_affinity_score
  );

  const years = entity
    ? { current: entity.year_current, prev: entity.year_prev }
    : market
      ? market.years
      : { current: null, prev: null };

  return {
    score,
    label: labelFor(score),
    components: { entity_score, market_score, category_score, issuer_affinity_score },
    weights: { ...WEIGHTS },
    deal: {
      id: deal.id,
      source: deal.source,
      slug: deal.slug || null,
      title: deal.title || null,
      category: dealCategory,
      // results のみ populate（items では null）
      award_date:   deal.source === "results" ? deal.date : null,
      award_amount: deal.source === "results" ? deal.amount : null,
      winner_name:             deal.winner_name || null,
      winner_corporate_number: deal.winner_corporate_number || null,
      // items のみ populate（results では null）
      announcement_date: deal.source === "items" ? deal.date : null,
      budget_amount:     deal.source === "items" ? deal.amount : null,
      // 共通
      issuer_name:     deal.issuer_name || null,
      issuer_key:      issuerKeyInfo?.key  || null,
      issuer_key_type: issuerKeyInfo?.type || null,
    },
    sources: {
      entity:   entity   ? { score: entity.score,   label: entity.label,   components: entity.components,   inputs: entity.inputs   } : null,
      market:   market   ? { score: market.score,   label: market.label,   components: market.components,   inputs: market.inputs   } : null,
      category: category ? { score: category.score, label: category.label, components: category.components, inputs: category.inputs } : null,
      // issuer は識別不能 or 実績なし時も inputs/components を返す（説明可能性）
      issuer:   issuer   ? { score: issuer.score,   label: issuer.label,   components: issuer.components,   inputs: issuer.inputs, issuer: issuer.issuer } : null,
    },
    reasons: buildReasons({ entity, market, category, issuer, dealCategory, issuerResolved: !!issuerKeyInfo }),
    years,
  };
}

function _safe(fn) {
  // 例外吐いても Promise.all を止めず null を返す（中立 50 合成へ）
  return Promise.resolve().then(fn).catch(() => null);
}

export { WEIGHTS as DEAL_SCORE_WEIGHTS };

// Phase J-1.5: batch 版 (deal-score-batch.js) が同じ WEIGHTS / label / reasons ルールを
// 使えるよう、内部ヘルパーを named export する。動作は不変（bundle 共有化専用）。
export {
  labelFor     as dealScoreLabelFor,
  clamp100     as dealScoreClamp100,
  buildReasons as buildDealReasons,
};
