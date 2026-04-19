import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAwardRanking } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const by = searchParams.get("by") || "entity";
    const metric = searchParams.get("metric") || "count";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    let dateFrom = searchParams.get("from") || undefined;
    let dateTo = searchParams.get("to") || undefined;
    const category = searchParams.get("category") || undefined;

    // year=YYYY を渡されたら from/to を暦年範囲に展開。from/to が明示的に
    // 渡されている場合はそちらを優先（後方互換）。
    const yearRaw = searchParams.get("year");
    if (yearRaw && /^\d{4}$/.test(yearRaw) && !dateFrom && !dateTo) {
      dateFrom = `${yearRaw}-01-01`;
      dateTo   = `${yearRaw}-12-31`;
    }

    const rows = getAwardRanking({
      db: getDb(), by, metric, limit, dateFrom, dateTo, category,
    });
    return NextResponse.json({ by, metric, year: yearRaw || null, items: rows });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/ranking error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
