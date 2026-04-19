/**
 * POST /api/watch-notifications/read-all
 *
 * ログイン中ユーザーの未読 watch_notifications をすべて既読化。
 * read_at = now（既読済みは更新しない）。user 範囲は SQL で限定。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markAllWatchNotificationsRead } from "@/lib/repositories/watch-notifications";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { updatedCount } = markAllWatchNotificationsRead({ userId: user.id });

    return NextResponse.json({ ok: true, updatedCount });
  } catch (e) {
    console.error("POST /api/watch-notifications/read-all error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
