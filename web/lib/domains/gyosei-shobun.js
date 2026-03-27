/**
 * 行政処分DB — ドメイン登録
 */

import { registerDomain } from "../core/domain-registry";
import { gyoseiShobunConfig } from "../gyosei-shobun-config";

registerDomain({
  id: "gyosei-shobun",
  name: "行政処分DB",
  basePath: "/gyosei-shobun",
  apiBasePath: "/api/gyosei-shobun",
  adminBasePath: "/admin/gyosei-shobun",

  categories: gyoseiShobunConfig.actionTypes.map((t) => ({
    slug: t.slug,
    label: t.label,
    icon: t.icon,
  })),

  statuses: gyoseiShobunConfig.reviewStatuses.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.color,
  })),

  filters: [
    { key: "action_type", label: "処分種別", type: "select", source: "categories" },
    { key: "prefecture", label: "都道府県", type: "select" },
    { key: "industry", label: "業種", type: "select" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],

  sorts: gyoseiShobunConfig.sorts,
  compareFields: gyoseiShobunConfig.compareFields,
  terminology: gyoseiShobunConfig.terminology,

  favorites: {
    tableName: "administrative_action_favorites",
    idColumn: "action_id",
    checkEndpoint: "/api/gyosei-shobun-favorites?check=",
    apiEndpoint: "/api/gyosei-shobun-favorites",
    deleteEndpoint: "/api/gyosei-shobun-favorites/",
  },

  seo: gyoseiShobunConfig.seo,

  db: {
    mainTable: "administrative_actions",
    idColumn: "id",
  },
});
