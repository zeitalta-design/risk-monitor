/**
 * 許認可・登録事業者横断検索 — ドメイン登録
 */

import { registerDomain } from "../core/domain-registry";
import { kyoninkaConfig } from "../kyoninka-config";

registerDomain({
  id: "kyoninka",
  name: "許認可検索",
  basePath: "/kyoninka",
  apiBasePath: "/api/kyoninka",
  adminBasePath: "/admin/kyoninka",

  categories: kyoninkaConfig.licenseFamilies.map((f) => ({
    slug: f.slug,
    label: f.label,
    icon: f.icon,
  })),

  statuses: kyoninkaConfig.entityStatuses.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.value === "active" ? "green" : s.value === "suspended" ? "amber" : "gray",
  })),

  filters: [
    { key: "prefecture", label: "都道府県", type: "select" },
    { key: "license_family", label: "許認可カテゴリ", type: "select", source: "categories" },
    { key: "entity_status", label: "事業者状態", type: "select" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],

  sorts: kyoninkaConfig.sorts,
  compareFields: kyoninkaConfig.compareFields,
  terminology: kyoninkaConfig.terminology,

  favorites: {
    tableName: "kyoninka_favorites",
    idColumn: "kyoninka_id",
    checkEndpoint: "/api/kyoninka-favorites?check=",
    apiEndpoint: "/api/kyoninka-favorites",
    deleteEndpoint: "/api/kyoninka-favorites/",
  },

  savedSearches: {
    tableName: "kyoninka_saved_searches",
    apiEndpoint: "/api/kyoninka-saved-searches",
  },

  seo: kyoninkaConfig.seo,

  db: {
    mainTable: "kyoninka_entities",
    idColumn: "id",
    detailTable: "kyoninka_registrations",
    detailFkColumn: "entity_id",
  },
});
