import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ searches: [], total: 0 });
    }
    const db = getDb();
    const userKey = user.userKey;
    const searches = db.prepare(
      "SELECT * FROM saved_searches WHERE user_key = ? ORDER BY created_at DESC"
    ).all(userKey);
    return NextResponse.json({ searches, total: searches.length });
  } catch (error) {
    console.error("GET /api/saved-searches error:", error);
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
    const body = await request.json();

    const { keyword, prefecture, event_month, distance } = body;

    // 少なくとも1つの条件が必要
    if (!keyword && !prefecture && !event_month && !distance) {
      return NextResponse.json({ error: "少なくとも1つの検索条件を指定してください" }, { status: 400 });
    }

    const filtersJson = distance ? JSON.stringify({ distance }) : null;

    const result = db.prepare(`
      INSERT INTO saved_searches (user_key, sport_type, keyword, prefecture, event_month, filters_json, created_at, updated_at)
      VALUES (?, 'marathon', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(userKey, keyword || null, prefecture || null, event_month || null, filtersJson);

    const search = db.prepare("SELECT * FROM saved_searches WHERE id = ?").get(result.lastInsertRowid);

    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    console.error("POST /api/saved-searches error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
