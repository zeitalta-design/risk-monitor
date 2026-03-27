import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase224: 本番監視サマリーAPI
 *
 * GET /api/admin/monitoring — 運用KPIと品質指標を返す
 */
export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();

    // 基本統計
    const totalEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get().cnt;
    const totalUsers = db.prepare("SELECT COUNT(*) as cnt FROM users").get()?.cnt || 0;

    // 直近7日のアクティビティ
    const weeklyViews = db.prepare(
      "SELECT COUNT(*) as cnt FROM event_activity_logs WHERE action_type = 'detail_view' AND created_at >= datetime('now', '-7 days')"
    ).get()?.cnt || 0;

    const weeklyFavorites = db.prepare(
      "SELECT COUNT(*) as cnt FROM event_activity_logs WHERE action_type = 'favorite_add' AND created_at >= datetime('now', '-7 days')"
    ).get()?.cnt || 0;

    const weeklyEntryClicks = db.prepare(
      "SELECT COUNT(*) as cnt FROM event_activity_logs WHERE action_type = 'entry_click' AND created_at >= datetime('now', '-7 days')"
    ).get()?.cnt || 0;

    // データ品質
    const eventsNoDate = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND event_date IS NULL"
    ).get().cnt;

    const eventsNoPrefecture = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND prefecture IS NULL"
    ).get().cnt;

    const staleEvents = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND (scraped_at IS NULL OR scraped_at < datetime('now', '-30 days'))"
    ).get().cnt;

    // 募集状態の分布
    const entryStatusDist = db.prepare(
      "SELECT entry_status, COUNT(*) as cnt FROM events WHERE is_active = 1 GROUP BY entry_status ORDER BY cnt DESC"
    ).all();

    // 口コミ・写真数
    const totalReviews = db.prepare("SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'published'").get()?.cnt || 0;
    const totalPhotos = db.prepare("SELECT COUNT(*) as cnt FROM event_photos WHERE status = 'published'").get()?.cnt || 0;

    // 未対応修正依頼
    let pendingRequests = 0;
    try {
      pendingRequests = db.prepare(
        "SELECT COUNT(*) as cnt FROM organizer_update_requests WHERE status = 'pending'"
      ).get()?.cnt || 0;
    } catch { /* table may not exist */ }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        total_events: totalEvents,
        total_users: totalUsers,
        total_reviews: totalReviews,
        total_photos: totalPhotos,
      },
      weekly_activity: {
        detail_views: weeklyViews,
        favorites: weeklyFavorites,
        entry_clicks: weeklyEntryClicks,
      },
      data_quality: {
        events_no_date: eventsNoDate,
        events_no_prefecture: eventsNoPrefecture,
        stale_events_30d: staleEvents,
      },
      entry_status_distribution: entryStatusDist,
      pending_requests: pendingRequests,
    });
  } catch (error) {
    console.error("GET /api/admin/monitoring error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
