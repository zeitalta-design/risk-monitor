import { notFound } from "next/navigation";
import { TRAIL_DISTANCE_SLUGS, TRAIL_DISTANCE_TO_API_KEY, PREFECTURE_SLUGS } from "@/lib/seo-mappings";
import { getEventsByDistance } from "@/lib/seo-queries";
import { REGION_SLUGS } from "@/lib/seo-config";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { distance } = await params;
  const info = TRAIL_DISTANCE_SLUGS[distance];
  if (!info) return {};

  return {
    title: `${info.shortLabel}トレイルラン大会`,
    description: info.description,
    openGraph: {
      title: `${info.shortLabel}トレイルラン大会 | Risk Monitor`,
      description: info.description,
      type: "website",
    },
  };
}

export default async function TrailDistancePage({ params }) {
  const { distance } = await params;
  const info = TRAIL_DISTANCE_SLUGS[distance];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsByDistance(info.range[0], info.range[1], "trail");
  } catch {}

  // 関連リンク
  const relatedLinks = [];

  // 他の距離
  for (const [slug, d] of Object.entries(TRAIL_DISTANCE_SLUGS)) {
    if (slug !== distance) {
      relatedLinks.push({ label: d.shortLabel, href: `/trail/distance/${slug}` });
    }
  }

  // 人気都道府県
  const popularPrefectures = ["tokyo", "nagano", "yamanashi", "kanagawa", "shizuoka", "nara"];
  for (const slug of popularPrefectures) {
    if (PREFECTURE_SLUGS[slug]) {
      relatedLinks.push({
        label: `${PREFECTURE_SLUGS[slug]}の大会`,
        href: `/trail/prefecture/${slug}`,
      });
    }
  }

  // 地方×距離クロスページ
  for (const [rSlug, rInfo] of Object.entries(REGION_SLUGS)) {
    relatedLinks.push({
      label: `${rInfo.label}の${info.shortLabel}`,
      href: `/trail/region/${rSlug}/${distance}`,
    });
  }

  // テーマ別への導線
  relatedLinks.push({ label: "初心者向け", href: "/trail/theme/beginner" });
  relatedLinks.push({ label: "募集中の大会", href: "/trail/theme/open" });

  const apiKey = TRAIL_DISTANCE_TO_API_KEY[distance];

  return (
    <SeoEventList
      title={`${info.shortLabel}トレイルラン大会`}
      description={info.description}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: "距離別", href: "/trail/distance" },
        { label: `${info.shortLabel}大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/trail?distance=${apiKey}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="distance"
      trackingSlug={distance}
      trackingSportType="trail"
    />
  );
}
