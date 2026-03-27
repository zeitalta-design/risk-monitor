/**
 * 行政処分DB — 設定
 */

export const gyoseiShobunConfig = {
  // 処分種別
  actionTypes: [
    { slug: "license_revocation", label: "許可取消", icon: "🚫", severity: 5 },
    { slug: "business_suspension", label: "営業停止命令", icon: "⛔", severity: 4 },
    { slug: "improvement_order", label: "改善命令", icon: "⚠️", severity: 3 },
    { slug: "warning", label: "警告", icon: "📢", severity: 2 },
    { slug: "guidance", label: "行政指導", icon: "📋", severity: 1 },
    { slug: "other", label: "その他", icon: "📄", severity: 1 },
  ],

  // 行政機関レベル
  authorityLevels: [
    { value: "national", label: "国（省庁）" },
    { value: "prefectural", label: "都道府県" },
    { value: "municipal", label: "市区町村" },
  ],

  // 業種分類
  industries: [
    { slug: "construction", label: "建設業", icon: "🏗️" },
    { slug: "waste", label: "廃棄物処理業", icon: "🚛" },
    { slug: "transport", label: "運送業", icon: "🚚" },
    { slug: "staffing", label: "派遣・人材業", icon: "👥" },
    { slug: "real_estate", label: "不動産業", icon: "🏠" },
    { slug: "food", label: "食品関連", icon: "🍽️" },
    { slug: "medical", label: "医療・介護", icon: "🏥" },
    { slug: "finance", label: "金融・保険", icon: "🏦" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  // レビューステータス
  reviewStatuses: [
    { value: "pending", label: "レビュー待ち", color: "amber" },
    { value: "approved", label: "承認済み", color: "green" },
    { value: "rejected", label: "却下", color: "red" },
  ],

  // ソート
  sorts: [
    { key: "newest", label: "新着順" },
    { key: "action_date", label: "処分日順" },
    { key: "severity", label: "重大度順" },
  ],

  // 比較項目（最小）
  compareFields: [
    { key: "action_type", label: "処分種別" },
    { key: "industry", label: "業種" },
    { key: "authority_name", label: "処分庁" },
    { key: "action_date", label: "処分日" },
  ],

  // 用語
  terminology: {
    item: "行政処分",
    itemPlural: "行政処分一覧",
    provider: "処分庁",
    category: "処分種別",
    favorite: "ウォッチリスト",
  },

  // SEO
  seo: {
    titleTemplate: "{title} | 行政処分DB",
    descriptionTemplate: "{organization}に対する{action_type}の詳細。処分日: {date}、処分庁: {authority}。",
    jsonLdType: "GovernmentService",
  },
};

/**
 * 処分種別のラベルを取得
 */
export function getActionTypeLabel(slug) {
  return gyoseiShobunConfig.actionTypes.find((t) => t.slug === slug)?.label || slug;
}

/**
 * 業種のラベルを取得
 */
export function getIndustryLabel(slug) {
  return gyoseiShobunConfig.industries.find((i) => i.slug === slug)?.label || slug;
}

/**
 * 処分種別のアイコンを取得
 */
export function getActionTypeIcon(slug) {
  return gyoseiShobunConfig.actionTypes.find((t) => t.slug === slug)?.icon || "📄";
}
