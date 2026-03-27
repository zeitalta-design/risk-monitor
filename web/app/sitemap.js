import { getDb } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";
import { PREFECTURE_NAME_TO_SLUG, DISTANCE_SLUGS, TRAIL_DISTANCE_SLUGS } from "@/lib/seo-mappings";
import { SPORT_CONFIGS } from "@/lib/sport-config";
import { REGION_SLUGS, SEASON_SLUGS, THEME_SLUGS, TRAIL_THEME_SLUGS } from "@/lib/seo-config";
import { listYutaiSlugsForSitemap } from "@/lib/repositories/yutai";
import { listHojokinSlugsForSitemap } from "@/lib/repositories/hojokin";
import { listNyusatsuSlugsForSitemap } from "@/lib/repositories/nyusatsu";
import { listMinpakuSlugsForSitemap } from "@/lib/repositories/minpaku";

// Force dynamic rendering so APP_BASE_URL is read at runtime, not build time
export const dynamic = "force-dynamic";

export default function sitemap() {
  const baseUrl = siteConfig.siteUrl;

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/marathon`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/marathon/prefecture`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/distance`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/month`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    // Phase108: 新規インデックスページ
    { url: `${baseUrl}/marathon/region`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/season`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/theme`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    // Phase53: trail 静的ページ
    { url: `${baseUrl}/trail`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    // Phase54: trail ランキング
    { url: `${baseUrl}/trail/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    // Phase118: trail SEO インデックスページ
    { url: `${baseUrl}/trail/region`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/trail/season`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/trail/theme`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/trail/distance`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/terms`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/about-data`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    // Phase228: 追加公開ページ
    { url: `${baseUrl}/calendar`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/rankings`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/popular`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/next-race`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/entry-deadlines`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/benefits`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/organizers`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/runner`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    // データプラットフォーム
    { url: `${baseUrl}/platform`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/platform/dashboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/platform/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
  ];

  // 距離別ページ（固定・marathon用）
  const distancePages = Object.keys(DISTANCE_SLUGS).map((slug) => ({
    url: `${baseUrl}/marathon/distance/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase108: 地方別ページ（固定）
  const regionPages = Object.keys(REGION_SLUGS).map((slug) => ({
    url: `${baseUrl}/marathon/region/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase108: 地方×距離クロスページ
  const regionDistancePages = [];
  for (const rSlug of Object.keys(REGION_SLUGS)) {
    for (const dSlug of Object.keys(DISTANCE_SLUGS)) {
      regionDistancePages.push({
        url: `${baseUrl}/marathon/region/${rSlug}/${dSlug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Phase108: 季節別ページ（固定）
  const seasonPages = Object.keys(SEASON_SLUGS).map((slug) => ({
    url: `${baseUrl}/marathon/season/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase108: テーマ別ページ（固定）
  const themePages = Object.keys(THEME_SLUGS).map((slug) => ({
    url: `${baseUrl}/marathon/theme/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  // Phase118: trail 地方別ページ
  const trailRegionPages = Object.keys(REGION_SLUGS).map((slug) => ({
    url: `${baseUrl}/trail/region/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase118: trail 地方×距離クロスページ
  const trailRegionDistancePages = [];
  for (const rSlug of Object.keys(REGION_SLUGS)) {
    for (const dSlug of Object.keys(TRAIL_DISTANCE_SLUGS)) {
      trailRegionDistancePages.push({
        url: `${baseUrl}/trail/region/${rSlug}/${dSlug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Phase118: trail 距離別ページ
  const trailDistancePages = Object.keys(TRAIL_DISTANCE_SLUGS).map((slug) => ({
    url: `${baseUrl}/trail/distance/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase118: trail 季節別ページ
  const trailSeasonPages = Object.keys(SEASON_SLUGS).map((slug) => ({
    url: `${baseUrl}/trail/season/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Phase118: trail テーマ別ページ
  const trailThemePages = Object.keys(TRAIL_THEME_SLUGS).map((slug) => ({
    url: `${baseUrl}/trail/theme/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  // SaaSナビ: 静的ページ
  const saasStaticPages = [
    { url: `${baseUrl}/saas`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/saas/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  // SaaSナビ: カテゴリ別ページ
  const saasCategories = ["crm", "accounting", "hr", "ma", "project", "communication", "security", "infra"];
  const saasCategoryPages = saasCategories.map((cat) => ({
    url: `${baseUrl}/saas?category=${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  let saasDetailPages = [];
  let yutaiDetailPages = [];
  let hojokinDetailPages = [];
  let nyusatsuDetailPages = [];
  let minpakuDetailPages = [];

  let eventPages = [];
  let prefecturePages = [];
  let monthPages = [];
  let trailPrefecturePages = [];
  let trailMonthPages = [];

  try {
    const db = getDb();

    // 大会詳細ページ（sport_typeに応じたslugを使用）
    const sportTypeToSlug = Object.fromEntries(
      SPORT_CONFIGS.map((s) => [s.sportTypeForDb, s.slug])
    );
    const events = db
      .prepare("SELECT id, sport_type, updated_at FROM events WHERE is_active = 1 ORDER BY id")
      .all();
    eventPages = events.map((event) => ({
      url: `${baseUrl}/${sportTypeToSlug[event.sport_type] || "marathon"}/${event.id}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // marathon: 実データのある都道府県ページ
    const prefectures = db.prepare(`
      SELECT DISTINCT prefecture FROM events
      WHERE is_active = 1 AND sport_type = 'marathon' AND prefecture IS NOT NULL AND prefecture != ''
    `).all();
    prefecturePages = prefectures
      .map((r) => {
        const slug = PREFECTURE_NAME_TO_SLUG[r.prefecture];
        if (!slug) return null;
        return {
          url: `${baseUrl}/marathon/prefecture/${slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
      .filter(Boolean);

    // marathon: 実データのある月ページ
    const months = db.prepare(`
      SELECT DISTINCT event_month FROM events
      WHERE is_active = 1 AND sport_type = 'marathon' AND event_month IS NOT NULL AND event_month != ''
    `).all();
    monthPages = months.map((r) => ({
      url: `${baseUrl}/marathon/month/${r.event_month}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    // Phase53: trail — 実データのある都道府県ページ
    const trailPrefectures = db.prepare(`
      SELECT DISTINCT prefecture FROM events
      WHERE is_active = 1 AND sport_type = 'trail' AND prefecture IS NOT NULL AND prefecture != ''
    `).all();
    trailPrefecturePages = trailPrefectures
      .map((r) => {
        const slug = PREFECTURE_NAME_TO_SLUG[r.prefecture];
        if (!slug) return null;
        return {
          url: `${baseUrl}/trail/prefecture/${slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
      .filter(Boolean);

    // Phase53: trail — 実データのある月ページ
    const trailMonths = db.prepare(`
      SELECT DISTINCT event_month FROM events
      WHERE is_active = 1 AND sport_type = 'trail' AND event_month IS NOT NULL AND event_month != ''
    `).all();
    trailMonthPages = trailMonths.map((r) => ({
      url: `${baseUrl}/trail/month/${r.event_month}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    // SaaSナビ: 公開ツール詳細ページ
    const saasItems = db
      .prepare("SELECT slug, updated_at FROM items WHERE is_published = 1 AND slug IS NOT NULL ORDER BY id")
      .all();
    saasDetailPages = saasItems.map((item) => ({
      url: `${baseUrl}/saas/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // 株主優待ナビ: 公開中の詳細ページ
    try {
      const yutaiSlugs = listYutaiSlugsForSitemap();
      yutaiDetailPages = yutaiSlugs.map((item) => ({
        url: `${baseUrl}/yutai/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    } catch {
      // yutai DB unavailable — skip detail pages
    }

    // 補助金ナビ: 公開中の詳細ページ
    try {
      const hojokinSlugs = listHojokinSlugsForSitemap();
      hojokinDetailPages = hojokinSlugs.map((item) => ({
        url: `${baseUrl}/hojokin/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    } catch {
      // hojokin DB unavailable — skip detail pages
    }

    // 入札ナビ: 公開中の詳細ページ
    try {
      const nyusatsuSlugs = listNyusatsuSlugsForSitemap();
      nyusatsuDetailPages = nyusatsuSlugs.map((item) => ({
        url: `${baseUrl}/nyusatsu/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    } catch {
      // nyusatsu DB unavailable — skip detail pages
    }

    // 民泊ナビ: 公開中の詳細ページ
    try {
      const minpakuSlugs = listMinpakuSlugsForSitemap();
      minpakuDetailPages = minpakuSlugs.map((item) => ({
        url: `${baseUrl}/minpaku/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    } catch {
      // minpaku DB unavailable — skip detail pages
    }
  } catch {
    // DB unavailable during build — return static pages only
  }

  // 補助金ナビ: 静的ページ
  const hojokinStaticPages = [
    { url: `${baseUrl}/hojokin`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/hojokin/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  // 株主優待ナビ: 静的ページ
  const yutaiStaticPages = [
    { url: `${baseUrl}/yutai`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/yutai/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  // 入札ナビ: 静的ページ
  const nyusatsuCategories = ["it", "construction", "consulting", "goods", "service", "other"];
  const nyusatsuAreas = ["全国", "北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州", "沖縄"];

  const nyusatsuStaticPages = [
    { url: `${baseUrl}/nyusatsu`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/nyusatsu/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    ...nyusatsuCategories.map((cat) => ({
      url: `${baseUrl}/nyusatsu/category/${cat}`,
      lastModified: new Date(), changeFrequency: "weekly", priority: 0.7,
    })),
    ...nyusatsuAreas.map((area) => ({
      url: `${baseUrl}/nyusatsu/area/${encodeURIComponent(area)}`,
      lastModified: new Date(), changeFrequency: "weekly", priority: 0.7,
    })),
  ];

  const minpakuStaticPages = [
    { url: `${baseUrl}/minpaku`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/minpaku/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  return [
    ...staticPages,
    ...distancePages,
    ...regionPages,
    ...regionDistancePages,
    ...seasonPages,
    ...themePages,
    // Phase118: trail SEOページ
    ...trailRegionPages,
    ...trailRegionDistancePages,
    ...trailDistancePages,
    ...trailSeasonPages,
    ...trailThemePages,
    ...prefecturePages,
    ...monthPages,
    ...trailPrefecturePages,
    ...trailMonthPages,
    ...eventPages,
    // SaaSナビ
    ...saasStaticPages,
    ...saasCategoryPages,
    ...saasDetailPages,
    // 株主優待ナビ
    ...yutaiStaticPages,
    ...yutaiDetailPages,
    // 補助金ナビ
    ...hojokinStaticPages,
    ...hojokinDetailPages,
    // 入札ナビ
    ...nyusatsuStaticPages,
    ...nyusatsuDetailPages,
    // 民泊ナビ
    ...minpakuStaticPages,
    ...minpakuDetailPages,
  ];
}
