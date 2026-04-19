/**
 * GET /api/nyusatsu/analytics/ranking-diff
 *
 * 2年間の企業ランキング比較（順位変動 / モメンタム）。
 * 既存の getAwardRanking を内部で 2回呼び、entity_id で map 化して diff を返す。
 *
 * Query:
 *   - yearCurrent: YYYY（必須）
 *   - yearPrev:    YYYY（必須）
 *   - metric:      count | amount（default count）
 *   - limit:       出力件数（default 100）
 *
 * レスポンス:
 *   { yearCurrent, yearPrev, metric, items: Array<diffRow> }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchRankingDiff } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearCurrent = searchParams.get("yearCurrent");
    const yearPrev    = searchParams.get("yearPrev");
    const metricRaw   = searchParams.get("metric") || "count";
    const metric      = metricRaw === "amount" ? "amount" : "count";
    const limitRaw    = parseInt(searchParams.get("limit") || "", 10);
    const limit       = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, limitRaw) : 100;

    if (!yearCurrent || !yearPrev || !/^\d{4}$/.test(yearCurrent) || !/^\d{4}$/.test(yearPrev)) {
      return NextResponse.json({ error: "yearCurrent / yearPrev (YYYY) are required" }, { status: 400 });
    }

    const items = fetchRankingDiff({
      db: getDb(),
      yearCurrent,
      yearPrev,
      metric,
      limit,
    });

    return NextResponse.json({ yearCurrent, yearPrev, metric, items });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/ranking-diff error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
