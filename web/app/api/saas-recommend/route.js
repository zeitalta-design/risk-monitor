import { NextResponse } from "next/server";
import { getRecommendations, getCategoryPresets } from "@/lib/saas-recommend";

/**
 * GET /api/saas-recommend?category=crm&company_size=small&price_focus=free&limit=5
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const companySize = searchParams.get("company_size") || "";
    const priceFocus = searchParams.get("price_focus") || "";
    const limit = parseInt(searchParams.get("limit") || "5");

    const conditions = {};
    if (companySize) conditions.companySize = companySize;
    if (priceFocus) conditions.priceFocus = priceFocus;

    const items = getRecommendations(category, conditions, limit);
    const presets = getCategoryPresets(category);

    return NextResponse.json({ items, presets });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
