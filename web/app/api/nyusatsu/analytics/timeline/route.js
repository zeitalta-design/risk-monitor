import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAwardTimeline } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const granularity = searchParams.get("granularity") || "month";
    const entityId = searchParams.get("entity_id") ? parseInt(searchParams.get("entity_id"), 10) : undefined;
    const clusterId = searchParams.get("cluster_id") ? parseInt(searchParams.get("cluster_id"), 10) : undefined;
    const issuerName = searchParams.get("issuer") || undefined;
    const dateFrom = searchParams.get("from") || undefined;
    const dateTo = searchParams.get("to") || undefined;
    const category = searchParams.get("category") || undefined;

    const rows = getAwardTimeline({
      db: getDb(), granularity, entityId, clusterId, issuerName,
      dateFrom, dateTo, category,
    });
    return NextResponse.json({ granularity, items: rows });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/timeline error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
