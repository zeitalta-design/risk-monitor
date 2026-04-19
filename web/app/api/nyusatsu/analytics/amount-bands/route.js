/**
 * GET /api/nyusatsu/analytics/amount-bands
 *
 * 落札金額の帯分布。ダッシュボードの「金額帯別件数」カード用。
 * Query:
 *   - yearFrom / yearTo: 年 (YYYY)
 *   - category
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAwardAmountBandDistribution } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearFrom = parseInt(searchParams.get("yearFrom") || "", 10);
    const yearTo   = parseInt(searchParams.get("yearTo")   || "", 10);
    const items = getAwardAmountBandDistribution(getDb(), {
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo:   Number.isFinite(yearTo)   ? yearTo   : undefined,
      category: searchParams.get("category") || undefined,
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/amount-bands error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
