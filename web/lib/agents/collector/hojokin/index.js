/**
 * 補助金ドメインの Collector 登録簿。
 *
 * 新しい Collector（自治体補助金等）はここに import して
 * HOJOKIN_COLLECTORS に追加する。
 */
import jgrants from "./jgrants.js";

/** @type {import("../../types.js").Collector[]} */
export const HOJOKIN_COLLECTORS = [
  jgrants,
];

export default HOJOKIN_COLLECTORS;
