/**
 * Resolver 層のエントリ集約
 */
export {
  canonicalizeCompanyName,
  normalizeCompanyKey,
  levenshtein,
  similarity,
} from "./normalize.js";

export { lookupCorporateNumber } from "./gbizinfo.js";

export {
  resolveEntity,
  createDataStore,
  DEFAULT_FUZZY_THRESHOLD,
} from "./resolve.js";

export {
  assignClusters,
  DEFAULT_PREFIX_LEN,
  DEFAULT_SIM_THRESHOLD,
} from "./cluster.js";
