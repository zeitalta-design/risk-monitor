/**
 * GET /api/nyusatsu/analytics/category-band
 *
 * 金額帯 × 業種カテゴリ のクロス集計。
 * 帯定義は Step 1 と完全同一（9 区分）。
 *
 * Query:
 *   - yearFrom / yearTo: 年 (YYYY)
 *   - topCategories: 上位 N カテゴリ（default 10、上限 20）
 *
 * レスポンス: { bands, categories: [{ category, totalCount, totalAmount, cells }], totals }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCategoryBandMatrix } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearFrom = parseInt(searchParams.get("yearFrom") || "", 10);
    const yearTo   = parseInt(searchParams.get("yearTo")   || "", 10);
    const topCategories = parseInt(searchParams.get("topCategories") || "", 10);
    const result = getCategoryBandMatrix(getDb(), {
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo:   Number.isFinite(yearTo)   ? yearTo   : undefined,
      topCategories: Number.isFinite(topCategories) ? topCategories : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/category-band error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
