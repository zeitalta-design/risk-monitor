/**
 * Formatter: hojokin.jgrants
 * J-Grants API の生レコード → 統一スキーマ
 *
 * 入力: J-Grants `/public/subsidies` の result 配列要素
 *   { id, title, use_purpose, subsidy_max_limit, subsidy_rate,
 *     acceptance_start_datetime, acceptance_end_datetime,
 *     subsidy_executing_organization_name_ja, target,
 *     target_number_of_employees, outline, ... }
 *
 * 出力: 統一スキーマ（最小7フィールド + raw）
 *   nyusatsu Formatter と同形にしておき、Resolver/Analyzer 層に
 *   ドメイン差分を漏らさない。
 */

export const SOURCE_ID = "hojokin.jgrants";

const JGRANTS_DETAIL_BASE = "https://www.jgrants-portal.go.jp/subsidy/";

/**
 * @param {Object} raw  - J-Grants API result[] の 1 要素
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
  const organization =
    raw.subsidy_executing_organization_name_ja || raw.target || null;
  return {
    source: SOURCE_ID,
    title: raw.title ? String(raw.title) : null,
    organization: organization ? String(organization) : null,
    published_at: toIsoDate(raw.acceptance_start_datetime),
    deadline: toIsoDate(raw.acceptance_end_datetime),
    detail_url: raw.id ? `${JGRANTS_DETAIL_BASE}${raw.id}` : null,
    raw,
  };
}

export default format;

// ─── 推論ヘルパー（hojokin_items のカラム値導出） ─────────────────────
// 旧 hojokin-fetcher.js から責務ごと移設。pipeline 側から参照する。

/**
 * タイトル + 概要 → カテゴリコード
 * @param {{title?: string, use_purpose?: string}} raw
 */
export function inferCategory(raw) {
  const text = `${raw.title || ""} ${raw.use_purpose || ""}`;
  if (/IT|DX|デジタル|システム|情報/.test(text)) return "it";
  if (/ものづくり|設備|製造|生産/.test(text)) return "equipment";
  if (/研究開発|R&D|技術開発/.test(text)) return "rd";
  if (/雇用|人材|従業員/.test(text)) return "employment";
  if (/海外|輸出|グローバル/.test(text)) return "export";
  if (/創業|起業|スタートアップ/.test(text)) return "startup";
  return "other";
}

/**
 * 対象事業者タイプ
 * @param {{target_number_of_employees?: string, title?: string}} raw
 */
export function inferTargetType(raw) {
  const text = `${raw.target_number_of_employees || ""} ${raw.title || ""}`;
  if (/スタートアップ|ベンチャー|創業/.test(text)) return "startup";
  if (/NPO|非営利/.test(text)) return "npo";
  return "corp";
}

/**
 * 受付ステータス（open / upcoming / closed）
 * @param {{acceptance_start_datetime?: string, acceptance_end_datetime?: string}} raw
 * @param {Date} [now]
 */
export function inferStatus(raw, now = new Date()) {
  const end = raw.acceptance_end_datetime ? new Date(raw.acceptance_end_datetime) : null;
  const start = raw.acceptance_start_datetime ? new Date(raw.acceptance_start_datetime) : null;
  if (end && end < now) return "closed";
  if (start && start > now) return "upcoming";
  return "open";
}

// ─── 内部ユーティリティ ─────────────────────

function toIsoDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
