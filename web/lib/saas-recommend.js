/**
 * SaaS おすすめロジック — ルールベース推薦エンジン v2
 *
 * カテゴリ別重み付け + 欠損値補正 + 推薦理由の具体化 + お気に入りベース推薦
 */

import { getDb } from "@/lib/db";

// ─── カテゴリ別 feature 重み ─────────────────────

const CATEGORY_FEATURE_WEIGHTS = {
  crm: { "案件管理": 3, "名刺管理": 2, "MA連携": 2, "API": 2, "モバイル": 1 },
  project: { "ガント": 3, "カンバン": 2, "工数管理": 3, "権限管理": 2, "外部連携": 2 },
  accounting: { "請求書": 3, "経費精算": 3, "銀行連携": 2, "電帳法": 3, "API": 1 },
  hr: { "勤怠管理": 3, "給与計算": 3, "年末調整": 2, "入退社": 2, "タレント管理": 2 },
  communication: { "チャット": 3, "ビデオ会議": 3, "ファイル共有": 2, "タスク管理": 1, "外部連携": 1 },
  ma: { "メール配信": 3, "LP作成": 2, "リード管理": 3, "分析": 2, "CRM連携": 2 },
};

// ─── 類似サービス算出 ─────────────────────

export function findSimilarServices(item, limit = 5) {
  const db = getDb();
  const ext = parseExt(item.extension_json);
  const featureWeights = CATEGORY_FEATURE_WEIGHTS[item.category] || {};

  const candidates = db.prepare(
    "SELECT * FROM items WHERE is_published = 1 AND category = ? AND id != ? ORDER BY popularity_score DESC LIMIT 30"
  ).all(item.category, item.id);

  const scored = candidates.map(c => {
    const cExt = parseExt(c.extension_json);
    let score = 0;
    const reasons = [];

    // 1. 価格帯近似（改善: 比率ベース）
    const basePrice = item.price_min || item.price_max || 0;
    const candPrice = c.price_min || c.price_max || 0;
    if (basePrice > 0 && candPrice > 0) {
      const ratio = Math.min(basePrice, candPrice) / Math.max(basePrice, candPrice);
      if (ratio > 0.5) { score += 4; reasons.push("同価格帯"); }
      else if (ratio > 0.2) { score += 2; }
    } else if (basePrice === 0 && candPrice === 0) {
      score += 2; // 両方無料/未設定
    }

    // 2. 企業規模一致（改善: 部分一致も加点）
    if (ext.target_size && cExt.target_size) {
      if (ext.target_size === cExt.target_size) {
        score += 4;
        reasons.push(`${getSizeLabel(ext.target_size)}向け`);
      } else if (ext.target_size === "any" || cExt.target_size === "any") {
        score += 2;
      }
    }

    // 3. 無料プラン/トライアル一致
    if (ext.free_plan && cExt.free_plan) { score += 3; reasons.push("無料プランあり"); }
    if (ext.trial && cExt.trial) { score += 1; }

    // 4. feature overlap（改善: カテゴリ別重み付き）
    if (ext.features && cExt.features) {
      let weightedOverlap = 0;
      for (const [key, weight] of Object.entries(featureWeights)) {
        const a = ext.features[key];
        const b = cExt.features[key];
        if (a && b && a !== "×" && b !== "×") {
          weightedOverlap += weight;
        }
      }
      if (weightedOverlap >= 8) { score += 4; reasons.push("機能構成が近い"); }
      else if (weightedOverlap >= 5) { score += 2; reasons.push("一部機能が類似"); }
    }

    // 5. pricing_model 一致
    if (ext.pricing_model && cExt.pricing_model && ext.pricing_model === cExt.pricing_model) {
      score += 1;
    }

    // 6. 人気度ボーナス（控えめに）
    if (c.popularity_score > 85) score += 2;
    else if (c.popularity_score > 70) score += 1;

    // 7. strengths キーワード類似（新規）
    if (ext.strengths && cExt.strengths) {
      const keywords = ["低コスト", "使いやすい", "連携", "カスタマイズ", "サポート", "AI", "無料", "グローバル"];
      const matched = keywords.filter(k => ext.strengths.includes(k) && cExt.strengths.includes(k));
      if (matched.length >= 2) { score += 2; reasons.push("強みが類似"); }
    }

    return { item: c, score, reasons };
  });

  return scored
    .filter(s => s.score > 2) // 最低スコアを引き上げ
    .sort((a, b) => b.score - a.score || (b.item.popularity_score || 0) - (a.item.popularity_score || 0))
    .slice(0, limit);
}

// ─── 条件別おすすめ ─────────────────────

