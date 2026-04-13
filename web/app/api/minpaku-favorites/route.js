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
      const fav = db.prepare("SELECT id FROM minpaku_favorites WHERE user_key = ? AND minpaku_id = ?").get(user.userKey, checkId);
      return NextResponse.json({ isFavorite: !!fav });
    }
    const favorites = db.prepare(`SELECT f.minpaku_id, f.created_at as favorited_at, mi.* FROM minpaku_favorites f JOIN minpaku_items mi ON mi.id = f.minpaku_id WHERE f.user_key = ? ORDER BY f.created_at DESC`).all(user.userKey);
    const ids = db.prepare("SELECT minpaku_id FROM minpaku_favorites WHERE user_key = ?").all(user.userKey).map((r) => r.minpaku_id);
    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const { minpaku_id } = await request.json();
    if (!minpaku_id) return NextResponse.json({ error: "minpaku_id is required" }, { status: 400 });
    if (!db.prepare("SELECT id FROM minpaku_items WHERE id = ?").get(minpaku_id)) return NextResponse.json({ error: "item not found" }, { status: 404 });
    try { db.prepare("INSERT INTO minpaku_favorites (user_key, minpaku_id, created_at) VALUES (?, ?, datetime('now'))").run(user.userKey, minpaku_id); }
    catch (err) { if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ message: "already favorited" }); throw err; }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
