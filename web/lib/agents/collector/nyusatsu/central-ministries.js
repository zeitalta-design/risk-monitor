/**
 * Collector: nyusatsu.central-ministries
 * 中央省庁 6省庁（農水省・経産省・総務省・厚労省・国交省・環境省）の入札公告
 *
 * 既存 lib/nyusatsu-fetcher.js 委譲。
 * 次フェーズで省庁ごとに分離する予定（Collectorは1責務が原則のため）。
 */
import { fetchAndUpsertNyusatsu } from "@/lib/nyusatsu-fetcher";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "nyusatsu.central-ministries",
  domain: "nyusatsu",
  sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
  async collect({ dryRun = false, logger = console.log } = {}) {
    const start = Date.now();
    try {
      const r = await fetchAndUpsertNyusatsu({ dryRun, logger });
      return {
        id: "nyusatsu.central-ministries",
        domain: "nyusatsu",
        sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
        status: "ok",
        fetched: r.allRows?.length ?? r.totalFetched ?? 0,
        inserted: r.inserted || 0,
        updated: r.updated || 0,
        skipped: r.skipped || 0,
        elapsedMs: Date.now() - start,
        extra: { perSource: r.perSource },
      };
    } catch (e) {
      return {
        id: "nyusatsu.central-ministries",
        domain: "nyusatsu",
        sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
