import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ favorites: [], ids: [], total: 0 });
    const db = getDb();
    const userKey = user.userKey;
    const { searchParams } = new URL(request.url);
    const checkItemId = searchParams.get("check");

    if (checkItemId) {
      const fav = db.prepare(
        "SELECT id FROM yutai_favorites WHERE user_key = ? AND yutai_id = ?"
      ).get(userKey, checkItemId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    // DB JOIN で一覧取得
    const favorites = db.prepare(`
      SELECT f.yutai_id, f.created_at as favorited_at,
        yi.code, yi.slug, yi.title, yi.category, yi.confirm_months,
        yi.min_investment, yi.benefit_summary, yi.dividend_yield, yi.benefit_yield
      FROM yutai_favorites f
      JOIN yutai_items yi ON yi.id = f.yutai_id
      WHERE f.user_key = ?
      ORDER BY f.created_at DESC
    `).all(userKey);

    const ids = db.prepare(
      "SELECT yutai_id FROM yutai_favorites WHERE user_key = ?"
    ).all(userKey).map((r) => r.yutai_id);

    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/yutai-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const userKey = user.userKey;
    const body = await request.json();
    const yutaiId = body.yutai_id;

    if (!yutaiId) return NextResponse.json({ error: "yutai_id is required" }, { status: 400 });

    // DB で存在確認
    const item = db.prepare("SELECT id FROM yutai_items WHERE id = ?").get(yutaiId);
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

    try {
      db.prepare(
        "INSERT INTO yutai_favorites (user_key, yutai_id, created_at) VALUES (?, ?, datetime('now'))"
      ).run(userKey, yutaiId);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return NextResponse.json({ message: "already favorited" });
      }
      throw err;
    }

    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/yutai-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
