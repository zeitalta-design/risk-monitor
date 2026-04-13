import { NextResponse } from "next/server";
import { searchItems, getCategoryCounts } from "@/lib/items-service";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = searchItems({
      category: searchParams.get("category") || undefined,
      keyword: searchParams.get("keyword") || undefined,
      priceRange: searchParams.get("price_range") || undefined,
      companySize: searchParams.get("company_size") || undefined,
      hasFreePlan: searchParams.get("has_free_plan") === "1",
      hasFreeTrial: searchParams.get("has_free_trial") === "1",
      sort: searchParams.get("sort") || "popularity",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });

    const categoryCounts = getCategoryCounts();

    return NextResponse.json({ ...result, categoryCounts });
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
