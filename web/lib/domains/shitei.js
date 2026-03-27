/**
 * 指定管理・委託公募まとめ — ドメイン登録
 */

import { registerDomain } from "../core/domain-registry";
import { shiteiConfig } from "../shitei-config";

registerDomain({
  id: "shitei",
  name: "指定管理公募まとめ",
  basePath: "/shitei",
  apiBasePath: "/api/shitei",
  adminBasePath: "/admin/shitei",

  categories: shiteiConfig.facilityCategories.map((c) => ({
    slug: c.slug,
    label: c.label,
    icon: c.icon,
  })),

  statuses: shiteiConfig.recruitmentStatuses.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.value === "open" ? "green" : s.value === "upcoming" ? "blue" : s.value === "reviewing" ? "amber" : "gray",
  })),

  filters: [
    { key: "prefecture", label: "都道府県", type: "select" },
    { key: "facility_category", label: "施設種別", type: "select", source: "categories" },
    { key: "recruitment_status", label: "募集状態", type: "select" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],

  sorts: shiteiConfig.sorts,
  compareFields: shiteiConfig.compareFields,
  terminology: shiteiConfig.terminology,

  favorites: {
    tableName: "shitei_favorites",
    idColumn: "shitei_id",
    checkEndpoint: "/api/shitei-favorites?check=",
    apiEndpoint: "/api/shitei-favorites",
    deleteEndpoint: "/api/shitei-favorites/",
  },

  savedSearches: {
    tableName: "shitei_saved_searches",
    apiEndpoint: "/api/shitei-saved-searches",
  },

  seo: shiteiConfig.seo,

  db: {
    mainTable: "shitei_items",
    idColumn: "id",
  },
});
