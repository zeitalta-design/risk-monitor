/**
 * 補助金 — J-Grants 取得の薄い互換ラッパー。
 *
 * 実体は Collector/Formatter/Pipeline に分離済:
 *   - agents/collector/hojokin/jgrants.js
 *   - agents/formatter/hojokin/jgrants.js
 *   - agents/pipeline/hojokin.js
 *
 * このファイルは既存コール元（API route / CLI / source registry）との
 * 後方互換のためだけに残す。新規コードは Collector もしくは
 * pipeline を直接呼ぶこと。
 */
import { runJgrantsPipeline, getJgrantsKeywords } from "@/lib/agents/pipeline/hojokin";

export function getHojokinKeywords() {
  return getJgrantsKeywords();
}

/**
 * J-Grants API から補助金を取得し DB に upsert する（互換API）。
 * 戻り値の shape は旧実装と同一。
 *
 * @param {object} opts
 * @param {number} [opts.maxKeywords=15]
 * @param {number} [opts.fetchTimeoutMs=8000]
 * @param {number} [opts.delayMs=500]
 * @param {boolean}[opts.dryRun=false]
 * @returns {Promise<{ok, totalFetched, created, updated, unique, elapsed, errors, dryRun}>}
 */
export async function fetchAndUpsertHojokin(opts = {}) {
  return runJgrantsPipeline(opts);
}
