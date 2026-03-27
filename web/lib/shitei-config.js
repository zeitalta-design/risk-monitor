/**
 * 指定管理・委託公募まとめ — 設定 + ヘルパー
 */

export const shiteiConfig = {
  // 施設カテゴリ
  facilityCategories: [
    { slug: "sports", label: "スポーツ施設", icon: "🏟️" },
    { slug: "culture", label: "文化施設", icon: "🎭" },
    { slug: "welfare", label: "福祉施設", icon: "🏥" },
    { slug: "park", label: "公園・緑地", icon: "🌳" },
    { slug: "housing", label: "住宅・駐車場", icon: "🏢" },
    { slug: "education", label: "教育施設", icon: "📚" },
    { slug: "community", label: "コミュニティ施設", icon: "🏘️" },
    { slug: "tourism", label: "観光・宿泊施設", icon: "🏨" },
    { slug: "waste", label: "環境・廃棄物施設", icon: "♻️" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  // 募集状態
  recruitmentStatuses: [
    { value: "open", label: "募集中", color: "badge-green" },
    { value: "upcoming", label: "公募予定", color: "badge-blue" },
    { value: "closed", label: "募集終了", color: "badge-gray" },
    { value: "reviewing", label: "選定中", color: "badge-amber" },
    { value: "decided", label: "決定済み", color: "badge-gray" },
    { value: "unknown", label: "不明", color: "badge-gray" },
  ],

  sorts: [
    { key: "deadline", label: "締切が近い順" },
    { key: "newest", label: "新着順" },
    { key: "municipality", label: "自治体順" },
  ],

  compareFields: [
    { key: "municipality_name", label: "自治体" },
    { key: "facility_category_label", label: "施設種別" },
    { key: "recruitment_status_label", label: "募集状態" },
    { key: "application_deadline", label: "応募期限" },
  ],

  terminology: {
    item: "公募案件",
    itemPlural: "公募案件",
    provider: "自治体",
    category: "施設種別",
    favorite: "ウォッチ",
  },

  seo: {
    titleTemplate: "%s | 指定管理公募まとめ",
    descriptionTemplate: "%s の指定管理者・業務委託公募情報。",
    jsonLdType: "GovernmentService",
  },
};

// ─── ヘルパー ────────────────

export function getFacilityCategoryLabel(slug) {
  return shiteiConfig.facilityCategories.find((c) => c.slug === slug)?.label || slug;
}

export function getFacilityCategoryIcon(slug) {
  return shiteiConfig.facilityCategories.find((c) => c.slug === slug)?.icon || "📋";
}

export function getRecruitmentStatusBadge(status) {
  const s = shiteiConfig.recruitmentStatuses.find((r) => r.value === status);
  return s || { value: status, label: status || "不明", color: "badge-gray" };
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 応募期限までの残日数を返す
 */
export function getDaysUntilDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline - now) / 86400000);

  if (diffDays < 0) return { text: "締切済み", days: diffDays, urgent: false, past: true };
  if (diffDays === 0) return { text: "本日締切", days: 0, urgent: true, past: false };
  if (diffDays <= 3) return { text: `あと${diffDays}日`, days: diffDays, urgent: true, past: false };
  if (diffDays <= 7) return { text: `あと${diffDays}日`, days: diffDays, urgent: false, past: false };
  if (diffDays <= 30) return { text: `あと${diffDays}日`, days: diffDays, urgent: false, past: false };
  return { text: `あと${diffDays}日`, days: diffDays, urgent: false, past: false };
}

/**
 * 募集状態の自動判定（ルールベース）
 * - application_deadline が過ぎていれば closed
 * - application_start_date が未来なら upcoming
 * - 期間内なら open
 */
export function calculateRecruitmentStatus(item) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (item.recruitment_status && item.recruitment_status !== "unknown") {
    // 手動設定があればそれを優先、ただし期限切れなら closed に上書き
    if (item.application_deadline) {
      const deadline = new Date(item.application_deadline);
      deadline.setHours(23, 59, 59, 999);
      if (deadline < now && item.recruitment_status === "open") return "closed";
    }
    return item.recruitment_status;
  }

  if (item.application_start_date) {
    const start = new Date(item.application_start_date);
    if (start > now) return "upcoming";
  }

  if (item.application_deadline) {
    const deadline = new Date(item.application_deadline);
    deadline.setHours(23, 59, 59, 999);
    if (deadline >= now) return "open";
    return "closed";
  }

  return "unknown";
}
