/**
 * Phase108: SEO拡張の全体設計定義
 * 地方・テーマ・季節のslugマッピングとメタデータ生成
 */

import { REGIONS } from "@/lib/constants";
import { DISTANCE_SLUGS, TRAIL_DISTANCE_SLUGS, PREFECTURE_SLUGS, PREFECTURE_NAME_TO_SLUG, REGION_GROUPS, getSportEventLabel } from "@/lib/seo-mappings";

// ==============================
// 地方slug定義
// ==============================
export const REGION_SLUGS = {
  hokkaido: { label: "北海道", shortLabel: "北海道", description: "北海道で開催される大会を検索できます。" },
  tohoku: { label: "東北", shortLabel: "東北", description: "東北地方（青森・岩手・宮城・秋田・山形・福島）の大会を検索できます。" },
  kanto: { label: "関東", shortLabel: "関東", description: "関東地方（東京・神奈川・埼玉・千葉・茨城・栃木・群馬）の大会を検索できます。" },
  chubu: { label: "中部", shortLabel: "中部", description: "中部地方（新潟・富山・石川・福井・山梨・長野・岐阜・静岡・愛知）の大会を検索できます。" },
  kinki: { label: "近畿", shortLabel: "近畿", description: "近畿地方（三重・滋賀・京都・大阪・兵庫・奈良・和歌山）の大会を検索できます。" },
  chugoku: { label: "中国", shortLabel: "中国", description: "中国地方（鳥取・島根・岡山・広島・山口）の大会を検索できます。" },
  shikoku: { label: "四国", shortLabel: "四国", description: "四国地方（徳島・香川・愛媛・高知）の大会を検索できます。" },
  kyushu: { label: "九州・沖縄", shortLabel: "九州", description: "九州・沖縄地方（福岡・佐賀・長崎・熊本・大分・宮崎・鹿児島・沖縄）の大会を検索できます。" },
};

/** 地方slug → REGIONS定数のkey変換 */
const REGION_SLUG_TO_REGIONS_KEY = {
  hokkaido: "hokkaido",
  tohoku: "tohoku",
  kanto: "kanto",
  chubu: "chubu",
  kinki: "kinki",
  chugoku: "chugoku",
  shikoku: "shikoku",
  kyushu: "kyushu",
};

/** 地方slugから該当都道府県名リストを取得 */
export function getPrefecturesByRegion(regionSlug) {
  const regionsKey = REGION_SLUG_TO_REGIONS_KEY[regionSlug];
  if (!regionsKey) return [];
  const region = REGIONS.find((r) => r.key === regionsKey);
  return region ? region.prefectures : [];
}

/** 地方slugから都道府県slugリストを取得（内部リンク用） */
export function getPrefectureSlugsForRegion(regionSlug) {
  const regionGroup = REGION_GROUPS.find((rg) => {
    const info = REGION_SLUGS[regionSlug];
    return info && rg.label.includes(info.shortLabel);
  });
  // fallback: REGIONS から都道府県名→slug変換
  const prefNames = getPrefecturesByRegion(regionSlug);
  return prefNames.map((name) => PREFECTURE_NAME_TO_SLUG[name]).filter(Boolean);
}

// ==============================
// Phase118: トレイルラン用テーマslug定義
// ==============================
export const TRAIL_THEME_SLUGS = {
  beginner: {
    label: "初心者向けトレイルラン大会",
    shortLabel: "初心者向け",
    icon: "🔰",
    description: "初めてのトレイルランにもおすすめの大会を探せます。",
    filterDescription: "初心者歓迎のトレイルラン大会を集めました",
  },
  scenic: {
    label: "絶景コースの大会",
    shortLabel: "絶景コース",
    icon: "🏔️",
    description: "絶景の山岳コースを走れるトレイルラン大会を探せます。",
    filterDescription: "絶景を楽しめるトレイルラン大会を集めました",
  },
  deadline: {
    label: "締切間近の大会",
    shortLabel: "締切間近",
    icon: "⏰",
    description: "エントリー締切が近いトレイルラン大会を探せます。早めの申し込みがおすすめです。",
    filterDescription: "締切が迫っているトレイルラン大会です。お早めにどうぞ",
  },
  open: {
    label: "募集中の大会",
    shortLabel: "募集中",
    icon: "✅",
    description: "現在エントリーを受付中のトレイルラン大会を探せます。",
    filterDescription: "今すぐエントリーできるトレイルラン大会です",
  },
  popular: {
    label: "人気の大会",
    shortLabel: "人気",
    icon: "🔥",
    description: "注目度の高い人気トレイルラン大会を探せます。",
    filterDescription: "多くのランナーに注目されているトレイルラン大会です",
  },
};

/** スポーツ別のテーマslug定義を取得 */
export function getThemeSlugsForSport(sportType = "marathon") {
  return sportType === "trail" ? TRAIL_THEME_SLUGS : THEME_SLUGS;
}

