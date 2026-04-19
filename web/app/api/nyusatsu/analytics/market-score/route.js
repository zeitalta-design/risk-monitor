/**
 * GET /api/nyusatsu/analytics/market-score
 *
 * Market Trend Score（Phase H Step 2）。既存 yearly-stats + band-year を合成して 0〜100 を返す。
 *
 * Query:
 *   - yearCurrent / yearPrev: YYYY（未指定なら前年 vs 前々年）
 *
 * レスポンス: { score, label, years, components, inputs, weights }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeMarketTrendScore } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = computeMarketTrendScore({
      db: getDb(),
      yearCurrent: searchParams.get("yearCurrent") || undefined,
      yearPrev:    searchParams.get("yearPrev")    || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/market-score error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
