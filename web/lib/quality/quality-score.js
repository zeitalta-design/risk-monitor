import { getDb } from "@/lib/db";

/**
 * Phase213: DataQualityScore — 大会ごとの品質スコア算出
 *
 * 材料: 基本情報充足率・募集状況・写真・口コミ・結果・運営確認・重複疑い
 */

const SCORING_RULES = [
  // 基本情報（最大40点）
  { key: "title", label: "大会名", points: 5, check: (e) => !!e.title },
  { key: "event_date", label: "開催日", points: 8, check: (e) => !!e.event_date },
  { key: "prefecture", label: "都道府県", points: 5, check: (e) => !!e.prefecture },
  { key: "city", label: "市区町村", points: 2, check: (e) => !!e.city },
  { key: "distance_list", label: "距離情報", points: 5, check: (e) => !!e.distance_list },
  { key: "official_url", label: "公式URL", points: 5, check: (e) => !!e.official_url },
  { key: "description", label: "説明文", points: 5, check: (e) => !!e.description && e.description.length > 20 },
  { key: "entry_end_date", label: "締切日", points: 5, check: (e) => !!e.entry_end_date },

  // コンテンツ充実度（最大40点）
  { key: "has_photos", label: "写真あり", points: 10, check: (e, c) => c.photos > 0 },
  { key: "photos_3plus", label: "写真3枚以上", points: 5, check: (e, c) => c.photos >= 3 },
  { key: "has_reviews", label: "口コミあり", points: 10, check: (e, c) => c.reviews > 0 },
  { key: "reviews_3plus", label: "口コミ3件以上", points: 5, check: (e, c) => c.reviews >= 3 },
  { key: "has_results", label: "結果あり", points: 10, check: (e, c) => c.results > 0 },

  // 信頼性（最大20点）
  { key: "entry_status", label: "募集状況あり", points: 5, check: (e) => !!e.entry_status && e.entry_status !== "unknown" },
  { key: "verified", label: "運営確認済み", points: 10, check: (e) => e.organizer_verified && e.organizer_verified !== "unconfirmed" },
  { key: "no_duplicate", label: "重複なし", points: 5, check: (e, c) => !c.hasDuplicateSuspect },
];

/**
 * 大会の品質スコアを算出
 */
export function calculateQualityScore(eventId) {
  const db = getDb();

  const event = db.prepare(`
    SELECT e.*, md.venue_name
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    WHERE e.id = ?
  `).get(eventId);
  if (!event) return null;

  const photos = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE event_id = ? AND (status = 'published' OR status IS NULL)`).get(eventId)?.cnt || 0;
  const reviews = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE event_id = ? AND (status = 'published' OR status IS NULL)`).get(eventId)?.cnt || 0;
  const results = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE event_id = ?`).get(eventId)?.cnt || 0;

  const counts = { photos, reviews, results, hasDuplicateSuspect: false };

  let score = 0;
  let maxScore = 0;
  const breakdown = [];

  for (const rule of SCORING_RULES) {
    maxScore += rule.points;
    const passed = rule.check(event, counts);
    if (passed) score += rule.points;
    breakdown.push({ key: rule.key, label: rule.label, points: rule.points, passed });
  }

  const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "E";

  return {
    eventId,
    title: event.title,
    score,
    maxScore,
    grade,
    breakdown,
    counts: { photos, reviews, results },
  };
}

/**
 * 全大会の品質スコアをバッチ算出（低スコア順）
 */
export function getBatchQualityScores({ limit = 50, offset = 0, maxScore = 100, sportType = "" } = {}) {
  const db = getDb();

  let where = "WHERE e.is_active = 1";
  const params = [];
  if (sportType) {
    where += " AND e.sport_type = ?";
    params.push(sportType);
  }

  const events = db.prepare(`
    SELECT e.*, md.venue_name
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    ${where}
    ORDER BY e.id
  `).all(...params);

  // バッチカウント
  const photoCounts = {};
  const reviewCounts = {};
  const resultCounts = {};

  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_photos WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { photoCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { reviewCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_results GROUP BY event_id`).all().forEach((r) => { resultCounts[r.event_id] = r.cnt; });

  const scored = [];
  for (const event of events) {
    const counts = {
      photos: photoCounts[event.id] || 0,
      reviews: reviewCounts[event.id] || 0,
      results: resultCounts[event.id] || 0,
      hasDuplicateSuspect: false,
    };

    let score = 0;
    for (const rule of SCORING_RULES) {
      if (rule.check(event, counts)) score += rule.points;
    }

    if (score <= maxScore) {
      const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "E";
      scored.push({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        prefecture: event.prefecture,
        sport_type: event.sport_type,
        score,
        grade,
        photos: counts.photos,
        reviews: counts.reviews,
        results: counts.results,
      });
    }
  }

  scored.sort((a, b) => a.score - b.score);

  return {
    total: scored.length,
    items: scored.slice(offset, offset + limit),
  };
}

/**
 * 品質スコア分布
 */
export function getQualityScoreDistribution() {
  const db = getDb();
  const events = db.prepare(`SELECT id FROM events WHERE is_active = 1`).all();

  const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let totalScore = 0;

  // 簡易版: フルスコア計算は重いのでカウントベースの概算
  const photoCounts = {};
  const reviewCounts = {};
  const resultCounts = {};
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_photos WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { photoCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL GROUP BY event_id`).all().forEach((r) => { reviewCounts[r.event_id] = r.cnt; });
  db.prepare(`SELECT event_id, COUNT(*) as cnt FROM event_results GROUP BY event_id`).all().forEach((r) => { resultCounts[r.event_id] = r.cnt; });

  const allEvents = db.prepare(`
    SELECT e.*, md.venue_name
    FROM events e
    LEFT JOIN marathon_details md ON e.id = md.marathon_id
    WHERE e.is_active = 1
  `).all();

  for (const event of allEvents) {
    const counts = { photos: photoCounts[event.id] || 0, reviews: reviewCounts[event.id] || 0, results: resultCounts[event.id] || 0, hasDuplicateSuspect: false };
    let score = 0;
    for (const rule of SCORING_RULES) {
      if (rule.check(event, counts)) score += rule.points;
    }
    totalScore += score;
    const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "E";
    dist[grade]++;
  }

  return {
    distribution: dist,
    totalEvents: allEvents.length,
    averageScore: allEvents.length > 0 ? Math.round(totalScore / allEvents.length) : 0,
  };
}

export { SCORING_RULES };
