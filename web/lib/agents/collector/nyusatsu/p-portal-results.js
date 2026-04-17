/**
 * Collector: nyusatsu.p-portal-results
 * 調達ポータル（旧GEPS）落札実績オープンデータ
 *
 * こちらは入札「落札結果」を扱う。公告側（nyusatsu_items）ではなく
 * nyusatsu_results テーブルへの upsert。
 *
 * 既存 lib/nyusatsu-result-fetcher.js 委譲。
 */
import { fetchPPortalResults } from "@/lib/nyusatsu-result-fetcher";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "nyusatsu.p-portal-results",
  domain: "nyusatsu",
  sourceLabel: "調達ポータル 落札実績（オープンデータ）",
  async collect({ dryRun = false, logger = console.log, mode = "diff", date, year } = {}) {
    const start = Date.now();
    try {
      const r = await fetchPPortalResults({ mode, date, year, dryRun, logger });
      return {
        id: "nyusatsu.p-portal-results",
        domain: "nyusatsu",
        sourceLabel: "調達ポータル 落札実績（オープンデータ）",
        status: "ok",
        fetched: r.totalRows || 0,
        inserted: r.inserted || 0,
        updated: r.updated || 0,
        skipped: r.skipped || 0,
        elapsedMs: Date.now() - start,
        extra: { filename: r.filename },
      };
    } catch (e) {
      return {
        id: "nyusatsu.p-portal-results",
        domain: "nyusatsu",
        sourceLabel: "調達ポータル 落札実績（オープンデータ）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
