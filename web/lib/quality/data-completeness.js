import { getDb } from "@/lib/db";

/**
 * Phase209: データ欠損チェックサービス
 *
 * 大会データの欠損状況を自動検出して一覧化
 */

const COMPLETENESS_FIELDS = [
  { key: "event_date", label: "開催日", weight: 15 },
  { key: "entry_end_date", label: "エントリー締切", weight: 10 },
  { key: "prefecture", label: "都道府県", weight: 12 },
  { key: "city", label: "市区町村", weight: 5 },
  { key: "distance_list", label: "距離情報", weight: 10 },
  { key: "official_url", label: "公式URL", weight: 10 },
  { key: "description", label: "説明文", weight: 8 },
  { key: "venue_name", label: "会場名", weight: 5 },
];

const RELATION_CHECKS = [
  { key: "has_photos", label: "写真あり", weight: 10 },
  { key: "has_reviews", label: "口コミあり", weight: 10 },
  { key: "has_results", label: "結果あり", weight: 10 },
  { key: "has_details", label: "詳細情報あり", weight: 5 },
];

/**
 * 大会の欠損項目を検出
 */
export function checkEventCompleteness(eventId) {
  const db = getDb();
  const event = db.prepare(`
    SELECT e.*, md.venue_name, md.course_detail
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    WHERE e.id = ?
  `).get(eventId);
  if (!event) return null;

  const missing = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  // 基本フィールドチェック
  for (const f of COMPLETENESS_FIELDS) {
    totalWeight += f.weight;
    const val = event[f.key];
    if (!val || (typeof val === "string" && val.trim() === "")) {
      missing.push({ key: f.key, label: f.label, type: "field" });
    } else {
      earnedWeight += f.weight;
    }
  }

  // 関連データチェック
  const photoCount = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE event_id = ? AND (status = 'published' OR status IS NULL)`).get(eventId)?.cnt || 0;
  const reviewCount = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE event_id = ? AND (status = 'published' OR status IS NULL)`).get(eventId)?.cnt || 0;
  const resultCount = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE event_id = ?`).get(eventId)?.cnt || 0;
  const detailExists = db.prepare(`SELECT 1 FROM marathon_details WHERE event_id = ?`).get(eventId);

  const relations = { has_photos: photoCount > 0, has_reviews: reviewCount > 0, has_results: resultCount > 0, has_details: !!detailExists };

  for (const r of RELATION_CHECKS) {
    totalWeight += r.weight;
    if (!relations[r.key]) {
      missing.push({ key: r.key, label: r.label, type: "relation" });
    } else {
      earnedWeight += r.weight;
    }
  }

  const completenessScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    eventId,
    title: event.title,
    completenessScore,
    missing,
    missingCount: missing.length,
    totalChecks: COMPLETENESS_FIELDS.length + RELATION_CHECKS.length,
    counts: { photos: photoCount, reviews: reviewCount, results: resultCount },
  };
}

/**
 * 欠損大会一覧を取得（スコア昇順=欠損が多い順）
 */
export function getIncompleteEvents({ limit = 50, offset = 0, minMissing = 1, sportType = "" } = {}) {
  const db = getDb();

  let where = "WHERE e.is_active = 1";
  const params = [];
  if (sportType) {
    where += " AND e.sport_type = ?";
    params.push(sportType);
  }

  const events = db.prepare(`
    SELECT e.id, e.title, e.event_date, e.prefecture, e.city,
           e.entry_end_date, e.distance_list, e.official_url,
           e.description, e.sport_type,
           md.venue_name
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    ${where}
    ORDER BY e.id
  `).all(...params);

  // バッチで関連データカウント
  const photoCounts = {};
  const reviewCounts = {};
  const resultCounts = {};
  const detailExists = {};

  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_photos WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { photoCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { reviewCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_results GROUP BY event_id`).all().forEach((r) => { resultCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id FROM marathon_details`).all().forEach((r) => { detailExists[r.event_id] = true; });

  const results = [];
  for (const event of events) {
    const missing = [];
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const f of COMPLETENESS_FIELDS) {
      totalWeight += f.weight;
      const val = event[f.key];
      if (!val || (typeof val === "string" && val.trim() === "")) {
        missing.push(f.label);
      } else {
        earnedWeight += f.weight;
      }
    }

    const rels = {
      has_photos: (photoCounts[event.id] || 0) > 0,
      has_reviews: (reviewCounts[event.id] || 0) > 0,
      has_results: (resultCounts[event.id] || 0) > 0,
      has_details: !!detailExists[event.id],
    };

    for (const r of RELATION_CHECKS) {
      totalWeight += r.weight;
      if (!rels[r.key]) {
        missing.push(r.label);
      } else {
        earnedWeight += r.weight;
      }
    }

    if (missing.length >= minMissing) {
      const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
      results.push({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        prefecture: event.prefecture,
        sport_type: event.sport_type,
        completenessScore: score,
        missingCount: missing.length,
        missing,
      });
    }
  }

  // スコア昇順（欠損多い順）
  results.sort((a, b) => a.completenessScore - b.completenessScore);

  return {
    total: results.length,
    items: results.slice(offset, offset + limit),
  };
}

/**
 * 欠損サマリ統計
 */
export function getCompletenessStats() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1`).get()?.cnt || 0;

  const noDate = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '')`).get()?.cnt || 0;
  const noDeadline = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (entry_end_date IS NULL OR entry_end_date = '')`).get()?.cnt || 0;
  const noPref = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '')`).get()?.cnt || 0;
  const noDistance = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (distance_list IS NULL OR distance_list = '')`).get()?.cnt || 0;
  const noUrl = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (official_url IS NULL OR official_url = '')`).get()?.cnt || 0;
  const noDesc = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (description IS NULL OR description = '')`).get()?.cnt || 0;

  // 写真・口コミ・結果なし
  const withPhotos = db.prepare(`SELECT COUNT(DISTINCT event_id) as cnt FROM event_photos WHERE status = 'published' OR status IS NULL`).get()?.cnt || 0;
  const withReviews = db.prepare(`SELECT COUNT(DISTINCT event_id) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL`).get()?.cnt || 0;
  const withResults = db.prepare(`SELECT COUNT(DISTINCT event_id) as cnt FROM event_results`).get()?.cnt || 0;

  return {
    total,
    missing: { noDate, noDeadline, noPref, noDistance, noUrl, noDesc },
    coverage: {
      photos: withPhotos,
      reviews: withReviews,
      results: withResults,
      noPhotos: total - withPhotos,
      noReviews: total - withReviews,
      noResults: total - withResults,
    },
  };
}

export { COMPLETENESS_FIELDS, RELATION_CHECKS };
