import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordEventActivity } from "@/lib/event-activity";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ favorites: [], ids: [], total: 0 });
    }
    const db = getDb();
    const userKey = user.userKey;
    const { searchParams } = new URL(request.url);
    const checkEventId = searchParams.get("check");

    // お気に入りチェック（単一イベント）
    if (checkEventId) {
      const fav = db.prepare(
        "SELECT id FROM favorites WHERE user_key = ? AND event_id = ?"
      ).get(userKey, checkEventId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    // お気に入り一覧（events JOIN）
    const favorites = db.prepare(`
      SELECT f.id as favorite_id, f.created_at as favorited_at, e.*,
        (SELECT GROUP_CONCAT(d, ',') FROM (
          SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
          FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
        )) as distance_list
      FROM favorites f
      JOIN events e ON e.id = f.event_id
      WHERE f.user_key = ?
      ORDER BY e.entry_end_date ASC NULLS LAST
    `).all(userKey);

    // お気に入りIDセット（一覧用）
    const ids = db.prepare(
      "SELECT event_id FROM favorites WHERE user_key = ?"
    ).all(userKey).map((r) => r.event_id);

    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }
    const db = getDb();
    const userKey = user.userKey;
    const { event_id } = await request.json();

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    // イベント存在チェック
    const event = db.prepare("SELECT id FROM events WHERE id = ?").get(event_id);
    if (!event) {
      return NextResponse.json({ error: "event not found" }, { status: 404 });
    }

    // UNIQUE制約で重複防止
    try {
      db.prepare(
        "INSERT INTO favorites (user_key, event_id, created_at) VALUES (?, ?, datetime('now'))"
      ).run(userKey, event_id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return NextResponse.json({ message: "already favorited" });
      }
      throw err;
    }

    // Phase45: 人気指数用の行動ログにも記録
    recordEventActivity({
      eventId: event_id,
      actionType: "favorite_add",
      userKey,
      sourcePage: "favorite",
    });

    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
