/**
 * 補助金ドメイン Formatter 登録簿。
 *
 * Collector id ごとに対応する formatter を引ける形にしておく。
 * （nyusatsu と同形）
 */
import jgrantsFormat from "./jgrants.js";

/** @type {Record<string, (raw: any) => any>} */
export const HOJOKIN_FORMATTERS = {
  "hojokin.jgrants": jgrantsFormat,
};

/**
 * Collector id からこのドメインの formatter を取得
 * @param {string} collectorId
 * @returns {((raw: any) => any) | null}
 */
export function getFormatter(collectorId) {
  return HOJOKIN_FORMATTERS[collectorId] ?? null;
}

export default HOJOKIN_FORMATTERS;
