import { getDb } from "@/lib/db";

/**
 * Phase215: 自動改善候補サービス
 *
 * タグ自動提案・向いている人候補・写真タイプ・地域候補など
 */

// 都道府県→地域マッピング
const PREFECTURE_HINTS = {
  "北海道": ["北海道"],
  "東北": ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
  "関東": ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
  "北陸": ["新潟", "富山", "石川", "福井"],
  "中部": ["山梨", "長野", "岐阜", "静岡", "愛知"],
  "関西": ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
  "中国": ["鳥取", "島根", "岡山", "広島", "山口"],
  "四国": ["徳島", "香川", "愛媛", "高知"],
  "九州": ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島"],
  "沖縄": ["沖縄"],
};

/**
 * 大会名・説明文からタグを自動提案
 */
export function suggestTags(event) {
  const tags = [];
  const text = `${event.title || ""} ${event.description || ""}`.toLowerCase();

  const patterns = [
    { tag: "flat", keywords: ["フラット", "平坦", "高低差が少"] },
    { tag: "scenic", keywords: ["絶景", "景色", "眺望", "パノラマ", "海沿い"] },
    { tag: "beginner", keywords: ["初心者", "ビギナー", "初めて", "ファンラン"] },
    { tag: "urban", keywords: ["市街地", "都市", "シティ", "街中"] },
    { tag: "local", keywords: ["地域", "ふるさと", "町おこし", "地元"] },
    { tag: "onsen", keywords: ["温泉", "入浴", "湯"] },
    { tag: "coastal", keywords: ["海岸", "海辺", "ビーチ", "湘南", "海沿い"] },
    { tag: "mountain", keywords: ["山", "トレイル", "登山", "高原", "峠"] },
    { tag: "night", keywords: ["ナイト", "夜", "イルミ", "星空"] },
    { tag: "charity", keywords: ["チャリティ", "寄付", "支援", "復興"] },
  ];

  for (const p of patterns) {
    if (p.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(p.tag);
    }
  }
  return tags;
}

/**
 * 口コミ本文から「向いている人」候補を提案
 */
