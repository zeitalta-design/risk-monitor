/**
 * GET /api/nyusatsu/analytics/category-year
 *
 * 業種カテゴリ × 年度 マトリクス。
 * Query:
 *   - yearFrom / yearTo
 *   - topCategories: 上位 N カテゴリ（default 12、上限 30）
 *
 * レスポンス: { categories, years, matrix }
 *   - categories: 表示順（上位 N + "その他" if any）
 *   - years:      対象年度配列
 *   - matrix:     { year, category, count, total_amount }[]
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCategoryYearMatrix } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearFrom = parseInt(searchParams.get("yearFrom") || "", 10);
    const yearTo   = parseInt(searchParams.get("yearTo")   || "", 10);
    const topCategories = parseInt(searchParams.get("topCategories") || "", 10);
    const result = getCategoryYearMatrix(getDb(), {
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo:   Number.isFinite(yearTo)   ? yearTo   : undefined,
      topCategories: Number.isFinite(topCategories) ? topCategories : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/category-year error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
