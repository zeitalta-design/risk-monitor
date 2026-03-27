import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";

/**
 * Phase207: データ成長KPI API
 *
 * GET /api/admin/data-growth
 * 大会数・口コミ数・写真数・結果掲載大会数・月別成長率を返す
 */

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const db = getDb();

    // 現在値
    const totalEvents = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1`).get()?.cnt || 0;
    const futureEvents = db.prepare(`SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND event_date >= date('now')`).get()?.cnt || 0;
    const totalReviews = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL`).get()?.cnt || 0;
    const totalPhotos = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE status = 'published' OR status IS NULL`).get()?.cnt || 0;

    // 結果掲載大会数
    const eventsWithResults = db.prepare(`SELECT COUNT(DISTINCT event_id) as cnt FROM event_results`).get()?.cnt || 0;
    const totalResults = db.prepare(`SELECT COUNT(*) as cnt FROM event_results`).get()?.cnt || 0;

    // ユーザー数
    let totalUsers = 0;
    try { totalUsers = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get()?.cnt || 0; } catch {}

    // 紐付け済みユーザー数
    let linkedUsers = 0;
    try { linkedUsers = db.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_results`).get()?.cnt || 0; } catch {}

    // 月別成長（直近6ヶ月）
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = `date('now', 'start of month', '-${i} months')`;
      const monthEnd = `date('now', 'start of month', '-${i - 1} months')`;

      const reviews = db.prepare(`
        SELECT COUNT(*) as cnt FROM event_reviews
        WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}
      `).get()?.cnt || 0;

      const photos = db.prepare(`
        SELECT COUNT(*) as cnt FROM event_photos
        WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}
      `).get()?.cnt || 0;

      const results = db.prepare(`
        SELECT COUNT(*) as cnt FROM event_results
        WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}
      `).get()?.cnt || 0;

      // 月名
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;

      monthlyGrowth.push({ label, reviews, photos, results });
    }

    return NextResponse.json({
      current: {
        totalEvents,
        futureEvents,
        totalReviews,
        totalPhotos,
        eventsWithResults,
        totalResults,
        totalUsers,
        linkedUsers,
      },
      monthlyGrowth,
    });
  } catch (err) {
    console.error("Data growth API error:", err);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
