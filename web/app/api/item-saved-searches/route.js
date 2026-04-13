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
    const searches = db.prepare(
      "SELECT * FROM item_saved_searches WHERE user_key = ? ORDER BY created_at DESC"
    ).all(user.userKey);
    return NextResponse.json({ searches, total: searches.length });
  } catch (error) {
    console.error("GET /api/item-saved-searches error:", error);
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
    const body = await request.json();
    const { name, filters } = body;

    if (!filters || Object.keys(filters).length === 0) {
      return NextResponse.json({ error: "少なくとも1つの検索条件を指定してください" }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO item_saved_searches (user_key, name, filters_json, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(user.userKey, name || null, JSON.stringify(filters));

    const search = db.prepare("SELECT * FROM item_saved_searches WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    console.error("POST /api/item-saved-searches error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
