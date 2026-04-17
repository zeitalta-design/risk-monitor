/**
 * 全 Collector のグローバル登録簿と列挙 API。
 *
 * 新ドメイン追加時:
 *   1. collector/{domain}/ を作り Collector 群を定義
 *   2. collector/{domain}/index.js で配列 export
 *   3. このファイルで import + ALL_COLLECTORS に push
 */
import NYUSATSU_COLLECTORS from "./nyusatsu/index.js";

/** @type {import("../types.js").Collector[]} */
export const ALL_COLLECTORS = [
  ...NYUSATSU_COLLECTORS,
];

/**
 * 条件に合う Collector を列挙。
 *
 * @param {{ domain?: string, id?: string }} [filter]
 * @returns {import("../types.js").Collector[]}
 */
export function listCollectors(filter = {}) {
  return ALL_COLLECTORS.filter((c) => {
    if (filter.domain && c.domain !== filter.domain) return false;
    if (filter.id && c.id !== filter.id) return false;
    return true;
  });
}

/**
 * 指定 id の Collector を 1 件取得。
 *
 * @param {string} id
 * @returns {import("../types.js").Collector | null}
 */
export function getCollector(id) {
  return ALL_COLLECTORS.find((c) => c.id === id) ?? null;
}
