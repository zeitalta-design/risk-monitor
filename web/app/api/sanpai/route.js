import { NextResponse } from "next/server";
import { listSanpaiItems, getSanpaiByIds } from "@/lib/repositories/sanpai";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getSanpaiByIds(ids) });
    }
    const result = listSanpaiItems({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      license_type: searchParams.get("license_type") || "",
      risk_level: searchParams.get("risk_level") || "",
      status: searchParams.get("status") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/sanpai error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
