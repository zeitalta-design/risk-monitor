import { NextResponse } from "next/server";
import { listFoodRecallItems, getFoodRecallByIds } from "@/lib/repositories/food-recall";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getFoodRecallByIds(ids) });
    }
    const result = listFoodRecallItems({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      risk_level: searchParams.get("risk_level") || "",
      reason: searchParams.get("reason") || "",
      status: searchParams.get("status") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/food-recall error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
