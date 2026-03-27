import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getEventValueMetrics, getTopEventsByEngagement } from "@/lib/event-value-metrics";

/**
 * Phase133: 大会価値指標API
 *
 * GET /api/admin/event-metrics?event_id=X  — 単一イベント指標
 * GET /api/admin/event-metrics?sort=engagement&limit=50 — 上位イベント一覧
 */
export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const days = parseInt(searchParams.get("days") || "30");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const sportType = searchParams.get("sport_type") || "";

    if (eventId) {
      const metrics = getEventValueMetrics(parseInt(eventId), days);
      return NextResponse.json(metrics);
    }

    const events = getTopEventsByEngagement({ days, limit, sportType });
    return NextResponse.json({ events, period_days: days });
  } catch (error) {
    console.error("GET /api/admin/event-metrics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