/** スポーツ別の距離slug定義を取得 */
export function getDistanceSlugsForSport(sportType = "marathon") {
  return sportType === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
}

// ==============================
// テーマslug定義
// ==============================
export const THEME_SLUGS = {
  beginner: {
    label: "初心者向け大会",
    shortLabel: "初心者向け",
    icon: "🔰",
    description: "初めてのマラソンにもおすすめの大会を探せます。",
    filterDescription: "初心者歓迎の大会を集めました",
  },
  "flat-course": {
    label: "フラットコースの大会",
    shortLabel: "フラットコース",
    icon: "🛤️",
    description: "高低差が少なく走りやすいフラットコースの大会を探せます。",
    filterDescription: "平坦で走りやすい大会を集めました",
  },
  record: {
    label: "記録狙いの大会",
    shortLabel: "記録狙い",
    icon: "⏱️",
    description: "好タイムを狙いやすい大会を探せます。",
    filterDescription: "自己ベスト更新を狙える大会を集めました",
  },
  sightseeing: {
    label: "旅ラン・遠征におすすめの大会",
    shortLabel: "旅ラン・遠征",
    icon: "📸",
    description: "旅ランや遠征で楽しめるマラソン大会を探せます。観光・温泉・ご当地グルメも。",
    filterDescription: "旅ランや遠征にぴったりの大会を集めました",
  },
  deadline: {
    label: "締切間近の大会",
    shortLabel: "締切間近",
    icon: "⏰",
    description: "エントリー締切が近い大会を探せます。早めの申し込みがおすすめです。",
    filterDescription: "締切が迫っている大会です。お早めにどうぞ",
  },
  open: {
    label: "募集中の大会",
    shortLabel: "募集中",
    icon: "✅",
    description: "現在エントリーを受付中の大会を探せます。",
    filterDescription: "今すぐエントリーできる大会です",
  },
  popular: {
    label: "人気の大会",
    shortLabel: "人気",
    icon: "🔥",
    description: "注目度の高い人気マラソン大会を探せます。",
    filterDescription: "多くのランナーに注目されている大会です",
  },
  family: {
    label: "親子・ファミリー向け大会",
    shortLabel: "親子・ファミリー",
    icon: "👨‍👩‍👧‍👦",
    description: "お子さまと一緒に参加できるファミリー向けのマラソン大会を探せます。",
    filterDescription: "親子やファミリーで楽しめる大会を集めました",
  },
};

// ==============================
// 季節slug定義
// ==============================
export const SEASON_SLUGS = {
  spring: { label: "春", months: [3, 4, 5], description: "春（3〜5月）開催の大会を探せます。気候が良く走りやすいシーズンです。" },
  summer: { label: "夏", months: [6, 7, 8], description: "夏（6〜8月）開催の大会を探せます。暑さ対策をしっかりして参加しましょう。" },
  autumn: { label: "秋", months: [9, 10, 11], description: "秋（9〜11月）開催の大会を探せます。マラソンのベストシーズンです。" },
  winter: { label: "冬", months: [12, 1, 2], description: "冬（12〜2月）開催の大会を探せます。涼しい気候で好記録が狙えます。" },
};

// ==============================
// メタデータ生成ヘルパー
// ==============================

/** 地方ページのメタデータ */
export function buildRegionMetadata(regionSlug, sportType = "marathon") {
  const info = REGION_SLUGS[regionSlug];
  if (!info) return {};
  const sportLabel = getSportEventLabel(sportType);
  return {
    title: `${info.label}の${sportLabel}`,
    description: `${info.label}で開催される${sportLabel}を探せます。開催日、締切、距離を比較して大会を見つけられます。`,
    openGraph: {
      title: `${info.label}の${sportLabel} | 大会ナビ`,
      description: `${info.label}の${sportLabel}一覧。日程・距離・締切で比較できます。`,
      type: "website",
    },
  };
}

/** 地方×距離ページのメタデータ */
export function buildRegionDistanceMetadata(regionSlug, distanceSlug, sportType = "marathon") {
  const regionInfo = REGION_SLUGS[regionSlug];
  const distanceSlugs = sportType === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  const distanceInfo = distanceSlugs[distanceSlug];
  if (!regionInfo || !distanceInfo) return {};
  return {
    title: `${regionInfo.label}の${distanceInfo.label}大会`,
    description: `${regionInfo.label}で開催される${distanceInfo.label}大会を探せます。開催日、締切を比較して大会を見つけられます。`,
    openGraph: {
      title: `${regionInfo.label}の${distanceInfo.label}大会 | 大会ナビ`,
      description: `${regionInfo.label}の${distanceInfo.label}大会一覧。`,
      type: "website",
    },
  };
}

/** 季節ページのメタデータ */
export function buildSeasonMetadata(seasonSlug, sportType = "marathon") {
  const info = SEASON_SLUGS[seasonSlug];
  if (!info) return {};
  const sportLabel = getSportEventLabel(sportType);
  return {
    title: `${info.label}開催の${sportLabel}`,
    description: info.description,
    openGraph: {
      title: `${info.label}開催の${sportLabel} | 大会ナビ`,
      description: info.description,
      type: "website",
    },
  };
}

