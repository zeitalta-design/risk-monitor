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
    const dateFrom = searchParams.get("from") || undefined;
    const dateTo = searchParams.get("to") || undefined;
    const category = searchParams.get("category") || undefined;

    const rows = getAwardRanking({
      db: getDb(), by, metric, limit, dateFrom, dateTo, category,
    });
    return NextResponse.json({ by, metric, items: rows });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/ranking error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
