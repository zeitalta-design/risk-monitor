/**
 * Phase187: カレンダー機能 将来拡張計画
 *
 * 現在の実装: Phase178-186
 * - トップページ ミニカレンダー (TopCalendarSection)
 * - /calendar UX強化 (フィルタ3種、月ジャンプ、シーズン導線)
 * - SEOクロスリンク (月別・競技別・距離別・エリア別)
 * - カレンダー→マイ大会導線
 * - data-track計測
 *
 * === 将来拡張ポイント ===
 *
 * 1. My Calendar (マイカレンダー)
 *    - 保存済み大会をカレンダー上にハイライト表示
 *    - エントリー済み/検討中/完走済みをステータス色分け
 *    - /my-events/calendar ルートまたは /calendar?view=my
 *    - getSavedIds() + getMyEventsStatuses() との連携
 *
 * 2. Google Calendar連携
 *    - 大会日程をGoogleカレンダーに追加ボタン
 *    - ics形式のエクスポート
 *    - エントリー締切日のリマインダー設定
 *    - URL: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...
 *
 * 3. 週表示モード
 *    - /calendar?view=week
 *    - モバイルで特に有効（縦スクロールで日程確認）
 *    - タイムライン形式での表示
 *
 * 4. 複数月表示
 *    - /calendar?months=3 で3ヶ月一覧
 *    - シーズン単位での俯瞰に有効
 *    - デスクトップ向けレイアウト
 *
 * 5. カレンダーウィジェット埋め込み
 *    - iframe/Web Component形式
 *    - 大会主催者サイトへの埋め込み用
 *    - /embed/calendar?sport_type=marathon
 *
 * 6. iCal/ICSフィード
 *    - /api/calendar/ical?sport_type=marathon
 *    - カレンダーアプリへの購読
 *    - フィルタ条件ごとのフィードURL生成
 *
 * 7. 地図連携
 *    - カレンダーの日付クリック→地図上に大会マーカー表示
 *    - 距離フィルタ＋地図の組み合わせ
 *
 * 8. プッシュ通知連携
 *    - 「この月の新着大会」定期通知
 *    - 保存大会の開催日リマインダー
 *    - notification-service.js との連携
 */

// 将来の実装で使用するヘルパー定義

/**
 * Google Calendar用のURLを生成
 * @param {Object} event - 大会オブジェクト
 * @returns {string} Google Calendar追加用URL
 */
export function buildGoogleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "",
    dates: formatGCalDate(event.event_date),
    location: [event.venue_name, event.prefecture].filter(Boolean).join(", "),
    details: `Risk Monitorで詳細を見る: ${typeof window !== "undefined" ? window.location.origin : ""}/${event.sport_type || "marathon"}/${event.id}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * ICS形式の日付文字列に変換
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} YYYYMMDD/YYYYMMDD (終日イベント)
 */
function formatGCalDate(dateStr) {
  if (!dateStr) return "";
  const d = dateStr.replace(/-/g, "");
  // 終日イベント: 開始日/翌日
  const next = new Date(dateStr);
  next.setDate(next.getDate() + 1);
  const nextStr = next.toISOString().slice(0, 10).replace(/-/g, "");
  return `${d}/${nextStr}`;
}

/**
 * ICSファイル用のイベントデータを生成
 * @param {Object} event
 * @returns {string} ICS形式の文字列
 */
export function buildIcsEvent(event) {
  const uid = `event-${event.id}@taikainnati.com`;
  const dtstart = (event.event_date || "").replace(/-/g, "");
  const summary = (event.title || "").replace(/[,;\\]/g, " ");
  const location = [event.venue_name, event.prefecture].filter(Boolean).join(", ");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TAIKAINAVI//Calendar//JP",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
