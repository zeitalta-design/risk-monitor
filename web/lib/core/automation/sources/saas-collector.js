/**
 * SaaS比較ナビ — 半自動収集パイプライン
 *
 * 公式サイトから価格・機能・無料プラン等の情報を取得し、
 * 既存データとの差分を検知する。
 */

import { fetchHtml, stripTags } from "../fetch-helper.js";

/**
 * SaaS製品の公式サイトから情報を収集
 * @param {Object} item - 既存の items レコード
 * @returns {{ data: Object, changes: Array, errors: string[] }}
 */
export async function collectSaasInfo(item) {
  if (!item.url) return { data: {}, changes: [], errors: ["公式URL未設定"] };

  // timeout を長めに設定（大手SaaSサイトは重い場合がある）
  const result = await fetchHtml(item.url, { timeout: 25000, retries: 1 });
  if (!result.ok) return { data: {}, changes: [], errors: [`取得失敗: ${result.error}`] };

  const html = result.html;
  const plainText = stripTags(html);
  const data = {};
  const errors = [];

  // ─── 価格情報の抽出 ─────
  const pricePatterns = [
    /(?:月額|\/月|per month|月)\s*[¥￥]?\s*([\d,]+)\s*円/gi,
    /[¥￥]\s*([\d,]+)\s*(?:\/月|\/ユーザー|per)/gi,
    /(\d{1,3}(?:,\d{3})*)\s*円\s*(?:\/月|～|から)/gi,
  ];
  const prices = [];
  for (const p of pricePatterns) {
    let m;
    while ((m = p.exec(plainText)) !== null) {
      const price = parseInt(m[1].replace(/,/g, ""));
      if (price > 0 && price < 10000000) prices.push(price);
    }
  }
  if (prices.length > 0) {
    data.price_min = Math.min(...prices);
    data.price_max = Math.max(...prices);
  }

  // ─── 無料プラン検知 ─────
  if (plainText.match(/無料プラン|フリープラン|Free Plan|永久無料|0円プラン/i)) {
    data.free_plan = true;
  } else if (plainText.match(/有料プランのみ|無料プランはありません/i)) {
    data.free_plan = false;
  }

  // ─── トライアル検知 ─────
  if (plainText.match(/無料(?:トライアル|体験|お試し)|Free Trial|(?:\d+)日間(?:無料|お試し)/i)) {
    data.trial = true;
    const trialDays = plainText.match(/(\d+)\s*日間\s*(?:無料|お試し|トライアル)/);
    if (trialDays) data.trial_days = parseInt(trialDays[1]);
  }

  // ─── 機能キーワード検知 ─────
  const featureKeywords = {
    api: /API(?:連携|対応|提供)/i,
    mobile: /(?:モバイル|スマホ|アプリ)(?:対応|版)/i,
    sso: /SSO|シングルサインオン/i,
    ai: /AI(?:搭載|機能|分析)/i,
  };
  data.detected_features = {};
  for (const [key, pattern] of Object.entries(featureKeywords)) {
    data.detected_features[key] = pattern.test(plainText);
  }

  // ─── タイトル / meta description ─────
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) data.page_title = stripTags(titleMatch[1]).trim().substring(0, 200);

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) data.meta_description = descMatch[1].trim().substring(0, 300);

  return { data, changes: [], errors };
}

/**
 * 既存データとの差分を検知
 */
export function detectSaasChanges(item, collectedData) {
  const ext = JSON.parse(item.extension_json || "{}");
  const changes = [];

  // 価格差分
  if (collectedData.price_min && item.price_min !== null) {
    if (collectedData.price_min !== item.price_min) {
      changes.push({ field: "price_min", before: String(item.price_min), after: String(collectedData.price_min), severity: "review" });
    }
  }
  if (collectedData.price_max && item.price_max !== null) {
    if (collectedData.price_max !== item.price_max) {
      changes.push({ field: "price_max", before: String(item.price_max), after: String(collectedData.price_max), severity: "review" });
    }
  }

  // 無料プラン差分
  if (collectedData.free_plan !== undefined && ext.free_plan !== undefined) {
    if (collectedData.free_plan !== ext.free_plan) {
      changes.push({ field: "free_plan", before: String(ext.free_plan), after: String(collectedData.free_plan), severity: "review" });
    }
  }

  // トライアル差分
  if (collectedData.trial !== undefined && ext.trial !== undefined) {
    if (collectedData.trial !== ext.trial) {
      changes.push({ field: "trial", before: String(ext.trial), after: String(collectedData.trial), severity: "review" });
    }
  }

  return changes;
}

/**
 * 収集対象のSaaS製品一覧を取得
 */
export function getSaasCollectionTargets(db, { categories = [], limit = 20 } = {}) {
  let query = "SELECT * FROM items WHERE is_published = 1 AND url IS NOT NULL AND url != ''";
  const params = [];
  if (categories.length > 0) {
    query += ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }
  query += " ORDER BY popularity_score DESC LIMIT ?";
  params.push(limit);
  return db.prepare(query).all(...params);
}
