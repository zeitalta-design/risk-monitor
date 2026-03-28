/**
 * Phase49: スポーツ種別マスター設定
 *
 * 全スポーツの定義・メタ情報・ルーティング設定を一元管理。
 * 新スポーツ追加時はここに1エントリ追加するだけ。
 *
 * 使い方:
 *   import { getSportBySlug, getEnabledSports, getSportMeta } from "@/lib/sport-config";
 */

// ── スポーツ種別マスター ──
export const SPORT_CONFIGS = [
  {
    key: "marathon",
    slug: "marathon",
    label: "マラソン",
    shortLabel: "マラソン",
    icon: "🏃",
    categoryType: "race",
    enabled: true,
    order: 1,
    themeColor: "#2563eb",          // blue-600
    description: "マラソン・駅伝・ジョギング",
    sportTypeForDb: "marathon",     // events.sport_type に格納される値
    distanceFilters: [
      { key: "", label: "すべて" },
      { key: "5", label: "〜5km" },
      { key: "10", label: "〜10km" },
      { key: "half", label: "ハーフ" },
      { key: "full", label: "フル" },
      { key: "ultra", label: "ウルトラ" },
    ],
    meta: {
      title: "マラソン大会検索",
      pageHeading: "マラソン大会一覧",
      description: "全国のマラソン大会を検索。開催日、地域、距離で絞り込み。",
      ogTitle: "マラソン大会検索 | 大会ナビ",
      ogDescription: "全国のマラソン大会を日程・エリア・距離で検索。締切間近の大会もすぐ見つかる。",
      searchPlaceholder: "大会名・会場名",
      emptyText: "該当するマラソン大会が見つかりませんでした",
      ctaText: "マラソン大会一覧へ →",
      heroText: "全国のマラソン大会を探す",
      subText: "日程・エリア・距離で絞り込んで、あなたのレースを見つけましょう",
    },
  },
  {
    key: "trail",
    slug: "trail",
    label: "トレイルラン",
    shortLabel: "トレイル",
    icon: "⛰️",
    categoryType: "race",
    enabled: true,
    order: 2,
    themeColor: "#16a34a",          // green-600
    description: "山岳・トレイルランニング",
    sportTypeForDb: "trail",
    distanceFilters: [
      { key: "", label: "すべて" },
      { key: "short", label: "ショート(〜20km)" },
      { key: "middle", label: "ミドル(20〜50km)" },
      { key: "long", label: "ロング(50km〜)" },
    ],
    meta: {
      title: "トレイルラン大会検索",
      pageHeading: "トレイルラン大会一覧",
      description: "全国のトレイルランニング大会を検索。山岳レースの情報を網羅。",
      ogTitle: "トレイルラン大会検索 | 大会ナビ",
      ogDescription: "全国のトレイルランニング大会を検索。",
      searchPlaceholder: "大会名・山域名",
      emptyText: "該当するトレイルラン大会が見つかりませんでした",
      ctaText: "トレイルラン大会一覧へ →",
      heroText: "全国のトレイルラン大会を探す",
      subText: "山岳レースを距離・難易度で絞り込み",
    },
  },
  {
    key: "triathlon",
    slug: "triathlon",
    label: "トライアスロン",
    shortLabel: "トライアスロン",
    icon: "🏊",
    categoryType: "race",
    enabled: false,
    order: 3,
    themeColor: "#dc2626",          // red-600
    description: "スイム・バイク・ラン",
    sportTypeForDb: "triathlon",
    showDistanceFilter: false,
    meta: {
      title: "トライアスロン大会検索",
      pageHeading: "トライアスロン大会一覧",
      description: "全国のトライアスロン大会を検索。スイム・バイク・ランの複合競技。",
      ogTitle: "トライアスロン大会検索 | 大会ナビ",
      ogDescription: "全国のトライアスロン大会を検索。",
      searchPlaceholder: "大会名・会場名",
      emptyText: "該当するトライアスロン大会が見つかりませんでした",
      ctaText: "トライアスロン大会一覧へ →",
      heroText: "全国のトライアスロン大会を探す",
      subText: "エリア・日程で絞り込み",
    },
  },
  {
    key: "cycling",
    slug: "cycling",
    label: "サイクリング",
    shortLabel: "自転車",
    icon: "🚴",
    categoryType: "race",
    enabled: false,
    order: 4,
    themeColor: "#ea580c",          // orange-600
    description: "ロード・ヒルクライム・グランフォンド",
    sportTypeForDb: "cycling",
    distanceFilters: [
      { key: "", label: "すべて" },
      { key: "50", label: "〜50km" },
      { key: "100", label: "〜100km" },
      { key: "ultra", label: "100km以上" },
    ],
    meta: {
      title: "サイクリングイベント検索",
      pageHeading: "サイクリングイベント一覧",
      description: "全国のサイクリングイベント・自転車レースを検索。",
      ogTitle: "サイクリングイベント検索 | 大会ナビ",
      ogDescription: "全国の自転車イベントを検索。",
      searchPlaceholder: "イベント名・コース名",
      emptyText: "該当するサイクリングイベントが見つかりませんでした",
      ctaText: "サイクリングイベント一覧へ →",
      heroText: "全国のサイクリングイベントを探す",
      subText: "ロード・ヒルクライムを距離・エリアで絞り込み",
    },
  },
  {
    key: "walking",
    slug: "walking",
    label: "ウォーキング",
    shortLabel: "ウォーキング",
    icon: "🚶",
    categoryType: "race",
    enabled: false,
    order: 5,
    themeColor: "#0891b2",          // cyan-600
    description: "ウォーキング・ハイキング",
    sportTypeForDb: "walking",
    distanceFilters: [
      { key: "", label: "すべて" },
      { key: "5", label: "〜5km" },
      { key: "10", label: "〜10km" },
      { key: "20", label: "〜20km" },
      { key: "ultra", label: "20km以上" },
    ],
    meta: {
      title: "ウォーキングイベント検索",
      pageHeading: "ウォーキングイベント一覧",
      description: "気軽に参加できるウォーキング・ハイキングイベントを検索。",
      ogTitle: "ウォーキングイベント検索 | 大会ナビ",
      ogDescription: "全国のウォーキングイベントを検索。",
      searchPlaceholder: "イベント名・コース名",
      emptyText: "該当するウォーキングイベントが見つかりませんでした",
      ctaText: "ウォーキングイベント一覧へ →",
      heroText: "全国のウォーキングイベントを探す",
      subText: "距離・エリアで絞り込み",
    },
  },
  {
    key: "swimming",
    slug: "swimming",
    label: "水泳",
    shortLabel: "水泳",
    icon: "🏊‍♂️",
    categoryType: "race",
    enabled: false,
    order: 6,
    themeColor: "#4f46e5",          // indigo-600
    description: "オープンウォーター・水泳大会",
    sportTypeForDb: "swimming",
    showDistanceFilter: false,
    meta: {
      title: "水泳大会検索",
      pageHeading: "水泳大会一覧",
      description: "全国の水泳・オープンウォータースイムイベントを検索。",
      ogTitle: "水泳大会検索 | 大会ナビ",
      ogDescription: "全国の水泳大会を検索。",
      searchPlaceholder: "大会名・会場名",
      emptyText: "該当する水泳大会が見つかりませんでした",
      ctaText: "水泳大会一覧へ →",
      heroText: "全国の水泳大会を探す",
      subText: "距離・エリアで絞り込み",
    },
  },
  {
    key: "workshop",
    slug: "workshop",
    label: "練習会・講習会",
    shortLabel: "練習会",
    icon: "📋",
    categoryType: "workshop",
    enabled: false,
    order: 7,
    themeColor: "#7c3aed",          // violet-600
    description: "ランニング練習会・指導セミナー",
    sportTypeForDb: "workshop",
    showDistanceFilter: false,
    meta: {
      title: "練習会・講習会検索",
      pageHeading: "練習会・講習会一覧",
      description: "初心者向け・スキルアップの練習会・講習会を検索。",
      ogTitle: "練習会・講習会検索 | 大会ナビ",
      ogDescription: "全国の練習会・講習会を検索。",
      searchPlaceholder: "イベント名・講師名",
      emptyText: "該当する練習会・講習会が見つかりませんでした",
      ctaText: "練習会・講習会一覧へ →",
      heroText: "全国の練習会・講習会を探す",
      subText: "種目・エリアで絞り込み",
    },
  },
  {
    key: "golf",
    slug: "golf",
    label: "ゴルフ",
    shortLabel: "ゴルフ",
    icon: "⛳",
    categoryType: "golf",
    enabled: false,
    order: 8,
    themeColor: "#16a34a",
    description: "ゴルフコンペ・ゴルフ大会",
    sportTypeForDb: "golf",
    showDistanceFilter: false,
    meta: {
      title: "ゴルフ大会・コンペ検索",
      pageHeading: "ゴルフ大会・コンペ一覧",
      description: "全国のゴルフコンペ・大会を検索。",
      ogTitle: "ゴルフ大会検索 | 大会ナビ",
      ogDescription: "全国のゴルフ大会を検索。",
      searchPlaceholder: "大会名・会場名",
      emptyText: "該当するゴルフ大会が見つかりませんでした",
      ctaText: "ゴルフ大会一覧へ →",
      heroText: "全国のゴルフ大会を探す",
      subText: "エリアで絞り込み",
    },
  },
  {
    key: "squash",
    slug: "squash",
    label: "スカッシュ",
    shortLabel: "スカッシュ",
    icon: "🏸",
    categoryType: "squash",
    enabled: false,
    order: 9,
    themeColor: "#dc2626",
    description: "スカッシュ大会・トーナメント",
    sportTypeForDb: "squash",
    showDistanceFilter: false,
    meta: {
      title: "スカッシュ大会検索",
      pageHeading: "スカッシュ大会・イベント一覧",
      description: "全国のスカッシュ大会・イベントを検索。",
      ogTitle: "スカッシュ大会検索 | 大会ナビ",
      ogDescription: "全国のスカッシュ大会を検索。",
      searchPlaceholder: "大会名・会場名",
      emptyText: "該当するスカッシュ大会が見つかりませんでした",
      ctaText: "スカッシュ大会一覧へ →",
      heroText: "全国のスカッシュ大会を探す",
      subText: "エリアで絞り込み",
    },
  },
];

