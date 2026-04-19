/**
 * GET /api/watch-notifications
 *
 * リスクモニター用 in-app 通知一覧。
 *
 * Query:
 *   - status = "unread" | "all"  (default "unread")
 *   - limit  = 1..100            (default 30, 非数値・範囲外は 30 にフォールバック)
 *   - cursor = 前回レスポンスの nextCursor (opaque base64)
 *
 * 並び:
 *   is_read ASC, event_date DESC, id DESC（未読優先 → 新しい順）
 *
 * ポリシー:
 *   - 認証必須（getCurrentUser）
 *   - 他ユーザーの通知は SQL 条件で絶対に返さない
 *
 * 注: 既存 /api/notifications (sports-event 系・user_key ベース) と分離するため
 *     URL は /api/watch-notifications、リポジトリは watch-notifications.js。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listWatchNotifications } from "@/lib/repositories/watch-notifications";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get("status") || "unread";
    const status = statusRaw === "all" ? "all" : "unread";

    // Phase J-11: 一覧ページ用の簡易タイプフィルタ。未知 / 空は null 扱い（全タイプ）。
    //   許容値は repo 側の ALLOWED_TYPES でガード。
    const type = searchParams.get("type") || null;

    // limit 不正時は default 30 にフォールバック、上限 100
    const limitRaw = parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(100, limitRaw)
      : 30;

    const cursor = searchParams.get("cursor") || null;

    const { items, nextCursor } = listWatchNotifications({
      userId: user.id,
      status,
      type,
      limit,
      cursor,
    });

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (e) {
    console.error("GET /api/watch-notifications error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
