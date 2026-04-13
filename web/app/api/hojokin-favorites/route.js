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
      const fav = db.prepare("SELECT id FROM hojokin_favorites WHERE user_key = ? AND hojokin_id = ?").get(user.userKey, checkId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    const favorites = db.prepare(`
      SELECT f.hojokin_id, f.created_at as favorited_at,
        hi.slug, hi.title, hi.category, hi.target_type, hi.max_amount,
        hi.subsidy_rate, hi.deadline, hi.status, hi.provider_name, hi.summary
      FROM hojokin_favorites f
      JOIN hojokin_items hi ON hi.id = f.hojokin_id
      WHERE f.user_key = ?
      ORDER BY f.created_at DESC
    `).all(user.userKey);

    const ids = db.prepare("SELECT hojokin_id FROM hojokin_favorites WHERE user_key = ?").all(user.userKey).map((r) => r.hojokin_id);
    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/hojokin-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const { hojokin_id } = await request.json();
    if (!hojokin_id) return NextResponse.json({ error: "hojokin_id is required" }, { status: 400 });

    const item = db.prepare("SELECT id FROM hojokin_items WHERE id = ?").get(hojokin_id);
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

    try {
      db.prepare("INSERT INTO hojokin_favorites (user_key, hojokin_id, created_at) VALUES (?, ?, datetime('now'))").run(user.userKey, hojokin_id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ message: "already favorited" });
      throw err;
    }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/hojokin-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
