/**
 * watch 通知 UI の小さな共通ヘルパー（Phase J-11 で抽出）
 *
 * dropdown (`WatchNotificationDropdown`) と一覧ページ
 * (`/watch-notifications`) で同じ「今日の有望案件まとめ」境界を使うために、
 * 日付判定 / digest 判定を一か所に集約する。
 *
 * 置き換えポイント:
 *   - JST 固定で当日 0:00 (JST) 以降の createdAt を「今日」扱い
 *   - watch_notifications.created_at は SQLite `datetime('now')` (UTC, Z 無し)
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD HH:MM:SS" (UTC, Z 無し) もしくは ISO 文字列を Date にする。
export function parseCreatedAt(s) {
  if (!s) return null;
  const iso = /Z$|[+\-]\d{2}:?\d{2}$/.test(s)
    ? String(s).replace(" ", "T")
    : String(s).replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

// 今（サーバー時刻 or 端末時刻）から見た「JST 当日 0:00」の UTC ms。
export function jstTodayStartUtcMs(now = new Date()) {
  const jstNowMs = now.getTime() + JST_OFFSET_MS;
  const jstDayStartMs = Math.floor(jstNowMs / DAY_MS) * DAY_MS;
  return jstDayStartMs - JST_OFFSET_MS;
}

export function isTodayJst(createdAt, now = new Date()) {
  const d = parseCreatedAt(createdAt);
  if (!d) return false;
  return d.getTime() >= jstTodayStartUtcMs(now);
}

// daily cron が insert した当日分 deal_score 通知のみ digest に回す。
// realtime / off の watch は対象外。
export function isDailyDigestItem(n, now = new Date()) {
  return n?.domain === "deal_score" && n?.frequency === "daily" && isTodayJst(n?.createdAt, now);
}

// 「未読 N / 全 M 件」/「全 M 件」の共通ラベル（digest ヘッダ用）。
export function digestCountLabel(items) {
  const total = items.length;
  const unread = items.filter((n) => !n.isRead).length;
  return unread > 0 ? `未読 ${unread} / 全 ${total} 件` : `全 ${total} 件`;
}

// Phase J-Post: domain 別 badge のクラスを dropdown と一覧ページで統一。
//   saved_deal_update は emerald で少し強調（保存済み案件の変化は重要度高い）。
const DOMAIN_BADGE_CLASS = {
  gyosei_shobun:     "bg-red-50 text-red-700 border border-red-100",
  nyusatsu:          "bg-purple-50 text-purple-700 border border-purple-100",
  deal_score:        "bg-cyan-50 text-cyan-700 border border-cyan-100",
  saved_deal_update: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium",
};

export function domainBadgeClass(domain) {
  return DOMAIN_BADGE_CLASS[domain] || "bg-gray-100 text-gray-600 border border-gray-200";
}

// 通知の title 先頭に org 名 + `：` が含まれるケースで org 行を
// 重複表示しないための helper（dropdown / 一覧で共通）。
export function extractOrgFromTitle(title) {
  if (!title) return "";
  const idx = title.indexOf("：");
  return idx > 0 ? title.slice(0, idx) : "";
}
