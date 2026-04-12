/**
 * Phase119: Sport共通SEO基盤
 * スポーツ別のSEOページ設定を統一的に提供するヘルパー
 *
 * 新スポーツ追加時の手順:
 * 1. sport-config.js に SPORT_CONFIGS エントリ追加
 * 2. seo-mappings.js に距離slug定義追加（必要なら）
 * 3. seo-config.js にテーマslug定義追加（必要なら）
 * 4. app/{sportSlug}/ 以下にページファイル作成（薄いラッパー）
 * 5. sitemap.js にページ追加
 */

import { getSportBySlug } from "@/lib/sport-config";
import { REGION_SLUGS, SEASON_SLUGS, getThemeSlugsForSport, getDistanceSlugsForSport } from "@/lib/seo-config";
import { getSportEventLabel } from "@/lib/seo-mappings";

/**
 * スポーツ別のSEOページ共通設定を生成
 * @param {string} sportSlug - スポーツslug ("marathon", "trail" 等)
 * @returns SEOページで使う各種設定
 */
export function getSportSeoConfig(sportSlug) {
  const sport = getSportBySlug(sportSlug);
  if (!sport) return null;

  const sportType = sport.sportTypeForDb;
  const sportLabel = sport.shortLabel || sport.label;
  const sportEventLabel = getSportEventLabel(sportType);
  const themeSlugs = getThemeSlugsForSport(sportType);
  const distanceSlugs = getDistanceSlugsForSport(sportType);
  const themeColor = sport.themeColor;

  // テーマカラーに基づくTailwindクラスのマッピング
  const accentColorClass = sportSlug === "trail" ? "green" : "blue";

  return {
    sportSlug,
    sportType,
    sportLabel,
    sportEventLabel,
    themeSlugs,
    distanceSlugs,
    themeColor,
    accentColorClass,

    /** パンくず共通のトップ部分 */
    baseBreadcrumbs: [
      { label: "トップ", href: "/" },
      { label: sportLabel, href: `/${sportSlug}` },
    ],

    /** 地方インデックスのメタデータ */
    regionIndexMeta: {
      title: `地方別${sportEventLabel}`,
      description: `北海道から九州・沖縄まで、地方別に${sportEventLabel}を探せます。`,
      openGraph: {
        title: `地方別${sportEventLabel} | Risk Monitor`,
        description: `全国8地方の${sportEventLabel}を地域ごとに探せます。`,
        type: "website",
      },
    },

    /** 季節インデックスのメタデータ */
    seasonIndexMeta: {
      title: `季節別${sportEventLabel}`,
      description: `春・夏・秋・冬の季節ごとに${sportEventLabel}を探せます。`,
      openGraph: {
        title: `季節別${sportEventLabel} | Risk Monitor`,
        description: `春夏秋冬の季節別に${sportEventLabel}を探せます。`,
        type: "website",
      },
    },

    /** テーマインデックスのメタデータ */
    themeIndexMeta: {
      title: `テーマ別${sportEventLabel}`,
      description: `目的に合った${sportEventLabel}を探せます。`,
      openGraph: {
        title: `テーマ別${sportEventLabel} | Risk Monitor`,
        description: `目的やテーマ別に${sportEventLabel}を探せます。`,
        type: "website",
      },
    },

    /** 距離インデックスのメタデータ */
    distanceIndexMeta: {
      title: `距離別${sportEventLabel}`,
      description: `距離別に${sportEventLabel}を探せます。`,
      openGraph: {
        title: `距離別${sportEventLabel} | Risk Monitor`,
        description: `距離で絞って${sportEventLabel}を探せます。`,
        type: "website",
      },
    },

    /** 回遊セクション用カテゴリリンク */
    circulationLinks: [
      { label: "地方別で探す", href: `/${sportSlug}/region` },
      { label: "季節別で探す", href: `/${sportSlug}/season` },
      { label: "テーマ別で探す", href: `/${sportSlug}/theme` },
      { label: "距離別で探す", href: `/${sportSlug}/distance` },
    ],

    /** circulationLinksから指定カテゴリを除外 */
    getCirculationLinksExcluding(excludeCategory) {
      return this.circulationLinks.filter((l) => !l.href.endsWith(`/${excludeCategory}`));
    },
  };
}

/**
 * 全対応スポーツのSEOページslugリスト（sitemap用）
 */
export function getAllSportSeoSlugs() {
  return ["marathon", "trail"]; // 新スポーツ追加時にここに追加
}
