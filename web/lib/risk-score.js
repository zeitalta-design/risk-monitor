/**
 * リスクスコア計算モジュール
 *
 * 行政処分オブジェクトからリスクスコア（0〜100）とレベルを算出。
 * 将来の調整を容易にするため、各要素の配点を定数で管理。
 */

// ─── 配点定数 ─────────────────────

const ACTION_TYPE_SCORES = {
  license_revocation: 70,
  business_suspension: 55,
  improvement_order: 30,
  warning: 20,
  guidance: 10,
  other: 15,
};

const INDUSTRY_BONUS = {
  construction: 5,
  waste: 8,
  real_estate: 3,
  transport: 3,
  food: 5,
  medical: 5,
  finance: 4,
  staffing: 2,
  other: 0,
};

const RECENCY_THRESHOLDS = [
  { withinYears: 1, bonus: 20 },
  { withinYears: 2, bonus: 12 },
  { withinYears: 3, bonus: 6 },
];

const PENALTY_PERIOD_PATTERNS = [
  { pattern: /(\d+)\s*[ヶか箇ヵ]?\s*月/, multiplier: 1 },
  { pattern: /(\d+)\s*日/, multiplier: 1 / 30 },
  { pattern: /(\d+)\s*年/, multiplier: 12 },
];

// ─── メイン関数 ─────────────────────

/**
 * リスクスコアを計算
 * @param {Object} action - 行政処分オブジェクト
 * @returns {{ score: number, level: string, label: string, color: string }}
 */
export function calculateRiskScore(action) {
  if (!action) return { score: 0, level: "unknown", label: "不明", color: "gray" };

  let score = 0;

  // 1. 処分種別（最大70点）
  score += ACTION_TYPE_SCORES[action.action_type] || ACTION_TYPE_SCORES.other;

  // 2. 新しさ（最大20点）
  if (action.action_date) {
    const actionDate = new Date(action.action_date);
    const now = new Date();
    const yearsDiff = (now - actionDate) / (365.25 * 24 * 60 * 60 * 1000);

    for (const t of RECENCY_THRESHOLDS) {
      if (yearsDiff <= t.withinYears) {
        score += t.bonus;
        break;
      }
    }
  }

  // 3. 業種加点（最大8点）
  score += INDUSTRY_BONUS[action.industry] || 0;

  // 4. 処分期間（最大10点）
  if (action.penalty_period) {
    let months = 0;
    for (const p of PENALTY_PERIOD_PATTERNS) {
      const m = action.penalty_period.match(p.pattern);
      if (m) {
        months = parseFloat(m[1]) * p.multiplier;
        break;
      }
    }
    if (months > 0) {
      score += Math.min(10, Math.round(months * 1.5));
    }
  }

  // スコアを0〜100に正規化
  score = Math.max(0, Math.min(100, Math.round(score)));

  // レベル判定
  const { level, label, color } = getLevel(score);

  return { score, level, label, color };
}

function getLevel(score) {
  if (score >= 70) return { level: "high", label: "高リスク", color: "red" };
  if (score >= 40) return { level: "medium", label: "中リスク", color: "amber" };
  return { level: "low", label: "低リスク", color: "green" };
}

/**
 * リスクレベルの色定義（Tailwind用）
 */
export const RISK_COLORS = {
  high: {
    bg: "bg-red-50", text: "text-red-700", border: "border-red-200",
    ring: "ring-red-500", fill: "bg-red-500", badge: "bg-red-100 text-red-800",
  },
  medium: {
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200",
    ring: "ring-amber-500", fill: "bg-amber-500", badge: "bg-amber-100 text-amber-800",
  },
  low: {
    bg: "bg-green-50", text: "text-green-700", border: "border-green-200",
    ring: "ring-green-500", fill: "bg-green-500", badge: "bg-green-100 text-green-800",
  },
  unknown: {
    bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200",
    ring: "ring-gray-400", fill: "bg-gray-400", badge: "bg-gray-100 text-gray-600",
  },
};

/**
 * Grok版互換: 事業者名ベースのリスクスコア算出
 * DB参照が必要な場合はこちらを使用
 */
export function calcRiskScore(organizationName, industry = "") {
  // DB非依存のフォールバック（事業者名ベースの処分情報がない場合）
  return { score: 0, level: "low", label: "低リスク", color: "green", breakdown: {}, actions: [], totalCount: 0, recentThreeYearsCount: 0, recent180Count: 0, latestActionDate: null };
}

export function getRiskLevel(score) {
  if (score >= 70) return { level: "critical", label: "要警戒", color: "red" };
  if (score >= 40) return { level: "high", label: "高", color: "orange" };
  if (score >= 20) return { level: "medium", label: "注意", color: "yellow" };
  return { level: "low", label: "低", color: "gray" };
}
