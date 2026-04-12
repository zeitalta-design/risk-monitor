/**
 * Sports ドメイン定義
 *
 * 既存の sport-config.js / constants.js を参照し、
 * domain-registry の統一インターフェースに合わせる薄いラッパー。
 *
 * 注意: sport-config.js 自体は一切変更しない。
 */

import { registerDomain } from "../core/domain-registry";
import { SPORT_CONFIGS, getSportBySlug } from "../sport-config";
import { ENTRY_STATUS, REGIONS } from "../constants";

// marathon を代表スポーツとして使用（将来 trail 等も対応可能）
const marathon = getSportBySlug("marathon");

const sportsCategories = SPORT_CONFIGS
  .filter((s) => s.enabled)
  .map((s) => ({
    slug: s.slug,
    label: s.label,
    icon: s.icon,
  }));

const sportsStatuses = Object.entries(ENTRY_STATUS).map(([key, val]) => ({
  key,
  label: val.label,
  color: val.color,
}));

const sportsSorts = [
  { key: "event_date", label: "開催日順" },
  { key: "entry_end_date", label: "締切日順" },
  { key: "popularity", label: "人気順" },
  { key: "newest", label: "新着順" },
  { key: "entry_status_priority", label: "募集状態順" },
];

const sportsCompareFields = [
  { key: "event_date", label: "開催日" },
  { key: "prefecture", label: "開催地" },
  { key: "distance", label: "距離" },
  { key: "fee", label: "参加費" },
  { key: "entry_status", label: "募集状態" },
  { key: "entry_end_date", label: "申込締切" },
  { key: "capacity", label: "定員" },
  { key: "review_count", label: "レビュー数" },
];

const sportsFilters = [
  { key: "sport_type", label: "スポーツ種別", type: "select", source: "categories" },
  { key: "prefecture", label: "都道府県", type: "select", options: REGIONS.flatMap((r) => r.prefectures.map((p) => ({ value: p, label: p }))) },
  { key: "month", label: "開催月", type: "select" },
  { key: "distance", label: "距離", type: "select", options: marathon?.distanceFilters || [] },
  { key: "entry_status", label: "募集状態", type: "select", source: "statuses" },
  { key: "keyword", label: "キーワード", type: "text" },
];

registerDomain({
  id: "sports",
  name: "スポーツ大会",
  basePath: "/marathon",
  apiBasePath: "/api/events",
  adminBasePath: "/admin/events",

  categories: sportsCategories,
  statuses: sportsStatuses,
  filters: sportsFilters,
  sorts: sportsSorts,
  compareFields: sportsCompareFields,

  terminology: {
    item: "大会",
    itemPlural: "大会一覧",
    provider: "主催者",
    category: "スポーツ種別",
    favorite: "お気に入り",
    variant: "種目",
  },

  favorites: {
    tableName: "favorites",
    idColumn: "event_id",
    checkEndpoint: "/api/favorites?check=",
    apiEndpoint: "/api/favorites",
    deleteEndpoint: "/api/favorites/", // + eventId
  },

  savedSearches: {
    tableName: "saved_searches",
    apiEndpoint: "/api/saved-searches",
  },

  seo: {
    titleTemplate: "{title} | Risk Monitor",
    descriptionTemplate: "{title}の詳細情報。開催日、エントリー状況、コース情報など。",
    jsonLdType: "SportsEvent",
  },

  db: {
    mainTable: "events",
    idColumn: "id",
    detailTable: "marathon_details",
    detailFkColumn: "marathon_id",
  },

  // sports 固有の追加設定
  extra: {
    regions: REGIONS,
    sportConfigs: SPORT_CONFIGS,
  },
});

export { getDomain } from "../core/domain-registry";
