/**
 * Pipeline: kyoninka ドメイン
 *
 * 役割: 許認可データの取得〜DB 書込みを orchestrate する。
 *
 * 現状:
 *   - 旧 `lib/kyoninka-fetcher.js` が fetch + 解決 + format + upsert を
 *     一括で持つ。Resolver（法人番号解決）を内部に抱えており、責務分離
 *     には本格的なリファクタが必要。
 *   - 本ファイルは「他ドメインと形を揃える」ための薄いラッパ。既存 fetcher
 *     をそのまま呼び、戻り値だけ pipeline 共通 shape に揃える。
 *   - format() は agents/formatter/kyoninka/gbizinfo に分離済。フル配線は
 *     Phase 3 以降の段階的リファクタで実施予定。
 */
import { fetchAndUpsertKyoninka } from "@/lib/kyoninka-fetcher";

/**
 * gBizINFO 経由で許認可情報を収集しDB保存。
 *
 * @param {object} [opts]
 * @param {number}  [opts.limit=50]
 * @param {boolean} [opts.onlyMissing=true]
 * @param {boolean} [opts.dryRun=false]
 * @param {"actions"|"sanpai"|"all"} [opts.source="actions"]
 * @param {Function}[opts.logger]
 * @returns {Promise<{ ok: boolean, processed: number, resolved: number,
 *   certFetched: number, created: number, updated: number,
 *   errors: any[], elapsed: number|string, source: string }>}
 */
export async function runGbizinfoPipeline(opts = {}) {
  return fetchAndUpsertKyoninka(opts);
}
