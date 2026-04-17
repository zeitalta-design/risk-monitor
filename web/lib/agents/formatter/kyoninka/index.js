/**
 * 許認可ドメイン Formatter 登録簿（nyusatsu / hojokin と同形）
 */
import gbizinfoFormat from "./gbizinfo.js";

/** @type {Record<string, (raw: any, ctx?: any) => any>} */
export const KYONINKA_FORMATTERS = {
  "kyoninka.gbizinfo": gbizinfoFormat,
};

export function getFormatter(collectorId) {
  return KYONINKA_FORMATTERS[collectorId] ?? null;
}

export default KYONINKA_FORMATTERS;
