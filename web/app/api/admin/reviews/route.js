import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getAdminReviews, updateReviewStatus } from "@/lib/review-service";

/**
 * Phase144: 口コミ管理API
 *
 * GET   /api/admin/reviews — 一覧（フィルタ付き）
 * PATCH /api/admin/reviews — ステータス変更
 */

export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const eventId = searchParams.get("event_id") || "";
    const sportType = searchParams.get("sport_type") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = getAdminReviews({
      status: status || undefined,
      eventId: eventId ? parseInt(eventId) : undefined,
      sportType: sportType || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/reviews error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }
    updateReviewStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/reviews error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
