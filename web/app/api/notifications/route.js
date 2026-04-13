import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserNotifications, getNotificationStats } from "@/lib/user-notifications";
import { getTypesForCategory } from "@/lib/notification-ui";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        notifications: [],
        total: 0,
        page: 1,
        totalPages: 0,
        limit: 30,
        stats: {},
      });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const unreadOnly = searchParams.get("unread_only") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);

    // カテゴリからタイプ一覧を解決
    const filters = { unreadOnly };
    if (type) {
      filters.type = type;
    } else if (category) {
      const types = getTypesForCategory(category);
      if (types) filters.types = types;
    }

    const result = getUserNotifications({
      userKey: user.userKey,
      filters,
      page,
      limit,
    });

    // 統計情報
    const statsResult = getNotificationStats(user.userKey);

    return NextResponse.json({
      ...result,
      stats: statsResult,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
