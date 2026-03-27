/**
 * 産廃処理業者・行政処分ウォッチ — 設定 + ヘルパー
 */

export const sanpaiConfig = {
  // 許可種別
  licenseTypes: [
    { slug: "collection_transport", label: "収集運搬業", icon: "🚛" },
    { slug: "intermediate", label: "中間処理業", icon: "🏭" },
    { slug: "final_disposal", label: "最終処分業", icon: "🏗️" },
    { slug: "special_collection", label: "特別管理収集運搬業", icon: "☢️" },
    { slug: "special_intermediate", label: "特別管理中間処理業", icon: "⚠️" },
    { slug: "special_final", label: "特別管理最終処分業", icon: "🔒" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  // 廃棄物区分
  wasteCategories: [
    { slug: "industrial", label: "産業廃棄物" },
    { slug: "special_industrial", label: "特別管理産業廃棄物" },
    { slug: "mixed", label: "混合廃棄物" },
    { slug: "other", label: "その他" },
  ],

  // 処分種別（行政処分の種類）
  penaltyTypes: [
    { value: "license_revocation", label: "許可取消", severity: 5 },
    { value: "business_suspension", label: "事業停止命令", severity: 4 },
    { value: "improvement_order", label: "改善命令", severity: 3 },
    { value: "warning", label: "警告", severity: 2 },
    { value: "guidance", label: "行政指導", severity: 1 },
    { value: "other", label: "その他", severity: 1 },
  ],

  // リスクレベル
  riskLevels: [
    { value: "critical", label: "重大", color: "badge-red", description: "許可取消・重大違反あり" },
    { value: "high", label: "高", color: "badge-amber", description: "事業停止命令あり" },
    { value: "medium", label: "中", color: "badge-blue", description: "改善命令あり" },
    { value: "low", label: "低", color: "badge-green", description: "軽微な違反のみ" },
    { value: "none", label: "処分なし", color: "badge-gray", description: "行政処分の記録なし" },
  ],

  // 事業者ステータス
  statusOptions: [
    { value: "active", label: "営業中" },
    { value: "suspended", label: "停止中" },
    { value: "revoked", label: "許可取消" },
    { value: "closed", label: "廃業" },
  ],

  sorts: [
    { key: "newest", label: "新着順" },
    { key: "risk_high", label: "リスク高い順" },
    { key: "penalty_recent", label: "直近処分順" },
  ],

  compareFields: [
    { key: "prefecture", label: "都道府県" },
    { key: "license_type_label", label: "許可種別" },
    { key: "risk_level_label", label: "リスクレベル" },
    { key: "penalty_count", label: "処分件数" },
    { key: "latest_penalty_date", label: "直近処分日" },
  ],

  terminology: {
    item: "事業者",
    itemPlural: "事業者",
    provider: "事業者",
    category: "許可種別",
    favorite: "ウォッチ",
  },

  seo: {
    titleTemplate: "%s | 産廃処分ウォッチ",
    descriptionTemplate: "%s の産業廃棄物処理業者・行政処分情報。",
    jsonLdType: "Organization",
  },
};

// ─── ヘルパー ────────────────

export function getLicenseTypeLabel(slug) {
  return sanpaiConfig.licenseTypes.find((t) => t.slug === slug)?.label || slug;
}

export function getLicenseTypeIcon(slug) {
  return sanpaiConfig.licenseTypes.find((t) => t.slug === slug)?.icon || "📋";
}

export function getWasteCategoryLabel(slug) {
  return sanpaiConfig.wasteCategories.find((c) => c.slug === slug)?.label || slug;
}

export function getRiskLevel(level) {
  return sanpaiConfig.riskLevels.find((r) => r.value === level) || sanpaiConfig.riskLevels[4];
}

export function getRiskLevelLabel(level) {
  return getRiskLevel(level).label;
}

export function getPenaltyTypeLabel(type) {
  return sanpaiConfig.penaltyTypes.find((t) => t.value === type)?.label || type;
}

export function getPenaltyTypeSeverity(type) {
  return sanpaiConfig.penaltyTypes.find((t) => t.value === type)?.severity || 1;
}

export function getStatusBadge(status) {
  switch (status) {
    case "active": return { label: "営業中", color: "badge-green" };
    case "suspended": return { label: "停止中", color: "badge-amber" };
    case "revoked": return { label: "許可取消", color: "badge-red" };
    case "closed": return { label: "廃業", color: "badge-gray" };
    default: return { label: status || "—", color: "badge-gray" };
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 簡易リスクレベル計算（ルールベース）
 * - 許可取消があれば critical
 * - 事業停止命令があれば high
 * - 改善命令があれば medium
 * - それ以外の処分のみなら low
 * - 処分なしなら none
 */
export function calculateRiskLevel(penalties = []) {
  if (!penalties || penalties.length === 0) return "none";
  const types = penalties.map((p) => p.penalty_type);
  if (types.includes("license_revocation")) return "critical";
  if (types.includes("business_suspension")) return "high";
  if (types.includes("improvement_order")) return "medium";
  return "low";
}

export function getDaysSincePenalty(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays <= 30) return { text: `${diffDays}日前`, recent: true };
  if (diffDays <= 365) return { text: `${Math.floor(diffDays / 30)}ヶ月前`, recent: false };
  return { text: `${Math.floor(diffDays / 365)}年前`, recent: false };
}
