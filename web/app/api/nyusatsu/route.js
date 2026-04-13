import { NextResponse } from "next/server";
import { listNyusatsuItems, getNyusatsuByIds } from "@/lib/repositories/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getNyusatsuByIds(ids) });
    }
    const result = listNyusatsuItems({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      area: searchParams.get("area") || "",
      bidding_method: searchParams.get("bidding_method") || "",
      budget_range: searchParams.get("budget_range") || "",
      deadline_within: searchParams.get("deadline_within") || "",
      status: searchParams.get("status") || "",
      sort: searchParams.get("sort") || "popular",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/nyusatsu error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