/** テーマページのメタデータ */
export function buildThemeMetadata(themeSlug, sportType = "marathon") {
  const themeSlugs = sportType === "trail" ? TRAIL_THEME_SLUGS : THEME_SLUGS;
  const info = themeSlugs[themeSlug];
  if (!info) return {};
  return {
    title: info.label,
    description: info.description,
    openGraph: {
      title: `${info.label} | 大会ナビ`,
      description: info.description,
      type: "website",
    },
  };
}

// ==============================
// 内部リンク生成ヘルパー
// ==============================

/** 地方ページの関連リンク */
export function buildRegionRelatedLinks(regionSlug, sportSlug = "marathon") {
  const links = [];
  // 他の地方
  for (const [slug, info] of Object.entries(REGION_SLUGS)) {
    if (slug !== regionSlug) {
      links.push({ label: `${info.label}の大会`, href: `/${sportSlug}/region/${slug}` });
    }
  }
  // 距離別（スポーツに応じた距離slug）
  const distanceSlugs = sportSlug === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  for (const [slug, info] of Object.entries(distanceSlugs)) {
    links.push({ label: info.shortLabel || info.label, href: `/${sportSlug}/distance/${slug}` });
  }
  // テーマ別（主要）
  links.push({ label: "初心者向け", href: `/${sportSlug}/theme/beginner` });
  links.push({ label: "募集中", href: `/${sportSlug}/theme/open` });
  links.push({ label: "締切間近", href: `/${sportSlug}/theme/deadline` });
  return links;
}

/** テーマページの関連リンク */
export function buildThemeRelatedLinks(themeSlug, sportSlug = "marathon") {
  const links = [];
  // 他のテーマ（スポーツ別のテーマslug）
  const themeSlugs = sportSlug === "trail" ? TRAIL_THEME_SLUGS : THEME_SLUGS;
  for (const [slug, info] of Object.entries(themeSlugs)) {
    if (slug !== themeSlug) {
      links.push({ label: info.shortLabel, href: `/${sportSlug}/theme/${slug}` });
    }
  }
  // 地方別（主要）
  for (const slug of ["kanto", "kinki", "chubu", "kyushu"]) {
    const info = REGION_SLUGS[slug];
    if (info) links.push({ label: `${info.label}の大会`, href: `/${sportSlug}/region/${slug}` });
  }
  // 距離別（スポーツに応じた距離slug）
  const distanceSlugs = sportSlug === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  for (const [slug, info] of Object.entries(distanceSlugs)) {
    links.push({ label: info.shortLabel || info.label, href: `/${sportSlug}/distance/${slug}` });
  }
  return links;
}

/** 季節ページの関連リンク */
export function buildSeasonRelatedLinks(seasonSlug, sportSlug = "marathon") {
  const links = [];
  // 他の季節
  for (const [slug, info] of Object.entries(SEASON_SLUGS)) {
    if (slug !== seasonSlug) {
      links.push({ label: `${info.label}の大会`, href: `/${sportSlug}/season/${slug}` });
    }
  }
  // 該当月の個別ページ
  const season = SEASON_SLUGS[seasonSlug];
  if (season) {
    for (const m of season.months) {
      links.push({ label: `${m}月の大会`, href: `/${sportSlug}/month/${m}` });
    }
  }
  // 距離別（スポーツに応じた距離slug）
  const distanceSlugs = sportSlug === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  for (const [slug, info] of Object.entries(distanceSlugs)) {
    links.push({ label: info.shortLabel || info.label, href: `/${sportSlug}/distance/${slug}` });
  }
  // テーマ別（主要）
  links.push({ label: "初心者向け", href: `/${sportSlug}/theme/beginner` });
  links.push({ label: "人気の大会", href: `/${sportSlug}/theme/popular` });
  return links;
}

/** 全カテゴリ横断の主要リンク（フッター・トップ用） */
export function buildSeoNavigationLinks(sportSlug = "marathon") {
  const distanceSlugs = sportSlug === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  const themeSlugs = sportSlug === "trail" ? TRAIL_THEME_SLUGS : THEME_SLUGS;
  return {
    regions: Object.entries(REGION_SLUGS).map(([slug, info]) => ({
      label: info.label,
      href: `/${sportSlug}/region/${slug}`,
    })),
    distances: Object.entries(distanceSlugs).map(([slug, info]) => ({
      label: info.shortLabel || info.label,
      href: `/${sportSlug}/distance/${slug}`,
    })),
    seasons: Object.entries(SEASON_SLUGS).map(([slug, info]) => ({
      label: `${info.label}の大会`,
      href: `/${sportSlug}/season/${slug}`,
    })),
    themes: Object.entries(themeSlugs).map(([slug, info]) => ({
      label: info.shortLabel,
      href: `/${sportSlug}/theme/${slug}`,
    })),
  };
}
