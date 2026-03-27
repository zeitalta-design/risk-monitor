import { NextResponse } from "next/server";
import { listShiteiItems, getShiteiByIds } from "@/lib/repositories/shitei";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getShiteiByIds(ids) });
    }
    const result = listShiteiItems({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      facility_category: searchParams.get("facility_category") || "",
      recruitment_status: searchParams.get("recruitment_status") || "",
      municipality: searchParams.get("municipality") || "",
      sort: searchParams.get("sort") || "deadline",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/shitei error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
