/**
 * Formatter: kyoninka.gbizinfo
 * gBizINFO certification レスポンス → 統一スキーマ
 *
 * 入力: `gbizinfo-client.normalizeCertification()` が返す 1件
 *   { licenseTitle, licensingAuthority, licenseNumber,
 *     licenseBeginDate, licenseEndDate, licenseAuthorityDistrict,
 *     licenseAuthorityPrefecture, ... }
 *
 * 出力: 統一スキーマ（最小7フィールド + raw）
 *   nyusatsu / hojokin Formatter と同形。
 *
 * ※ 現在は旧 kyoninka-fetcher.js が DB 書き込みまで一括で担当しているが、
 *    責務明示のため format() だけ先行して切り出す。実 pipeline に載るのは
 *    Resolver 導入後の段階で予定。
 */

export const SOURCE_ID = "kyoninka.gbizinfo";

/**
 * @param {Object} cert  - normalizeCertification が返す 1 件
 * @param {Object} [entity] - 付随する法人情報（displayName 等）
 * @returns {{
 *   source: string, title: string|null, organization: string|null,
 *   published_at: string|null, deadline: string|null,
 *   detail_url: string|null, raw: Object
 * }}
 */
export function format(cert, entity = null) {
  if (!cert || typeof cert !== "object") {
    throw new TypeError("format: cert record is required");
  }
  return {
    source: SOURCE_ID,
    title: cert.licenseTitle || null,
    organization: entity?.displayName || cert.licensingAuthority || null,
    published_at: toIsoDate(cert.licenseBeginDate),
    deadline: toIsoDate(cert.licenseEndDate),
    detail_url: entity?.corporateNumber
      ? `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${entity.corporateNumber}`
      : null,
    raw: { cert, entity },
  };
}

export default format;

function toIsoDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
