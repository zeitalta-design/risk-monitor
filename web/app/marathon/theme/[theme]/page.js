import { notFound } from "next/navigation";
import { THEME_SLUGS, buildThemeMetadata, buildThemeRelatedLinks } from "@/lib/seo-config";
import { getEventsByTheme } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SeoCirculationSection from "@/components/seo/SeoCirculationSection";
import SportSwitcher from "@/components/seo/SportSwitcher";

export async function generateMetadata({ params }) {
  const { theme } = await params;
  return buildThemeMetadata(theme);
}

export default async function ThemePage({ params }) {
  const { theme } = await params;
  const info = THEME_SLUGS[theme];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsByTheme(theme);
  } catch {}

  const relatedLinks = buildThemeRelatedLinks(theme);

  const circulationLinks = [
    { label: "地方別で探す", href: "/marathon/region" },
    { label: "季節別で探す", href: "/marathon/season" },
    { label: "距離別で探す", href: "/marathon/distance" },
  ];

  return (
    <SeoEventList
      title={info.label}
      description={info.filterDescription}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: "テーマ別", href: "/marathon/theme" },
        { label: info.shortLabel },
      ]}
      events={events}
      total={events.length}
      ctaHref="/marathon"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="theme"
      trackingSlug={theme}
    >
      <SeoCirculationSection categoryLinks={circulationLinks} />
      {["open", "deadline", "popular", "beginner", "family"].includes(theme) && (
        <SportSwitcher currentSportSlug="marathon" category="theme" slug={theme} />
      )}
    </SeoEventList>
  );
}
