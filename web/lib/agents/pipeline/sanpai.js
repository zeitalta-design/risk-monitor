/**
 * Pipeline: sanpai ドメイン
 *
 * 現状:
 *   - 旧 `lib/sanpai-fetcher.js` が 9 source （各自治体 / さんぱいくん）
 *     の取得・整形・upsert を一括で担当する。
 *   - 本ファイルは他ドメインと形を揃えるための薄いラッパ。source 別の
 *     Collector 分離は段階的に行う。
 */
import { fetchAndUpsertSanpai } from "@/lib/sanpai-fetcher";

/**
 * 9 source 分の産廃データを収集しDB保存。
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @param {Function}[opts.logger]
 * @returns {Promise<any>} fetchAndUpsertSanpai の戻り値をそのまま返す
 */
export async function runSanpaiAllSourcesPipeline(opts = {}) {
  return fetchAndUpsertSanpai(opts);
}
