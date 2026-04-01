/**
 * 危険度スコア計算ロジック（ルールベース）
 *
 * スコアは事実ベースで算出。AI推定なし。
 */

import { getDb } from "@/lib/db";

// 処分種別スコア
const ACTION_TYPE_SCORES = {
  license_revocation: 5, // 許可取消
  business_suspension: 4, // 業務停止
  improvement_order: 3,  // 指示処分
  warning: 2,            // 警告
  guidance: 1,           // 軽微注意
  other: 1,
};

// スコア帯ラベル
export function getRiskLevel(score) {
  if (score >= 8) return { level: "critical", label: "要警戒", color: "red" };
  if (score >= 5) return { level: "high",     label: "高",     color: "orange" };
  if (score >= 3) return { level: "medium",   label: "注意",   color: "yellow" };
  return              { level: "low",      label: "低",     color: "gray" };
}

/**
 * 事業者の危険度スコアを算出する
 * @param {string} organizationName - organization_name_raw
 * @param {string} industry - industry key (省略可)
 * @returns {{ score: number, level: string, label: string, color: string, breakdown: object, actions: Array }}
 */
export function calcRiskScore(organizationName, industry = "") {
  const db = getDb();

  const whereIndustry = industry ? "AND industry = @industry" : "";
  const params = { name: organizationName, industry: industry || "" };

  const allActions = db.prepare(`
    SELECT id, action_type, action_date, is_published
    FROM administrative_actions
    WHERE organization_name_raw = @name
      AND is_published = 1
      ${whereIndustry}
    ORDER BY action_date DESC
  `).all(params);

  if (allActions.length === 0) {
    return { score: 0, ...getRiskLevel(0), breakdown: {}, actions: [] };
  }

  const now = new Date();
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setDate(now.getDate() - 180);

  let score = 0;
  const breakdown = {};

  // 処分種別スコア合算
  for (const action of allActions) {
    const pts = ACTION_TYPE_SCORES[action.action_type] ?? 1;
    score += pts;
    breakdown[action.action_type] = (breakdown[action.action_type] || 0) + 1;
  }

  // 過去3年以内の件数ボーナス
  const recentThreeYears = allActions.filter((a) => {
    if (!a.action_date) return false;
    return new Date(a.action_date) >= threeYearsAgo;
  });

  if (recentThreeYears.length >= 3) {
    score += 3;
    breakdown["_bonus_3yr_3plus"] = 1;
  } else if (recentThreeYears.length >= 2) {
    score += 2;
    breakdown["_bonus_3yr_2plus"] = 1;
  }

  // 直近180日以内
  const recent180 = allActions.filter((a) => {
    if (!a.action_date) return false;
    return new Date(a.action_date) >= sixMonthsAgo;
  });
  if (recent180.length > 0) {
    score += 2;
    breakdown["_bonus_180d"] = 1;
  }

  return {
    score,
    ...getRiskLevel(score),
    breakdown,
    actions: allActions,
    totalCount: allActions.length,
    recentThreeYearsCount: recentThreeYears.length,
    recent180Count: recent180.length,
    latestActionDate: allActions[0]?.action_date || null,
  };
}
