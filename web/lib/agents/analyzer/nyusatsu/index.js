/**
 * 入札ドメイン Analyzer のエントリ集約。
 * Resolver 済みデータ (resolved_entities / entity_clusters / resolution_aliases) を
 * 前提に、ランキング・時系列・発注機関関係性を計算する純関数群。
 *
 * Step 1 分析深掘り追加:
 *   - 金額帯分布 (amount-bands)
 *   - 年度別推移 (yearly-stats)
 *   - 業種 × 年度 マトリクス (category-year)
 */
export { getAwardRanking }   from "./ranking.js";
export { getAwardTimeline }  from "./timeline.js";
export { getBuyerRelations } from "./buyer-relations.js";
export { RESOLVED_RESULTS_SQL, buildFilters } from "./resolved.js";

export {
  getAwardAmountBandDistribution,
  BAND_ORDER,
} from "./amount-bands.js";

export { getYearlyStats } from "./yearly-stats.js";

export {
  getCategoryYearMatrix,
  CATEGORY_MATRIX_UNCATEGORIZED,
  CATEGORY_MATRIX_OTHER,
} from "./category-year.js";

export {
  getCategoryBandMatrix,
  CATEGORY_BAND_UNCATEGORIZED,
  CATEGORY_BAND_OTHER,
} from "./category-band.js";

export { fetchRankingDiff } from "./ranking-diff.js";

export { fetchBandYearMatrix } from "./band-year.js";

export {
  hasYearlyRankForYears,
  fetchYearlyEntityRanking,
} from "./yearly-rank.js";

export {
  computeEntityMomentumScore,
  ENTITY_SCORE_WEIGHTS,
  ENTITY_SCORE_RANK_LOOKUP_LIMIT,
} from "./entity-score.js";

export {
  computeMarketTrendScore,
  composeTrendScore,
  MARKET_SCORE_WEIGHTS,
  MARKET_SCORE_PREMIUM_BANDS,
  MARKET_SCORE_LABEL_FOR,
} from "./market-score.js";

export {
  computeCategoryMarketScores,
  CATEGORY_SCORE_WEIGHTS,
  CATEGORY_SCORE_UNCATEGORIZED,
  CATEGORY_SCORE_PREMIUM_THRESHOLD,
} from "./category-score.js";

export {
  computeDealScore,
  DEAL_SCORE_WEIGHTS,
  dealScoreLabelFor,
  dealScoreClamp100,
  buildDealReasons,
} from "./deal-score.js";

export { computeTopDealScores, computeDealScoreMap } from "./deal-score-batch.js";

export {
  computeIssuerAffinityScore,
  ISSUER_SCORE_WEIGHTS,
} from "./issuer-score.js";

export {
  hasCategoryYearlyForYears,
  fetchCategoryYearlySnapshot,
  marketInputsFromSnapshot,
  categoryInputsFromSnapshot,
} from "./category-yearly.js";
