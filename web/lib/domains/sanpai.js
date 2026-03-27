/**
 * 産廃処理業者・行政処分ウォッチ — ドメイン登録
 */

import { registerDomain } from "../core/domain-registry";
import { sanpaiConfig } from "../sanpai-config";

registerDomain({
  id: "sanpai",
  name: "産廃処分ウォッチ",
  basePath: "/sanpai",
  apiBasePath: "/api/sanpai",
  adminBasePath: "/admin/sanpai",

  categories: sanpaiConfig.licenseTypes.map((t) => ({
    slug: t.slug,
    label: t.label,
    icon: t.icon,
  })),

  statuses: sanpaiConfig.statusOptions.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.value === "active" ? "green" : s.value === "suspended" ? "amber" : s.value === "revoked" ? "red" : "gray",
  })),

  filters: [
    { key: "prefecture", label: "都道府県", type: "select" },
    { key: "license_type", label: "許可種別", type: "select", source: "categories" },
    { key: "risk_level", label: "リスクレベル", type: "select" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],

  sorts: sanpaiConfig.sorts,
  compareFields: sanpaiConfig.compareFields,
  terminology: sanpaiConfig.terminology,

  favorites: {
    tableName: "sanpai_favorites",
    idColumn: "sanpai_id",
    checkEndpoint: "/api/sanpai-favorites?check=",
    apiEndpoint: "/api/sanpai-favorites",
    deleteEndpoint: "/api/sanpai-favorites/",
  },

  savedSearches: {
    tableName: "sanpai_saved_searches",
    apiEndpoint: "/api/sanpai-saved-searches",
  },

  seo: sanpaiConfig.seo,

  db: {
    mainTable: "sanpai_items",
    idColumn: "id",
    detailTable: "sanpai_penalties",
    detailFkColumn: "sanpai_item_id",
  },
});
