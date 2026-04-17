/**
 * QA 層のエントリ集約
 * 日次 snapshot 記録 + 全チェックを一括実行。
 */
export {
  createQaStore,
  todayJst,
  daysAgoJst,
} from "./store.js";

export {
  NYUSATSU_COUNT_METRICS,
  CAPACITY_METRICS,
  captureCountSnapshots,
  checkDelta,
  checkFreshness,
  checkResolverGrowth,
  checkApiHealth,
  checkCapacity,
} from "./checks.js";

/**
 * 全チェックの一括実行（入札ドメインのデフォルト構成）。
 *
 * @param {object} opts
 * @param {object} opts.db
 * @param {object} [opts.analyzer]  getAwardRanking/getAwardTimeline を持つモジュール
 * @param {string} [opts.day]       captured_on（JST YYYY-MM-DD）
 * @returns {{ day: string, snapshots: number, findings: Array }}
 */
export async function runAllChecks({ db, analyzer, day } = {}) {
  if (!db) throw new TypeError("runAllChecks: db is required");
  const { createQaStore, todayJst } = await import("./store.js");
  const checks = await import("./checks.js");
  const store = createQaStore(db);
  const theDay = day || todayJst();

  // 1) count snapshots
  const snapshots = checks.captureCountSnapshots({ db, store, day: theDay });

  // 2) capacity snapshots + 閾値チェック
  const capacity = checks.checkCapacity({ db, store, day: theDay });

  // 3) freshness (sync_runs 経由)
  const freshness = checks.checkFreshness({ db, store, day: theDay });

  // 4) delta（前日比） — count メトリクス全般
  const delta = checks.checkDelta({ store, day: theDay });

  // 5) resolver 増分（delta と一部重複するが resolver 観点で別記録）
  const resolverGrowth = checks.checkResolverGrowth({ store, day: theDay });

  // 6) Analyzer API 健全性（analyzer が渡されていれば）
  const apiHealth = analyzer
    ? checks.checkApiHealth({ db, store, day: theDay, analyzer })
    : [];

  // 当日の findings を返す（集計用）
  const findings = db.prepare(
    "SELECT severity, category, metric, message FROM qa_findings WHERE captured_on = ? ORDER BY id DESC"
  ).all(theDay);

  return {
    day: theDay,
    snapshots: snapshots.length,
    capacity,
    freshness,
    delta,
    resolverGrowth,
    apiHealth,
    findings,
  };
}
