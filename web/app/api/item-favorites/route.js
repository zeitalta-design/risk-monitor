import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    const checkItemId = searchParams.get("check");

    if (checkItemId) {
      const fav = db.prepare(
        "SELECT id FROM item_favorites WHERE user_key = ? AND item_id = ?"
      ).get(userKey, checkItemId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    const favorites = db.prepare(`
      SELECT f.id as favorite_id, f.created_at as favorited_at, i.*,
        sd.price_display, sd.has_free_plan,
        p.name as provider_name
      FROM item_favorites f
      JOIN items i ON i.id = f.item_id
      LEFT JOIN saas_details sd ON sd.item_id = i.id
      LEFT JOIN providers p ON p.id = i.provider_id
      WHERE f.user_key = ?
      ORDER BY f.created_at DESC
    `).all(userKey);

    const ids = db.prepare(
      "SELECT item_id FROM item_favorites WHERE user_key = ?"
    ).all(userKey).map((r) => r.item_id);

    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/item-favorites error:", error);
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
    const { item_id } = await request.json();

    if (!item_id) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }

    const item = db.prepare("SELECT id FROM items WHERE id = ?").get(item_id);
    if (!item) {
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }

    try {
      db.prepare(
        "INSERT INTO item_favorites (user_key, item_id, created_at) VALUES (?, ?, datetime('now'))"
      ).run(userKey, item_id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return NextResponse.json({ message: "already favorited" });
      }
      throw err;
    }

    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/item-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
