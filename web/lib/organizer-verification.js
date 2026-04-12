/**
 * Phase131: 運営確認ステータス定義・表示ロジック
 *
 * events.organizer_verified カラムの値に基づいて
 * ラベル・スタイル・表示条件を解決する。
 */

export const ORGANIZER_VERIFICATION_STATUSES = {
  unconfirmed: {
    key: "unconfirmed",
    label: "未確認",
    shortLabel: "未確認",
    className: "bg-gray-50 text-gray-500 border-gray-200",
    showInList: false,
    showInDetail: false,
    priority: 0,
  },
  taikainavi_verified: {
    key: "taikainavi_verified",
    label: "Risk Monitor確認",
    shortLabel: "確認済",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    showInList: true,
    showInDetail: true,
    priority: 2,
  },
  official_site_verified: {
    key: "official_site_verified",
    label: "公式情報充実",
    shortLabel: "公式充実",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    showInList: true,
    showInDetail: true,
    priority: 3,
  },
  organizer_confirmed: {
    key: "organizer_confirmed",
    label: "運営確認済み",
    shortLabel: "運営確認",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    showInList: true,
    showInDetail: true,
    priority: 4,
  },
  needs_review: {
    key: "needs_review",
    label: "要確認",
    shortLabel: "要確認",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    showInList: false,
    showInDetail: true,
    priority: 1,
  },
};

/**
 * ステータスキーから表示情報を取得
 */
export function getOrganizerVerificationDisplay(status) {
  return ORGANIZER_VERIFICATION_STATUSES[status] || ORGANIZER_VERIFICATION_STATUSES.unconfirmed;
}

/**
 * 一覧表示用のバッジ表示判定
 */
export function shouldShowVerificationBadge(status, context = "list") {
  const info = getOrganizerVerificationDisplay(status);
  return context === "detail" ? info.showInDetail : info.showInList;
}

/**
 * 全ステータスの選択肢（管理画面用）
 */
export function getVerificationStatusOptions() {
  return Object.values(ORGANIZER_VERIFICATION_STATUSES)
    .sort((a, b) => a.priority - b.priority)
    .map((s) => ({ value: s.key, label: s.label }));
}
