import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ favorites: [], ids: [], total: 0 });
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const checkId = searchParams.get("check");

    if (checkId) {
      const fav = db.prepare("SELECT id FROM nyusatsu_favorites WHERE user_key = ? AND nyusatsu_id = ?").get(user.userKey, checkId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    const favorites = db.prepare(`
      SELECT f.nyusatsu_id, f.created_at as favorited_at,
        ni.slug, ni.title, ni.category, ni.issuer_name, ni.target_area,
        ni.budget_amount, ni.bidding_method, ni.deadline, ni.status, ni.summary
      FROM nyusatsu_favorites f
      JOIN nyusatsu_items ni ON ni.id = f.nyusatsu_id
      WHERE f.user_key = ?
      ORDER BY f.created_at DESC
    `).all(user.userKey);

    const ids = db.prepare("SELECT nyusatsu_id FROM nyusatsu_favorites WHERE user_key = ?").all(user.userKey).map((r) => r.nyusatsu_id);
    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/nyusatsu-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const { nyusatsu_id } = await request.json();
    if (!nyusatsu_id) return NextResponse.json({ error: "nyusatsu_id is required" }, { status: 400 });

    const item = db.prepare("SELECT id FROM nyusatsu_items WHERE id = ?").get(nyusatsu_id);
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

    try {
      db.prepare("INSERT INTO nyusatsu_favorites (user_key, nyusatsu_id, created_at) VALUES (?, ?, datetime('now'))").run(user.userKey, nyusatsu_id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ message: "already favorited" });
      throw err;
    }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/nyusatsu-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
