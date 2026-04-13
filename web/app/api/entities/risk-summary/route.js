/**
 * GET /api/entities/risk-summary
 * Query params:
 *   name (required) — organization_name_raw
 *   industry (optional)
 *
 * Returns risk score summary for a single entity.
 * Used by list cards, detail pages, and risk-watch page.
 */
import { NextResponse } from "next/server";
import { calcRiskScore } from "@/lib/risk-score";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const industry = searchParams.get("industry") || "";

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const result = calcRiskScore(name, industry);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
