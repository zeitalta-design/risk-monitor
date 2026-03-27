/**
 * 食品リコール監視ダッシュボード — ドメイン登録
 */

import { registerDomain } from "../core/domain-registry";
import { foodRecallConfig } from "../food-recall-config";

registerDomain({
  id: "food-recall",
  name: "食品リコール監視",
  basePath: "/food-recall",
  apiBasePath: "/api/food-recall",
  adminBasePath: "/admin/food-recall",

  categories: foodRecallConfig.categories,

  statuses: foodRecallConfig.statusOptions.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.value === "active" ? "red" : s.value === "completed" ? "green" : "amber",
  })),

  filters: [
    { key: "category", label: "食品カテゴリ", type: "select", source: "categories" },
    { key: "risk_level", label: "リスクレベル", type: "select" },
    { key: "reason", label: "原因", type: "select" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],

  sorts: foodRecallConfig.sorts,
  compareFields: foodRecallConfig.compareFields,
  terminology: foodRecallConfig.terminology,

  favorites: {
    tableName: "food_recall_favorites",
    idColumn: "food_recall_id",
    checkEndpoint: "/api/food-recall-favorites?check=",
    apiEndpoint: "/api/food-recall-favorites",
    deleteEndpoint: "/api/food-recall-favorites/",
  },

  savedSearches: {
    tableName: "food_recall_saved_searches",
    apiEndpoint: "/api/food-recall-saved-searches",
  },

  seo: foodRecallConfig.seo,

  db: {
    mainTable: "food_recall_items",
    idColumn: "id",
  },
});
