import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import { getStatusLabel, getStatusBadgeClassSimple } from "@/lib/entry-status";
import { getEventDetailPath } from "@/lib/sport-config";
import UrgencyBadge from "./UrgencyBadge";
import FreshnessBadge from "./FreshnessBadge";
import { ConflictBadge } from "./VerificationConflictBadge";
import SeoTracker from "./seo/SeoTracker";

function formatDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

function formatDistances(distanceList) {
  if (!distanceList) return [];
  return [
    ...new Set(
      distanceList.split(",").map((d) => {
        const km = parseFloat(d);
        if (isNaN(km)) return null;
        if (km > 42.5) return "ウルトラ";
        if (km >= 42 && km <= 42.5) return "フル";
        if (km >= 20 && km <= 22) return "ハーフ";
        const rounded = km % 1 === 0 ? km : Math.round(km * 10) / 10;
        return `${rounded}km`;
      }).filter(Boolean)
    ),
  ];
}

/** 締切までの残り日数を計算 */
function getDaysUntilDeadline(entryEndDate) {
  if (!entryEndDate) return null;
  const end = new Date(entryEndDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function EntryBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClassSimple(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}

/** Phase116: 締切カウントダウン */
function DeadlineCountdown({ event }) {
  if (event.entry_status !== "open") return null;
  const days = getDaysUntilDeadline(event.entry_end_date);
  if (days === null) return null;

  let colorClass = "text-gray-500";
  let icon = "📅";
  if (days <= 3) { colorClass = "text-red-600 font-bold"; icon = "🔴"; }
  else if (days <= 7) { colorClass = "text-amber-600 font-medium"; icon = "🔥"; }
  else if (days <= 14) { colorClass = "text-blue-600"; icon = "⏰"; }

  return (
    <span className={`text-xs ${colorClass}`}>
      {icon} 締切まで{days}日
    </span>
  );
}

/** Phase122: スポーツ別の距離バッジカラー */
const SPORT_BADGE_CLASS = {
  trail: "bg-green-50 text-green-600",
  marathon: "bg-blue-50 text-blue-600",
};

function SeoEventCard({ event }) {
  const distances = formatDistances(event.distance_list);
  const badgeClass = SPORT_BADGE_CLASS[event.sport_type] || SPORT_BADGE_CLASS.marathon;
  return (
    <div className="card hover:shadow-md transition-shadow">
      <Link href={getEventDetailPath(event)} className="block p-4">
        {/* Phase116: 募集状況を上部に目立つ位置で表示 */}
        <div className="flex items-center gap-2 mb-2">
          <EntryBadge status={event.entry_status} />
          <DeadlineCountdown event={event} />
          <UrgencyBadge event={event} />
        </div>

        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
          {event.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{formatDate(event.event_date)}</span>
          <span className="text-gray-300">|</span>
          <span>{event.prefecture || "エリア未定"}</span>
          {event.venue_name && (
            <>
              <span className="text-gray-300">|</span>
              <span className="truncate max-w-[150px]">{event.venue_name}</span>
            </>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {distances.map((d) => (
            <span key={d} className={`inline-block px-1.5 py-0.5 text-xs rounded ${badgeClass}`}>
              {d}
            </span>
          ))}
        </div>
      </Link>
      <div className="px-4 pb-2 -mt-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">
          出典: {event.source === "moshicom" ? "MOSHICOM" : "RUNNET"}
        </span>
        <FreshnessBadge event={event} />
        <ConflictBadge level={event.verification_conflict_level} />
      </div>
    </div>
  );
}

/**
 * SEOページ共通の大会一覧レイアウト
 * Server Component — SSR で描画される
 * Phase114: circulationSection スロット追加
 * Phase116: カード強化（募集状況上部表示・締切カウントダウン）
 */
export default function SeoEventList({
  title,
  description,
  breadcrumbs,
  events,
  total,
  ctaHref,
  ctaLabel,
  relatedLinks,
  emptyHref,
  emptyLabel,
  children,
  trackingPageType,
  trackingSlug,
  trackingSportType,
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Phase117/126: SEOページ計測（スポーツ種別付き） */}
      {trackingPageType && (
        <SeoTracker pageType={trackingPageType} slug={trackingSlug || ""} eventCount={total || 0} sportType={trackingSportType || "marathon"} />
      )}
      <Breadcrumbs items={breadcrumbs} />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{description}</p>

      <p className="text-sm text-gray-600 mb-4">{total}件の大会</p>

      {events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">該当する大会が見つかりませんでした</p>
          <Link href={emptyHref || "/marathon"} className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800">
            {emptyLabel || "マラソン大会一覧で探す →"}
          </Link>
          {relatedLinks && relatedLinks.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">他のテーマで探す</p>
              <div className="flex flex-wrap justify-center gap-2">
                {relatedLinks.slice(0, 8).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-gray-600
                               hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <SeoEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* フィルター付き検索への誘導CTA */}
      {ctaHref && (
        <div className="mt-8 text-center">
          <Link
            href={ctaHref}
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl
                       hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            {ctaLabel || "条件を絞って探す →"}
          </Link>
        </div>
      )}

      {/* Phase114: 回遊セクション（children slot） */}
      {children}

      {/* 関連リンク */}
      {relatedLinks && relatedLinks.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">関連する条件で探す</h2>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                           rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
