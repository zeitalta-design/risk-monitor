/**
 * 食品リコール監視ダッシュボード — 設定 + ヘルパー
 */

export const foodRecallConfig = {
  categories: [
    { slug: "processed", label: "加工食品", icon: "🥫" },
    { slug: "fresh", label: "生鮮食品", icon: "🥬" },
    { slug: "beverage", label: "飲料", icon: "🥤" },
    { slug: "dairy", label: "乳製品", icon: "🧀" },
    { slug: "confectionery", label: "菓子", icon: "🍪" },
    { slug: "frozen", label: "冷凍食品", icon: "🧊" },
    { slug: "seasoning", label: "調味料", icon: "🧂" },
    { slug: "supplement", label: "健康食品・サプリ", icon: "💊" },
    { slug: "other", label: "その他", icon: "📦" },
  ],

  riskLevels: [
    { value: "class1", label: "Class I（重篤）", color: "badge-red", description: "健康被害の可能性が高い" },
    { value: "class2", label: "Class II（中程度）", color: "badge-amber", description: "健康被害の可能性が低い" },
    { value: "class3", label: "Class III（軽微）", color: "badge-blue", description: "健康被害の可能性がほぼない" },
    { value: "unknown", label: "未分類", color: "badge-gray", description: "リスクレベル未確定" },
  ],

  reasons: [
    { value: "foreign_matter", label: "異物混入" },
    { value: "microbe", label: "微生物汚染" },
    { value: "allergen", label: "アレルゲン表示不備" },
    { value: "chemical", label: "化学物質" },
    { value: "labeling", label: "表示不備" },
    { value: "quality", label: "品質不良" },
    { value: "other", label: "その他" },
  ],

  statusOptions: [
    { value: "active", label: "回収中" },
    { value: "completed", label: "回収完了" },
    { value: "investigating", label: "調査中" },
  ],

  recallTypes: [
    { value: "recall", label: "リコール" },
    { value: "voluntary", label: "自主回収" },
    { value: "alert", label: "注意喚起" },
  ],

  sorts: [
    { key: "newest", label: "新着順" },
    { key: "risk_high", label: "リスク高い順" },
    { key: "popular", label: "閲覧順" },
  ],

  compareFields: [
    { key: "category_label", label: "食品カテゴリ" },
    { key: "manufacturer", label: "製造者" },
    { key: "risk_level_label", label: "リスクレベル" },
    { key: "reason_label", label: "原因" },
    { key: "recall_date", label: "リコール日" },
  ],

  terminology: {
    item: "リコール",
    itemPlural: "リコール",
    provider: "製造者",
    category: "食品カテゴリ",
    favorite: "ウォッチ",
  },

  seo: {
    titleTemplate: "%s | 食品リコール監視",
    descriptionTemplate: "%s の食品リコール・自主回収情報。",
    jsonLdType: "Product",
  },
};

// ─── ヘルパー ────────────────

export function getCategoryLabel(slug) {
  return foodRecallConfig.categories.find((c) => c.slug === slug)?.label || slug;
}

export function getCategoryIcon(slug) {
  return foodRecallConfig.categories.find((c) => c.slug === slug)?.icon || "📦";
}

export function getRiskLevel(level) {
  return foodRecallConfig.riskLevels.find((r) => r.value === level) || foodRecallConfig.riskLevels[3];
}

export function getRiskLevelLabel(level) {
  return getRiskLevel(level).label;
}

export function getReasonLabel(reason) {
  return foodRecallConfig.reasons.find((r) => r.value === reason)?.label || reason;
}

export function getRecallTypeLabel(type) {
  return foodRecallConfig.recallTypes.find((t) => t.value === type)?.label || type;
}

export function getStatusBadge(status) {
  switch (status) {
    case "active": return { label: "回収中", color: "badge-red" };
    case "completed": return { label: "回収完了", color: "badge-green" };
    case "investigating": return { label: "調査中", color: "badge-amber" };
    default: return { label: status || "—", color: "badge-gray" };
  }
}

export function formatRecallDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaysSinceRecall(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return { text: "本日", recent: true };
  if (diffDays <= 3) return { text: `${diffDays}日前`, recent: true };
  if (diffDays <= 7) return { text: `${diffDays}日前`, recent: false };
  return { text: `${diffDays}日前`, recent: false };
}
