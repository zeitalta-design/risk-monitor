import { NextResponse } from "next/server";
import { listKyoninkaEntities, getKyoninkaByIds } from "@/lib/repositories/kyoninka";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getKyoninkaByIds(ids) });
    }
    const result = listKyoninkaEntities({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      license_family: searchParams.get("license_family") || "",
      entity_status: searchParams.get("entity_status") || "",
      has_corporate_number: searchParams.get("has_corporate_number") || "",
      has_disciplinary: searchParams.get("has_disciplinary") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/kyoninka error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
