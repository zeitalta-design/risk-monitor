/**
 * GET /api/nyusatsu/analytics/band-year
 *
 * 金額帯 × 年度 マトリクス。「価格帯の市場構造が年ごとにどう変わったか」を見る。
 * 帯定義は Step 1 と同一（9区分）、年度は暦年（Step 1〜3 と一貫）。
 *
 * Query:
 *   - yearFrom / yearTo: 年 (YYYY) 未指定なら全期間
 *
 * レスポンス: { years, bands, rows: [{ band, totalCount, totalAmount, cells }], totals }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchBandYearMatrix } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearFrom = parseInt(searchParams.get("yearFrom") || "", 10);
    const yearTo   = parseInt(searchParams.get("yearTo")   || "", 10);
    const result = fetchBandYearMatrix(getDb(), {
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo:   Number.isFinite(yearTo)   ? yearTo   : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/band-year error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
