import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase228: 基本分析API
 * 訪問・検索・主要アクションの集計
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const now = new Date();
    const today = now.toISOString().split("T")[0] + "T00:00:00";
    const weekAgo = new Date(now - 7 * 86400000).toISOString().split("T")[0] + "T00:00:00";
    const monthAgo = new Date(now - 30 * 86400000).toISOString().split("T")[0] + "T00:00:00";

    // 期間別閲覧数
    const viewsByPeriod = {
      today: countAction(db, "detail_view", today),
      week: countAction(db, "detail_view", weekAgo),
      month: countAction(db, "detail_view", monthAgo),
    };

    // 検索回数
    const searchesByPeriod = {
      today: countActions(db, ["search", "filter_change"], today),
      week: countActions(db, ["search", "filter_change"], weekAgo),
      month: countActions(db, ["search", "filter_change"], monthAgo),
    };

    // 外部リンククリック
    const extClicksByPeriod = {
      today: countActions(db, ["entry_click", "external_click"], today),
      week: countActions(db, ["entry_click", "external_click"], weekAgo),
      month: countActions(db, ["entry_click", "external_click"], monthAgo),
    };

    // お気に入り追加数
    const favoritesByPeriod = {
      today: countAction(db, "favorite_add", today),
      week: countAction(db, "favorite_add", weekAgo),
      month: countAction(db, "favorite_add", monthAgo),
    };

    // 人気スポーツ種目（アクティブイベント数）
    const sportDistribution = db.prepare(`
      SELECT sport_type, COUNT(*) as count
      FROM events WHERE is_active = 1
      GROUP BY sport_type ORDER BY count DESC
    `).all();

    // 人気エリア（都道府県別大会数 TOP10）
    const popularAreas = db.prepare(`
      SELECT prefecture, COUNT(*) as count
      FROM events WHERE is_active = 1 AND prefecture IS NOT NULL AND prefecture != ''
      GROUP BY prefecture ORDER BY count DESC LIMIT 10
    `).all();

    // よく見られている大会 TOP10
    const popularEvents = db.prepare(`
      SELECT e.id, e.title, e.sport_type, e.event_date, e.prefecture,
             COUNT(a.id) as view_count
      FROM event_activity_logs a
      JOIN events e ON a.event_id = e.id
      WHERE a.action_type = 'detail_view' AND a.created_at >= ?
      GROUP BY a.event_id
      ORDER BY view_count DESC
      LIMIT 10
    `).all(weekAgo);

    // アクション種別分布（7日間）
    const actionDistribution = db.prepare(`
      SELECT action_type, COUNT(*) as count
      FROM event_activity_logs
      WHERE created_at >= ?
      GROUP BY action_type
      ORDER BY count DESC
    `).all(weekAgo);

    // 日別推移（直近7日）
    const dailyTrend = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM event_activity_logs
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(weekAgo);

    // ユーザー数
    const userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 1").get()?.c || 0;

    // 問い合わせ数（月間）
    const monthlyInquiries = db.prepare(
      "SELECT COUNT(*) as c FROM inquiries WHERE created_at >= ?"
    ).get(monthAgo)?.c || 0;

    return NextResponse.json({
      views: viewsByPeriod,
      searches: searchesByPeriod,
      extClicks: extClicksByPeriod,
      favorites: favoritesByPeriod,
      sportDistribution,
      popularAreas,
      popularEvents,
      actionDistribution,
      dailyTrend,
      userCount,
      monthlyInquiries,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

function countAction(db, action, since) {
  return db.prepare(
    "SELECT COUNT(*) as c FROM event_activity_logs WHERE action_type = ? AND created_at >= ?"
  ).get(action, since)?.c || 0;
}

function countActions(db, actions, since) {
  const placeholders = actions.map(() => "?").join(",");
  return db.prepare(
    `SELECT COUNT(*) as c FROM event_activity_logs WHERE action_type IN (${placeholders}) AND created_at >= ?`
  ).get(...actions, since)?.c || 0;
}