// ── ヘルパー関数 ──

/** 全スポーツ設定をorder順で取得 */
export function getAllSports() {
  return [...SPORT_CONFIGS].sort((a, b) => a.order - b.order);
}

/** enabled=true のスポーツのみ取得 */
export function getEnabledSports() {
  return getAllSports().filter((s) => s.enabled);
}

/** slug でスポーツ設定を取得（見つからなければ null） */
export function getSportBySlug(slug) {
  return SPORT_CONFIGS.find((s) => s.slug === slug) || null;
}

/** slug で有効なスポーツ設定を取得（enabled=false なら null） */
export function getEnabledSportBySlug(slug) {
  const sport = getSportBySlug(slug);
  return sport?.enabled ? sport : null;
}

/** slug からメタ情報を取得 */
export function getSportMeta(slug) {
  const sport = getSportBySlug(slug);
  return sport?.meta || null;
}

/** slug が有効なスポーツか判定 */
export function isValidSportSlug(slug) {
  return !!getEnabledSportBySlug(slug);
}

/** ナビ用のリンク一覧を生成（enabled のみ） */
export function getSportNavLinks() {
  return getEnabledSports().map((s) => ({
    href: `/${s.slug}`,
    label: s.shortLabel || s.label,
    icon: s.icon,
    key: s.key,
  }));
}

/** カテゴリカード用の一覧を生成（全スポーツ、enabled 状態付き） */
export function getSportCategoryCards() {
  return getAllSports().map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    href: s.enabled ? `/${s.slug}` : "#",
    enabled: s.enabled,
    description: s.description,
    themeColor: s.themeColor,
  }));
}

/**
 * イベントの詳細ページパスを生成
 * event.sport_type からスポーツslugを解決し、/{slug}/{id} を返す。
 * sport_type が見つからない場合は /marathon/{id} にフォールバック。
 */
export function getEventDetailPath(event) {
  if (!event?.id) return "#";
  const sport = SPORT_CONFIGS.find((s) => s.sportTypeForDb === event.sport_type);
  const slug = sport?.slug || "marathon";
  return `/${slug}/${event.id}`;
}

/** Next.js metadata 生成ヘルパー */
export function buildSportMetadata(slug) {
  const sport = getSportBySlug(slug);
  if (!sport) return {};
  const m = sport.meta;
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDescription,
      type: "website",
    },
  };
}
