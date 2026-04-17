/**
 * Collector: sanpai.all-sources
 * 産廃 9 source の一括取得（自治体 8 + さんぱいくん）
 *
 * 現状は旧 sanpai-fetcher をそのまま呼ぶ。将来 source 別に Collector を
 * 分離する際はこのファイルを参考にして複製する。
 */
import { runSanpaiAllSourcesPipeline } from "@/lib/agents/pipeline/sanpai";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "sanpai.all-sources",
  domain: "sanpai",
  sourceLabel: "産廃 9 ソース一括（自治体8 + さんぱいくん）",
  async collect({ dryRun = false, logger = console.log } = {}) {
    const start = Date.now();
    try {
      const r = await runSanpaiAllSourcesPipeline({ dryRun, logger });
      return {
        id: "sanpai.all-sources",
        domain: "sanpai",
        sourceLabel: "産廃 9 ソース一括（自治体8 + さんぱいくん）",
        status: r?.ok === false ? "error" : "ok",
        fetched: r?.totalFetched ?? 0,
        inserted: r?.created ?? 0,
        updated: r?.updated ?? 0,
        skipped: r?.skipped ?? 0,
        elapsedMs: Date.now() - start,
        extra: r,
      };
    } catch (e) {
      return {
        id: "sanpai.all-sources",
        domain: "sanpai",
        sourceLabel: "産廃 9 ソース一括（自治体8 + さんぱいくん）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
