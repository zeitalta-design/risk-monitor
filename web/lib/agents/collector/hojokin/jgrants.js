/**
 * Collector: hojokin.jgrants
 * J-Grants 公開API（全キーワード）による補助金公募情報
 *
 * 新パイプライン経由: runJgrantsPipeline が内部で
 *   キーワードループ → API fetch → processJgrantsRecords → upsert
 * を実行する。
 */
import { runJgrantsPipeline } from "@/lib/agents/pipeline/hojokin";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "hojokin.jgrants",
  domain: "hojokin",
  sourceLabel: "J-Grants（経済産業省）",
  async collect({
    dryRun = false,
    logger = console.log,
    maxKeywords = 15,
    fetchTimeoutMs = 8000,
    delayMs = 500,
  } = {}) {
    const start = Date.now();
    try {
      const r = await runJgrantsPipeline({ maxKeywords, fetchTimeoutMs, delayMs, dryRun, logger });
      return {
        id: "hojokin.jgrants",
        domain: "hojokin",
        sourceLabel: "J-Grants（経済産業省）",
        status: "ok",
        fetched: r.totalFetched || 0,
        inserted: r.created || 0,
        updated: r.updated || 0,
        skipped: r.skipped || 0,
        elapsedMs: Date.now() - start,
        extra: { unique: r.unique, errors: r.errors },
      };
    } catch (e) {
      return {
        id: "hojokin.jgrants",
        domain: "hojokin",
        sourceLabel: "J-Grants（経済産業省）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
