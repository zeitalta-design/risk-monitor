import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBuyerRelations } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entity_id") ? parseInt(searchParams.get("entity_id"), 10) : undefined;
    const clusterId = searchParams.get("cluster_id") ? parseInt(searchParams.get("cluster_id"), 10) : undefined;
    if (entityId == null && clusterId == null) {
      return NextResponse.json({ error: "entity_id または cluster_id が必要" }, { status: 400 });
    }
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const dateFrom = searchParams.get("from") || undefined;
    const dateTo = searchParams.get("to") || undefined;
    const category = searchParams.get("category") || undefined;

    const r = getBuyerRelations({
      db: getDb(), entityId, clusterId, limit, dateFrom, dateTo, category,
    });
    return NextResponse.json(r);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/buyer-relations error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
