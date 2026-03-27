import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getImprovementSuggestions } from "@/lib/quality/auto-suggestions";
import { calculateQualityScore } from "@/lib/quality/quality-score";

/**
 * Phase215: 自動改善候補API
 *
 * GET /api/admin/quality/suggestions?event_id=123
 */
export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const eventId = parseInt(searchParams.get("event_id"));
    if (!eventId) {
      return NextResponse.json({ error: "event_idが必要です" }, { status: 400 });
    }

    const suggestions = getImprovementSuggestions(eventId);
    const qualityScore = calculateQualityScore(eventId);

    return NextResponse.json({ eventId, suggestions, qualityScore });
  } catch (err) {
    console.error("Suggestions API error:", err);
    return NextResponse.json({ error: "提案データ取得に失敗しました" }, { status: 500 });
  }
}
