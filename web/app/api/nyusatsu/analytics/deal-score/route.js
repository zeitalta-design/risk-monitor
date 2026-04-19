/**
 * GET /api/nyusatsu/analytics/deal-score
 *
 * Deal Score。entity × 案件（results / items）で Deal Score を返す。
 * 内部で analyzer を直接呼び、追加の HTTP は発行しない。
 *
 * Query:
 *   - entityId  (必須)
 *   - dealId    (必須) — nyusatsu_results.id or nyusatsu_items.id
 *   - resultId  (後方互換) — 渡されれば dealId + source=results として扱う
 *   - source    (任意) — "results" | "items"（default "results"）
 *   - yearCurrent / yearPrev (任意)
 *
 * レスポンス: { score, label, components, weights, deal, sources, reasons, years }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeDealScore } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = parseInt(searchParams.get("entityId") || "", 10);
    const dealId   = parseInt(searchParams.get("dealId")   || "", 10);
    const resultId = parseInt(searchParams.get("resultId") || "", 10);
    const rawSource = (searchParams.get("source") || "").toLowerCase();

    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "entityId is required" }, { status: 400 });
    }
    const effectiveDealId = Number.isFinite(dealId) && dealId > 0 ? dealId
                          : Number.isFinite(resultId) && resultId > 0 ? resultId
                          : null;
    if (!effectiveDealId) {
      return NextResponse.json({ error: "dealId (or resultId) is required" }, { status: 400 });
    }
    // source validation：resultId 経由なら results を強制。dealId 経由は default results。
    let effectiveSource = rawSource || (Number.isFinite(resultId) && resultId > 0 ? "results" : "results");
    if (effectiveSource !== "results" && effectiveSource !== "items") {
      return NextResponse.json({ error: "source must be 'results' or 'items'" }, { status: 400 });
    }

    const result = await computeDealScore({
      db: getDb(),
      entityId,
      dealId: effectiveDealId,
      source: effectiveSource,
      yearCurrent: searchParams.get("yearCurrent") || undefined,
      yearPrev:    searchParams.get("yearPrev")    || undefined,
    });
    if (!result) {
      return NextResponse.json({ error: "deal not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/deal-score error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
