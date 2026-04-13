import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount, getRecentNotifications } from "@/lib/user-notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/unread-count
 *
 * ?preview=1 を付けるとヘッダーベル用の最新通知プレビューも返す
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const count = getUnreadCount(user.userKey);

    const { searchParams } = new URL(request.url);
    const withPreview = searchParams.get("preview") === "1";

    if (withPreview) {
      const recent = getRecentNotifications(user.userKey, 5);
      return NextResponse.json({ count, recent });
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("GET /api/notifications/unread-count error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
