/**
 * Phase71: 締切グループ内の大会カード
 *
 * 大会名・距離・開催日・締切日・募集状態・最終確認日時・公式リンクを表示。
 */

import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import { formatEventDate, formatEventLocation, formatDistanceBadges } from "@/lib/event-list-formatters";
import { getOfficialStatusDef } from "@/lib/official-status-defs";

function formatCheckedAt(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffH = Math.floor((now - d) / (1000 * 60 * 60));
  if (diffH < 1) return "1時間以内";
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "1日前";
  return `${diffD}日前`;
}

function formatDeadlineDate(dateStr) {
  if (!dateStr) return "未定";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "未定";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDeadlineBadge(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadline = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { text: "今日締切", className: "bg-red-100 text-red-700" };
  if (diffDays <= 3) return { text: `あと${diffDays}日`, className: "bg-orange-100 text-orange-700" };
  if (diffDays <= 7) return { text: `あと${diffDays}日`, className: "bg-amber-100 text-amber-700" };
  return null;
}

export default function DeadlineGroupCard({ event }) {
  const detailPath = getEventDetailPath(event);
  const date = formatEventDate(event.event_date);
  const location = formatEventLocation(event);
  const distances = formatDistanceBadges(event.distance_list);
  const statusDef = getOfficialStatusDef(event.official_entry_status);
  const checkedAgo = formatCheckedAt(event.official_checked_at);
  const deadlineDate = formatDeadlineDate(event.entry_end_date);
  const deadlineBadge = getDeadlineBadge(event.entry_end_date);

  // confidence に基づくアイコン
  const confidence = event.official_status_confidence || 0;
  let confidenceIcon = "⚪";
  if (confidence >= 80) confidenceIcon = "🟢";
  else if (confidence >= 60) confidenceIcon = "🟡";
  else if (confidence >= 40) confidenceIcon = "🟠";
  else confidenceIcon = "⚪";

  return (
    <Link
      href={detailPath}
      className="block p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      {/* 1行目: タイトル + ステータスバッジ */}
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-700 transition-colors">
          {event.title}
        </h3>
        {deadlineBadge && (
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${deadlineBadge.className}`}>
            {deadlineBadge.text}
          </span>
        )}
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${statusDef.badgeClass}`}>
          {event.official_entry_status_label || statusDef.label}
        </span>
      </div>

      {/* 2行目: メタ情報 */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-gray-500">
        <span>📅 {date}</span>
        <span>·</span>
        <span>📍 {location}</span>
        {distances.slice(0, 2).map((d, i) => (
          <span key={i} className="px-1.5 py-0 text-blue-600 bg-blue-50 rounded">
            {d}
          </span>
        ))}
      </div>

      {/* 3行目: 締切 + 定員 + 確認情報 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs">
        <span className="text-gray-500">
          締切: <span className="font-medium text-gray-700">{event.official_deadline_text || deadlineDate}</span>
        </span>
        {event.official_capacity_text && (
          <span className="text-orange-600 font-medium">
            🔥 {event.official_capacity_text}
          </span>
        )}
        {event.official_status_note && (
          <span className="text-gray-400 italic">
            {event.official_status_note}
          </span>
        )}
        {checkedAgo && (
          <span className="text-gray-400" title={`信頼度: ${confidence}%`}>
            {confidenceIcon} 確認: {checkedAgo}
          </span>
        )}
      </div>

      {/* 公式リンク（タップ先は詳細なので、ここはテキストのみ） */}
      {(event.official_url || event.source_url) && (
        <div className="mt-1.5 text-xs text-blue-500 truncate">
          🔗 {event.official_url || event.source_url}
        </div>
      )}
    </Link>
  );
}
