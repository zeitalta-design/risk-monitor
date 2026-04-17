/**
 * 入札ドメインの Collector 登録簿。
 *
 * 新しい Collector はここに import して NYUSATSU_COLLECTORS に追加する。
 * 中央省庁を省庁ごとに分離する際は `central-ministries` を展開する。
 */
import kkj from "./kkj.js";
import centralMinistries from "./central-ministries.js";
import pPortalResults from "./p-portal-results.js";

/** @type {import("../../types.js").Collector[]} */
export const NYUSATSU_COLLECTORS = [
  kkj,
  centralMinistries,
  pPortalResults,
];

export default NYUSATSU_COLLECTORS;
