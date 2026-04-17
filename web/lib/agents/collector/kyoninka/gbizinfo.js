/**
 * Collector: kyoninka.gbizinfo
 * gBizINFO 経由の許認可・届出認定情報
 *
 * 新パイプライン経由: runGbizinfoPipeline が内部で
 *   対象企業取得 → 法人番号解決 → certification 取得 → upsert
 * を実行する。
 */
import { runGbizinfoPipeline } from "@/lib/agents/pipeline/kyoninka";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "kyoninka.gbizinfo",
  domain: "kyoninka",
  sourceLabel: "gBizINFO（経済産業省）",
  async collect({
    dryRun = false,
    logger = console.log,
    limit = 50,
    onlyMissing = true,
    source = "actions",
  } = {}) {
    const start = Date.now();
    try {
      const r = await runGbizinfoPipeline({ limit, onlyMissing, dryRun, source, logger });
      return {
        id: "kyoninka.gbizinfo",
        domain: "kyoninka",
        sourceLabel: "gBizINFO（経済産業省）",
        status: r.ok === false ? "error" : "ok",
        fetched: r.certFetched || 0,
        inserted: r.created || 0,
        updated: r.updated || 0,
        skipped: Math.max(0, (r.processed || 0) - (r.resolved || 0)),
        elapsedMs: Date.now() - start,
        extra: { processed: r.processed, resolved: r.resolved, source: r.source },
      };
    } catch (e) {
      return {
        id: "kyoninka.gbizinfo",
        domain: "kyoninka",
        sourceLabel: "gBizINFO（経済産業省）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
