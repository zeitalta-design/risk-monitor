/**
 * お気に入り移行API
 *
 * POST /api/gyosei-shobun/favorites/migrate
 * body: { anon_key: "anon_xxxx" }
 *
 * ログイン成功後にフロントから呼ばれ、
 * anon_key のお気に入りを認証済みuser_idに移行する。
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { anon_key } = body;
    if (!anon_key || !anon_key.startsWith("anon_")) {
      return NextResponse.json({ error: "Invalid anon_key" }, { status: 400 });
    }

    const userId = String(user.id);
    const db = getDb();

    // anon_key のお気に入りを user_id に移行（重複はスキップ）
    const anonFavorites = db.prepare(
      "SELECT action_id FROM administrative_action_favorites WHERE user_key = ?"
    ).all(anon_key);

    let migrated = 0;
    let skipped = 0;

    for (const fav of anonFavorites) {
      try {
        db.prepare(
          "INSERT INTO administrative_action_favorites (user_key, action_id) VALUES (?, ?)"
        ).run(userId, fav.action_id);
        migrated++;
      } catch {
        // UNIQUE制約で既に存在 → スキップ
        skipped++;
      }
    }

    // 移行完了後、anon_key のレコードを削除
    if (migrated > 0 || skipped > 0) {
      db.prepare("DELETE FROM administrative_action_favorites WHERE user_key = ?").run(anon_key);
    }

    return NextResponse.json({
      ok: true,
      migrated,
      skipped,
      total: anonFavorites.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