export function suggestRecommendedFor(eventId) {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT review_body, recommended_for
    FROM event_reviews
    WHERE event_id = ? AND (status = 'published' OR status IS NULL)
      AND review_body IS NOT NULL
  `).all(eventId);

  const candidates = new Map();
  const patterns = [
    { label: "初心者", keywords: ["初心者", "ビギナー", "初めて", "入門"] },
    { label: "記録狙い", keywords: ["記録", "PB", "自己ベスト", "タイム"] },
    { label: "ファミリー", keywords: ["家族", "子ども", "ファミリー", "親子"] },
    { label: "シニア", keywords: ["シニア", "高齢", "60代", "70代"] },
    { label: "女性", keywords: ["女性", "レディース", "女子"] },
    { label: "トレラン経験者", keywords: ["トレラン", "トレイル経験", "山走り"] },
    { label: "景色重視", keywords: ["景色", "絶景", "眺め", "風景"] },
    { label: "アクセス重視", keywords: ["アクセス", "駅近", "交通"] },
  ];

  for (const r of reviews) {
    const text = r.review_body || "";
    for (const p of patterns) {
      if (p.keywords.some((kw) => text.includes(kw))) {
        candidates.set(p.label, (candidates.get(p.label) || 0) + 1);
      }
    }
    // 既存のrecommended_forも集計
    if (r.recommended_for) {
      try {
        const tags = JSON.parse(r.recommended_for);
        for (const t of tags) candidates.set(t, (candidates.get(t) || 0) + 2);
      } catch {}
    }
  }

  return [...candidates.entries()]
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, mentions: count }));
}

/**
 * 大会名から地域候補を提案
 */
export function suggestPrefecture(eventTitle) {
  if (!eventTitle) return [];
  const suggestions = [];

  for (const [region, prefs] of Object.entries(PREFECTURE_HINTS)) {
    for (const pref of prefs) {
      if (eventTitle.includes(pref)) {
        suggestions.push({ prefecture: pref.endsWith("県") || pref.endsWith("府") || pref.endsWith("都") || pref === "北海道" ? pref : `${pref}県`, confidence: "high" });
      }
    }
  }

  // 都市名からの推定
  const cityHints = [
    { city: "東京", pref: "東京都" }, { city: "大阪", pref: "大阪府" },
    { city: "京都", pref: "京都府" }, { city: "名古屋", pref: "愛知県" },
    { city: "横浜", pref: "神奈川県" }, { city: "神戸", pref: "兵庫県" },
    { city: "福岡", pref: "福岡県" }, { city: "札幌", pref: "北海道" },
    { city: "仙台", pref: "宮城県" }, { city: "広島", pref: "広島県" },
    { city: "湘南", pref: "神奈川県" }, { city: "箱根", pref: "神奈川県" },
    { city: "富士", pref: "静岡県" }, { city: "奈良", pref: "奈良県" },
  ];

  for (const h of cityHints) {
    if (eventTitle.includes(h.city) && !suggestions.some((s) => s.prefecture === h.pref)) {
      suggestions.push({ prefecture: h.pref, confidence: "medium" });
    }
  }

  return suggestions;
}

/**
 * 写真のimage_typeを自動提案（キャプション・ファイル名から）
 */
export function suggestPhotoType(photo) {
  const text = `${photo.caption || ""} ${photo.alt_text || ""} ${photo.image_url || ""}`.toLowerCase();

  const patterns = [
    { type: "course", keywords: ["コース", "course", "road", "道"] },
    { type: "start", keywords: ["スタート", "start", "出発"] },
    { type: "finish", keywords: ["ゴール", "finish", "goal", "フィニッシュ"] },
    { type: "scenery", keywords: ["景色", "scenery", "風景", "view", "絶景"] },
    { type: "venue", keywords: ["会場", "venue", "受付", "テント"] },
    { type: "crowd", keywords: ["応援", "crowd", "観客", "沿道"] },
    { type: "hero", keywords: ["メイン", "hero", "main", "代表"] },
  ];

  for (const p of patterns) {
    if (p.keywords.some((kw) => text.includes(kw))) {
      return p.type;
    }
  }
  return null;
}

/**
 * イベントに対する改善提案をまとめて生成
 */
export function getImprovementSuggestions(eventId) {
  const db = getDb();
  const event = db.prepare(`
    SELECT e.*, md.venue_name
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    WHERE e.id = ?
  `).get(eventId);
  if (!event) return [];

  const suggestions = [];

  // タグ提案
  const tagSugs = suggestTags(event);
  const existingTags = event.tags_json ? JSON.parse(event.tags_json) : [];
  const newTags = tagSugs.filter((t) => !existingTags.includes(t));
  if (newTags.length > 0) {
    suggestions.push({ type: "tags", label: "タグ追加候補", items: newTags });
  }

  // 地域提案
  if (!event.prefecture) {
    const prefSugs = suggestPrefecture(event.title);
    if (prefSugs.length > 0) {
      suggestions.push({ type: "prefecture", label: "地域候補", items: prefSugs });
    }
  }

  // 向いている人提案
  const recSugs = suggestRecommendedFor(eventId);
  if (recSugs.length > 0) {
    suggestions.push({ type: "recommended_for", label: "向いている人候補", items: recSugs.slice(0, 5) });
  }

  // 写真タイプ提案
  const untyped = db.prepare(`SELECT id, caption, alt_text, image_url FROM event_photos WHERE event_id = ? AND (image_type IS NULL OR image_type = 'other')`).all(eventId);
  const photoSugs = [];
  for (const p of untyped) {
    const suggested = suggestPhotoType(p);
    if (suggested) photoSugs.push({ photoId: p.id, suggestedType: suggested });
  }
  if (photoSugs.length > 0) {
    suggestions.push({ type: "photo_type", label: "写真タイプ候補", items: photoSugs });
  }

  return suggestions;
}
