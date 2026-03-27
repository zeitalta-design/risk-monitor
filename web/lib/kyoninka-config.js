/**
 * 許認可・登録事業者横断検索 — 設定 + ヘルパー
 */

export const kyoninkaConfig = {
  // 許認可カテゴリ（license_family）
  licenseFamilies: [
    { slug: "construction", label: "建設業許可", icon: "🏗️" },
    { slug: "real_estate", label: "宅地建物取引業", icon: "🏠" },
    { slug: "waste_disposal", label: "産業廃棄物処理業", icon: "🚛" },
    { slug: "food_sanitation", label: "食品衛生許可", icon: "🍽️" },
    { slug: "transport", label: "運送業許可", icon: "🚚" },
    { slug: "security", label: "警備業認定", icon: "🛡️" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  // 許認可種別（license_type）— family 内の細分類
  licenseTypes: {
    construction: [
      { value: "general_construction", label: "一般建設業" },
      { value: "special_construction", label: "特定建設業" },
    ],
    real_estate: [
      { value: "real_estate_broker", label: "宅地建物取引業" },
      { value: "real_estate_management", label: "賃貸住宅管理業" },
    ],
    waste_disposal: [
      { value: "collection_transport", label: "収集運搬業" },
      { value: "intermediate_disposal", label: "中間処理業" },
      { value: "final_disposal", label: "最終処分業" },
    ],
    food_sanitation: [
      { value: "restaurant", label: "飲食店営業" },
      { value: "food_manufacturing", label: "食品製造業" },
    ],
    transport: [
      { value: "general_cargo", label: "一般貨物自動車運送" },
      { value: "light_cargo", label: "貨物軽自動車運送" },
    ],
    security: [
      { value: "security_service", label: "警備業" },
    ],
    other: [
      { value: "other", label: "その他" },
    ],
  },

  // 登録状態
  registrationStatuses: [
    { value: "active", label: "有効", color: "badge-green" },
    { value: "expired", label: "期限切れ", color: "badge-amber" },
    { value: "revoked", label: "取消", color: "badge-red" },
    { value: "suspended", label: "停止", color: "badge-amber" },
    { value: "pending", label: "審査中", color: "badge-blue" },
  ],

  // 事業者ステータス
  entityStatuses: [
    { value: "active", label: "営業中" },
    { value: "closed", label: "廃業" },
    { value: "suspended", label: "停止中" },
    { value: "unknown", label: "不明" },
  ],

  sorts: [
    { key: "newest", label: "新着順" },
    { key: "name", label: "名前順" },
    { key: "registration_count", label: "許認可数順" },
  ],

  compareFields: [
    { key: "prefecture", label: "都道府県" },
    { key: "primary_license_family_label", label: "主要許認可" },
    { key: "registration_count", label: "登録数" },
    { key: "entity_status_label", label: "事業者状態" },
  ],

  terminology: {
    item: "事業者",
    itemPlural: "事業者",
    provider: "事業者",
    category: "許認可カテゴリ",
    favorite: "ウォッチ",
  },

  seo: {
    titleTemplate: "%s | 許認可検索",
    descriptionTemplate: "%s の許認可・登録事業者情報。",
    jsonLdType: "Organization",
  },
};

// ─── ヘルパー ────────────────

export function getLicenseFamilyLabel(slug) {
  return kyoninkaConfig.licenseFamilies.find((f) => f.slug === slug)?.label || slug;
}

export function getLicenseFamilyIcon(slug) {
  return kyoninkaConfig.licenseFamilies.find((f) => f.slug === slug)?.icon || "📋";
}

export function getLicenseTypeLabel(family, type) {
  const types = kyoninkaConfig.licenseTypes[family] || [];
  return types.find((t) => t.value === type)?.label || type;
}

export function getRegistrationStatusBadge(status) {
  const s = kyoninkaConfig.registrationStatuses.find((r) => r.value === status);
  return s || { value: status, label: status || "—", color: "badge-gray" };
}

export function getEntityStatusBadge(status) {
  switch (status) {
    case "active": return { label: "営業中", color: "badge-green" };
    case "closed": return { label: "廃業", color: "badge-gray" };
    case "suspended": return { label: "停止中", color: "badge-amber" };
    default: return { label: status || "不明", color: "badge-gray" };
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 法人名の正規化（名寄せ用）
 * 株式会社/有限会社等の法人格を統一、全角→半角、スペース正規化
 */
export function normalizeEntityName(name) {
  if (!name) return "";
  let n = name.trim();
  // 全角英数 → 半角
  n = n.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // カッコの統一
  n = n.replace(/[（）【】\[\]]/g, (c) => {
    if (c === "（" || c === "【" || c === "[") return "(";
    return ")";
  });
  // 法人格の統一表記
  n = n.replace(/\s*株式会社\s*/g, "(株)");
  n = n.replace(/\s*有限会社\s*/g, "(有)");
  n = n.replace(/\s*合同会社\s*/g, "(合)");
  n = n.replace(/\s*合資会社\s*/g, "(資)");
  n = n.replace(/\s*合名会社\s*/g, "(名)");
  // 連続スペース統一
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * 許認可の有効/期限切れ判定
 */
export function isRegistrationValid(reg) {
  if (reg.registration_status === "revoked" || reg.registration_status === "suspended") return false;
  if (!reg.valid_to) return reg.registration_status === "active";
  return new Date(reg.valid_to) >= new Date();
}
