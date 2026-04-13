export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { getEventDetailPath } from "@/lib/sport-config";
import { getFeatureDefinition, getAllFeatureDefinitions } from "@/lib/feature-definitions";
import { getFeatureMarathons } from "@/lib/feature-marathons";
import Breadcrumbs from "@/components/Breadcrumbs";
import MarathonListCard from "@/components/MarathonListCard";

// --- Static Params ---

export function generateStaticParams() {
  const definitions = getAllFeatureDefinitions();
  return definitions.map((def) => ({ slug: def.slug }));
}

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const definition = getFeatureDefinition(slug);
  if (!definition) return {};

  return {
    title: definition.seoTitle,
    description: definition.seoDescription,
    openGraph: {
      title: `${definition.seoTitle} | ${siteConfig.siteName}`,
      description: definition.seoDescription,
      type: "website",
    },
    alternates: {
      canonical: `${siteConfig.siteUrl}/features/${slug}`,
    },
  };
}

// --- Page ---

export default async function FeaturePage({ params }) {
  const { slug } = await params;

  const definition = getFeatureDefinition(slug);
  if (!definition) notFound();

  const { events, total } = getFeatureMarathons(slug, { limit: 100 });
  const allDefinitions = getAllFeatureDefinitions();
  const otherFeatures = allDefinitions.filter((d) => d.slug !== slug);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "マラソン", href: "/marathon" },
    { label: definition.shortTitle },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-8 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{definition.icon}</span>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {definition.title}
          </h1>
        </div>

        <p className="text-base text-gray-600 leading-relaxed mb-4">
          {definition.intro}
        </p>

        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">選定基準：</span>
            {definition.selectionCriteria}
          </p>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          該当大会: <span className="font-semibold text-gray-700">{total}件</span>
        </p>
      </div>

      {/* 大会一覧 */}
      {events.length > 0 ? (
        <div className="space-y-3 mb-12">
          {events.map((event) => (
            <FeatureMarathonCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 mb-12">
          <p className="text-gray-500">{definition.emptyMessage}</p>
        </div>
      )}

      {/* 他の比較軸への導線 */}
      <section className="border-t border-gray-100 pt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          他の条件で大会を探す
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {otherFeatures.map((feat) => (
            <Link
              key={feat.slug}
              href={`/features/${feat.slug}`}
              className="block p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{feat.icon}</span>
                <span className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                  {feat.shortTitle}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">
                {feat.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* マラソン一覧への導線 */}
      <div className="mt-8 text-center">
        <Link
          href="/marathon"
          className="inline-block px-6 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          すべてのマラソン大会を見る →
        </Link>
      </div>
    </div>
  );
}

// --- Feature用カード（reason_labelsを表示）---

function FeatureMarathonCard({ event }) {
  const entryBadge = getEntryBadge(event.entry_status);

  return (
    <Link
      href={getEventDetailPath(event)}
      className="block card p-5 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* 左: メイン情報 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mb-2">
            {event.event_date && (
              <span className="font-medium text-gray-700">
                {formatDate(event.event_date)}
              </span>
            )}
            {event.prefecture && <span>{event.prefecture}</span>}
            {event.city && (
              <span className="text-gray-400">{event.city}</span>
            )}
          </div>
          {/* 該当理由ラベル */}
          {event.reason_labels && event.reason_labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {event.reason_labels.map((label, i) => (
                <span
                  key={i}
                  className="inline-block px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded border border-amber-100"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 右: バッジ */}
        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          {event.distance_labels &&
            event.distance_labels.map((label) => (
              <span
                key={label}
                className="inline-block px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded"
              >
                {label}
              </span>
            ))}
          {entryBadge && (
            <span
              className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${entryBadge.className}`}
            >
              {entryBadge.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}

function getEntryBadge(status) {
  const badges = {
    open: { label: "受付中", className: "bg-green-50 text-green-700" },
    upcoming: { label: "受付予定", className: "bg-blue-50 text-blue-600" },
    closed: { label: "締切", className: "bg-gray-100 text-gray-500" },
    cancelled: { label: "中止", className: "bg-red-50 text-red-600" },
  };
  return badges[status] || null;
}
