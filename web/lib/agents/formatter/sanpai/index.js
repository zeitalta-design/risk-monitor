/**
 * 産廃ドメイン Formatter 登録簿。
 * 将来 source 別に分離した際はここに追加していく。
 */
import unifiedFormat from "./unified.js";

/** @type {Record<string, (raw: any) => any>} */
export const SANPAI_FORMATTERS = {
  "sanpai.unified": unifiedFormat,
};

export function getFormatter(collectorId) {
  return SANPAI_FORMATTERS[collectorId] ?? null;
}

export default SANPAI_FORMATTERS;
