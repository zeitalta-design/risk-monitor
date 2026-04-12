/**
 * Phase101: 大会メモ管理
 *
 * localStorageベースで大会ごとのメモを管理する。
 * エントリー後もRisk Monitorを使い続ける理由を作る。
 */

const STORAGE_KEY = "taikai_event_memos";
const MAX_MEMO_LENGTH = 1000;

/**
 * メモカテゴリ定義
 */
export const MEMO_CATEGORIES = [
  { key: "持ち物",      icon: "🎒", placeholder: "ゼッケン、シューズ、ウェア..." },
  { key: "当日の予定",   icon: "📅", placeholder: "受付時間、スタート時間..." },
  { key: "交通・宿泊",   icon: "🚃", placeholder: "新幹線、ホテル、駐車場..." },
  { key: "スケジュール",  icon: "⏰", placeholder: "前日入り、起床時間..." },
  { key: "大会メモ",     icon: "📝", placeholder: "コース注意点、目標タイム..." },
];

// ─── CRUD ────────────────────────────────────

/**
 * 全メモを取得
 * @returns {Object} { [eventId]: { items: {...}, updatedAt } }
 */
export function getAllMemos() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * 特定大会のメモを取得
 * @param {number} eventId
 * @returns {{ items: Object, updatedAt: string }|null}
 */
export function getEventMemos(eventId) {
  const all = getAllMemos();
  return all[eventId] || null;
}

/**
 * メモを保存
 * @param {number} eventId
 * @param {string} category - カテゴリ名
 * @param {string} text - メモ内容
 */
export function setEventMemo(eventId, category, text) {
  const all = getAllMemos();
  if (!all[eventId]) {
    all[eventId] = { items: {}, updatedAt: new Date().toISOString() };
  }
  all[eventId].items[category] = text.slice(0, MAX_MEMO_LENGTH);
  all[eventId].updatedAt = new Date().toISOString();
  _save(all);
  _dispatch();
}

/**
 * 大会のメモを全削除
 * @param {number} eventId
 */
export function deleteEventMemos(eventId) {
  const all = getAllMemos();
  delete all[eventId];
  _save(all);
  _dispatch();
}

/**
 * メモが存在する大会IDリストを取得
 * @returns {number[]}
 */
export function getAllMemoEventIds() {
  const all = getAllMemos();
  return Object.keys(all).map(Number);
}

/**
 * 大会のメモ件数（入力済みカテゴリ数）を取得
 * @param {number} eventId
 * @returns {number}
 */
export function getMemoCount(eventId) {
  const memo = getEventMemos(eventId);
  if (!memo || !memo.items) return 0;
  return Object.values(memo.items).filter((v) => v && v.trim().length > 0).length;
}

// ─── 内部ヘルパー ──────────────────────────────

function _save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function _dispatch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("event-memos-change"));
}
