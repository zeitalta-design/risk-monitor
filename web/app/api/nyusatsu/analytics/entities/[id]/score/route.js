/**
 * GET /api/nyusatsu/analytics/entities/[id]/score
 *
 * Entity Momentum Score（Phase H Step 1）。既存 analyzer を合成して 0〜100 を返す。
 *
 * Query:
 *   - yearCurrent / yearPrev: YYYY（未指定なら前年 vs 前々年）
 *
 * レスポンス: { entity_id, name, year_current, year_prev, score, label, components, inputs, weights }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeEntityMomentumScore } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const entityId = parseInt((await params).id, 10);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "invalid entity id" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const result = computeEntityMomentumScore({
      db: getDb(),
      entityId,
      yearCurrent: searchParams.get("yearCurrent") || undefined,
      yearPrev:    searchParams.get("yearPrev")    || undefined,
    });
    if (!result) return NextResponse.json({ error: "entity not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/entities/[id]/score error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
