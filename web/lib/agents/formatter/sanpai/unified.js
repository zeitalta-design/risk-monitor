/**
 * Formatter: sanpai.unified
 * 産廃 9 ソース（Osaka/Kanagawa/Tokyo/Hokkaido/Chiba/Saitama/Fukuoka/Aichi/さんぱいくん）の
 * 生レコード → 統一スキーマ
 *
 * 現状:
 *   - 旧 `lib/sanpai-fetcher.js` は 9 ソースそれぞれのパーサを内部に抱え、
 *     得られたレコードを sanpai_items に直接 upsert している。
 *   - このモジュールは「責務表示」のための純粋関数だけ先行して切り出す。
 *     各 source を個別 Collector に分けるのは Phase 3 以降で予定。
 *   - nyusatsu / hojokin / kyoninka と同形。
 */

export const SOURCE_ID = "sanpai.unified";

/**
 * 統一された産廃レコード（sanpai-fetcher が全 source で作る形） → unified schema
 * @param {Object} raw  sanpai_items に書き込む直前の shape
 * @returns {{
 *   source: string, title: string|null, organization: string|null,
 *   published_at: string|null, deadline: string|null,
 *   detail_url: string|null, raw: Object
 * }}
 */
export function format(raw) {
  if (!raw || typeof raw !== "object") {
    throw new TypeError("format: raw record is required");
  }
  return {
    source: SOURCE_ID,
    title: raw.company_name || null,
    organization: raw.company_name || null,
    published_at: toIsoDate(raw.latest_penalty_date),
    deadline: null,
    detail_url: raw.detail_url || null,
    raw,
  };
}

export default format;

function toIsoDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
