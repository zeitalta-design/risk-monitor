import { notFound } from "next/navigation";
import { getMonthLabel, getMonthDescription, PREFECTURE_SLUGS } from "@/lib/seo-mappings";
import { SEASON_SLUGS } from "@/lib/seo-config";
import { getEventsByMonth } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

/**
 * Phase53: トレイルラン — 月別SEOページ
 * /trail/month/[month]
 */

export async function generateMetadata({ params }) {
  const { month } = await params;
  const label = getMonthLabel(month);
  if (!label) return {};

  return {
    title: `${label}開催のトレイルラン大会`,
    description: getMonthDescription(month, "trail"),
    openGraph: {
      title: `${label}開催のトレイルラン大会 | Risk Monitor`,
      description: getMonthDescription(month, "trail"),
      type: "website",
    },
  };
}

export default async function TrailMonthPage({ params }) {
  const { month } = await params;
  const m = parseInt(month);
  if (isNaN(m) || m < 1 || m > 12) notFound();

  const label = getMonthLabel(month);

  let events = [];
  try {
    events = getEventsByMonth(m, "trail");
  } catch {}

  // 関連リンク: 前後の月 + 人気都道府県(trail) + マラソン同月
  const relatedLinks = [];
  const prevMonth = m === 1 ? 12 : m - 1;
  const nextMonth = m === 12 ? 1 : m + 1;
  relatedLinks.push(
    { label: `${prevMonth}月開催のトレイル`, href: `/trail/month/${prevMonth}` },
    { label: `${nextMonth}月開催のトレイル`, href: `/trail/month/${nextMonth}` }
  );
  // トレイルが盛んなエリア
  const trailPrefectures = ["tokyo", "nagano", "yamanashi", "shizuoka"];
  for (const slug of trailPrefectures) {
    relatedLinks.push({
      label: `${PREFECTURE_SLUGS[slug]}のトレイル`,
      href: `/trail/prefecture/${slug}`,
    });
  }
  // Phase118: 季節・テーマ・距離への導線
  for (const [sSlug, sInfo] of Object.entries(SEASON_SLUGS)) {
    if (sInfo.months.includes(m)) {
      relatedLinks.push({ label: `${sInfo.label}のトレイル`, href: `/trail/season/${sSlug}` });
    }
  }
  relatedLinks.push({ label: "初心者向け", href: "/trail/theme/beginner" });
  relatedLinks.push({ label: "募集中", href: "/trail/theme/open" });
  // Phase54: ランキング導線
  relatedLinks.push({ label: "🔥 トレイル人気ランキング", href: "/trail/ranking" });
  // マラソン同月へのクロスリンク
  relatedLinks.push({ label: `${label}開催のマラソン`, href: `/marathon/month/${m}` });

  return (
    <SeoEventList
      title={`${label}開催のトレイルラン大会`}
      description={`${label}に開催されるトレイルランニング大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: `${label}開催のトレイルラン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/trail?month=${m}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      emptyHref="/trail"
      emptyLabel="トレイルラン大会一覧で探す →"
    />
  );
}
