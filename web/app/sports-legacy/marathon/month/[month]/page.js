import { notFound } from "next/navigation";
import { getMonthLabel, getMonthDescription, DISTANCE_SLUGS, PREFECTURE_SLUGS } from "@/lib/seo-mappings";
import { getEventsByMonth } from "@/lib/seo-queries";
import { SEASON_SLUGS } from "@/lib/seo-config";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { month } = await params;
  const label = getMonthLabel(month);
  if (!label) return {};

  return {
    title: `${label}開催のマラソン大会`,
    description: getMonthDescription(month),
    openGraph: {
      title: `${label}開催のマラソン大会 | Risk Monitor`,
      description: getMonthDescription(month),
      type: "website",
    },
  };
}

export default async function MonthPage({ params }) {
  const { month } = await params;
  const m = parseInt(month);
  if (isNaN(m) || m < 1 || m > 12) notFound();

  const label = getMonthLabel(month);

  let events = [];
  try {
    events = getEventsByMonth(m);
  } catch {}

  // 関連リンク: 前後の月 + 距離別
  const relatedLinks = [];
  const prevMonth = m === 1 ? 12 : m - 1;
  const nextMonth = m === 12 ? 1 : m + 1;
  relatedLinks.push(
    { label: `${prevMonth}月開催`, href: `/marathon/month/${prevMonth}` },
    { label: `${nextMonth}月開催`, href: `/marathon/month/${nextMonth}` }
  );
  for (const [slug, info] of Object.entries(DISTANCE_SLUGS)) {
    relatedLinks.push({ label: info.label, href: `/marathon/distance/${slug}` });
  }
  const popularPrefectures = ["tokyo", "osaka", "kanagawa"];
  for (const slug of popularPrefectures) {
    relatedLinks.push({
      label: `${PREFECTURE_SLUGS[slug]}の大会`,
      href: `/marathon/prefecture/${slug}`,
    });
  }
  // 季節ページへの導線
  for (const [sSlug, sInfo] of Object.entries(SEASON_SLUGS)) {
    if (sInfo.months.includes(m)) {
      relatedLinks.push({ label: `${sInfo.label}の大会一覧`, href: `/marathon/season/${sSlug}` });
    }
  }
  // テーマ別への導線
  relatedLinks.push({ label: "初心者向け", href: "/marathon/theme/beginner" });
  relatedLinks.push({ label: "募集中の大会", href: "/marathon/theme/open" });

  return (
    <SeoEventList
      title={`${label}開催のマラソン大会`}
      description={`${label}に開催されるマラソン大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: `${label}開催のマラソン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/marathon?month=${m}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
    />
  );
}
