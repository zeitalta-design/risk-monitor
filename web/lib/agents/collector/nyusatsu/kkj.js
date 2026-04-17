/**
 * Collector: nyusatsu.kkj
 * 官公需情報ポータル（中小企業庁）— 全国47都道府県の入札公告
 *
 * 現時点は既存 lib/nyusatsu-kkj-fetcher.js を委譲呼出し。
 * Formatter 層実装時に生レコード返却型へ移行予定。
 */
import { fetchKkjAnnouncements } from "@/lib/nyusatsu-kkj-fetcher";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "nyusatsu.kkj",
  domain: "nyusatsu",
  sourceLabel: "官公需情報ポータル（中小企業庁）",
  async collect({ dryRun = false, logger = console.log, mode = "daily", fromDate, toDate, lgCodes } = {}) {
    const start = Date.now();
    try {
      const r = await fetchKkjAnnouncements({ mode, fromDate, toDate, lgCodes, dryRun, logger });
      return {
        id: "nyusatsu.kkj",
        domain: "nyusatsu",
        sourceLabel: "官公需情報ポータル（中小企業庁）",
        status: "ok",
        fetched: r.totalFetched || 0,
        inserted: r.inserted || 0,
        updated: r.updated || 0,
        skipped: r.skipped || 0,
        elapsedMs: Date.now() - start,
        extra: { dateRange: r.dateRange, perDay: r.perDay },
      };
    } catch (e) {
      return {
        id: "nyusatsu.kkj",
        domain: "nyusatsu",
        sourceLabel: "官公需情報ポータル（中小企業庁）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
