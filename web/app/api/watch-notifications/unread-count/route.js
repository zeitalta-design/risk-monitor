/**
 * GET /api/watch-notifications/unread-count
 *
 * Header ベル用の軽量 endpoint。ログイン中ユーザーの未読件数だけ返す。
 *
 * レスポンス: { ok: true, count: <number> }
 * 未認証:     401
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadWatchNotifications } from "@/lib/repositories/watch-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const count = countUnreadWatchNotifications(user.id);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    console.error("GET /api/watch-notifications/unread-count error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
