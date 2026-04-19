/**
 * GET /api/nyusatsu/analytics/yearly-stats
 *
 * 年度別（暦年）推移。件数・総額・平均。
 * Query:
 *   - yearFrom / yearTo
 *   - category
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getYearlyStats } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearFrom = parseInt(searchParams.get("yearFrom") || "", 10);
    const yearTo   = parseInt(searchParams.get("yearTo")   || "", 10);
    const items = getYearlyStats(getDb(), {
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo:   Number.isFinite(yearTo)   ? yearTo   : undefined,
      category: searchParams.get("category") || undefined,
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/yearly-stats error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