export function getRecommendations(category, conditions = {}, limit = 10) {
  const db = getDb();
  let query = "SELECT * FROM items WHERE is_published = 1";
  const params = [];
  if (category) { query += " AND category = ?"; params.push(category); }
  query += " ORDER BY popularity_score DESC LIMIT 50";

  const candidates = db.prepare(query).all(...params);
  const featureWeights = CATEGORY_FEATURE_WEIGHTS[category] || {};

  const scored = candidates.map(c => {
    const ext = parseExt(c.extension_json);
    let score = (c.popularity_score || 50) / 5; // 正規化 (0-20)
    const reasons = [];

    // 企業規模マッチ（改善: 段階的加点）
    if (conditions.companySize) {
      if (ext.target_size === conditions.companySize) {
        score += 25; reasons.push(`${getSizeLabel(conditions.companySize)}に最適`);
      } else if (ext.target_size === "any") {
        score += 15; reasons.push("全規模対応");
      } else {
        score -= 5;
      }
    }

    // 価格志向（改善: より細かい判定）
    if (conditions.priceFocus === "free") {
      if (ext.free_plan) { score += 30; reasons.push("無料プランあり"); }
      else if (ext.trial) { score += 15; reasons.push("無料トライアルで試せる"); }
      else if ((c.price_min || 0) <= 1000) { score += 10; reasons.push("低価格で導入しやすい"); }
      else { score -= 15; }
    } else if (conditions.priceFocus === "low") {
      const price = c.price_min || c.price_max || 0;
      if (price > 0 && price <= 1000) { score += 25; reasons.push("月額1,000円以下"); }
      else if (price > 0 && price <= 3000) { score += 20; reasons.push("月額3,000円以下"); }
      else if (price > 0 && price <= 5000) { score += 10; reasons.push("月額5,000円以下"); }
      if (ext.free_plan) { score += 10; reasons.push("無料プランもあり"); }
    } else if (conditions.priceFocus === "feature") {
      // 機能数ベース
      if (ext.features) {
        let featureScore = 0;
        for (const [key, weight] of Object.entries(featureWeights)) {
          const val = ext.features[key];
          if (val === "◎") featureScore += weight * 2;
          else if (val === "○") featureScore += weight;
          else if (val === "△") featureScore += Math.floor(weight / 2);
        }
        score += featureScore;
        if (featureScore >= 15) reasons.push("機能充実度が高い");
      }
    }

    // トライアルボーナス
    if (ext.trial) score += 3;

    // 欠損値補正: 情報が少ない場合はスコアを少し下げる
    let completeness = 0;
    if (ext.pricing_model) completeness++;
    if (ext.free_plan !== undefined) completeness++;
    if (ext.trial !== undefined) completeness++;
    if (ext.target_size) completeness++;
    if (ext.features) completeness++;
    if (ext.strengths) completeness++;
    if (completeness < 3) score -= 5; // 情報不足ペナルティ

    return { item: c, score: Math.max(0, score), reasons, ext };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      ...s.item,
      _score: s.score,
      _reasons: s.reasons,
      _ext: s.ext,
    }));
}

// ─── お気に入りベース推薦 ─────────────────────

export function getRecommendationsFromFavorites(userKey, limit = 5) {
  const db = getDb();

  // ユーザーのお気に入りSaaS を取得
  const favorites = db.prepare(`
    SELECT i.* FROM item_favorites f
    JOIN items i ON f.item_id = i.id
    WHERE f.user_key = ? AND i.is_published = 1
    ORDER BY f.created_at DESC LIMIT 10
  `).all(userKey);

  if (favorites.length === 0) return [];

  // お気に入りに基づいて類似候補を集約
  const candidateScores = new Map();
  const favIds = new Set(favorites.map(f => f.id));

  for (const fav of favorites) {
    const similar = findSimilarServices(fav, 5);
    for (const s of similar) {
      if (favIds.has(s.item.id)) continue; // お気に入り済みは除外
      const key = s.item.id;
      if (candidateScores.has(key)) {
        const existing = candidateScores.get(key);
        existing.score += s.score;
        existing.reasons = [...new Set([...existing.reasons, ...s.reasons])];
        existing.basedOn.push(fav.title);
      } else {
        candidateScores.set(key, {
          item: s.item,
          score: s.score,
          reasons: [...s.reasons],
          basedOn: [fav.title],
        });
      }
    }
  }

  return Array.from(candidateScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      ...s.item,
      _score: s.score,
      _reasons: [`「${s.basedOn[0]}」に近い`, ...s.reasons],
    }));
}

// ─── カテゴリ別おすすめプリセット ─────────────────────

export function getCategoryPresets(category) {
  const presets = {
    crm: [
      { id: "free", label: "無料で始めたい", conditions: { priceFocus: "free" } },
      { id: "small", label: "中小企業向け", conditions: { companySize: "small" } },
      { id: "enterprise", label: "大企業向け", conditions: { companySize: "enterprise", priceFocus: "feature" } },
    ],
    project: [
      { id: "free", label: "無料で始めたい", conditions: { priceFocus: "free" } },
      { id: "simple", label: "シンプルに使いたい", conditions: { companySize: "small", priceFocus: "low" } },
      { id: "feature", label: "多機能がほしい", conditions: { priceFocus: "feature" } },
    ],
    accounting: [
      { id: "free", label: "無料で始めたい", conditions: { priceFocus: "free" } },
      { id: "small", label: "個人・小規模向け", conditions: { companySize: "small", priceFocus: "low" } },
      { id: "enterprise", label: "中堅・大企業向け", conditions: { companySize: "enterprise" } },
    ],
    hr: [
      { id: "free", label: "無料プランあり", conditions: { priceFocus: "free" } },
      { id: "payroll", label: "給与計算重視", conditions: { priceFocus: "feature" } },
      { id: "talent", label: "タレント管理重視", conditions: { priceFocus: "feature" } },
    ],
    communication: [
      { id: "free", label: "無料で始めたい", conditions: { priceFocus: "free" } },
      { id: "office", label: "Office連携重視", conditions: { priceFocus: "feature" } },
    ],
    ma: [
      { id: "free", label: "無料から始めたい", conditions: { priceFocus: "free" } },
      { id: "enterprise", label: "本格BtoB MA", conditions: { companySize: "enterprise", priceFocus: "feature" } },
    ],
  };
  return presets[category] || [
    { id: "free", label: "無料で始めたい", conditions: { priceFocus: "free" } },
    { id: "popular", label: "人気順", conditions: {} },
  ];
}

// ─── ヘルパー ─────────────────────

function parseExt(json) {
  try { return JSON.parse(json || "{}"); } catch { return {}; }
}

function getSizeLabel(size) {
  const labels = { startup: "スタートアップ", small: "中小企業", medium: "中堅企業", enterprise: "大企業", any: "全規模" };
  return labels[size] || size;
}
