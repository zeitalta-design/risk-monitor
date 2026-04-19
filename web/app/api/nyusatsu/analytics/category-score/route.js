/**
 * GET /api/nyusatsu/analytics/category-score
 *
 * 業種別市場スコア（Phase H Step 3）。Phase H Step 2 と同じ重み・閾値・ラベルで
 * カテゴリ単位に compose する。1 クエリ集計で precomputed テーブルは未使用。
 *
 * Query:
 *   - yearCurrent / yearPrev: YYYY（未指定なら前年 vs 前々年）
 *   - limit: 上位 N カテゴリ（default 10）
 *
 * レスポンス: { yearCurrent, yearPrev, items: [{ category, score, label, components, inputs }], weights }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeCategoryMarketScores } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "", 10);
    const result = computeCategoryMarketScores({
      db: getDb(),
      yearCurrent: searchParams.get("yearCurrent") || undefined,
      yearPrev:    searchParams.get("yearPrev")    || undefined,
      limit:       Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/category-score error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
