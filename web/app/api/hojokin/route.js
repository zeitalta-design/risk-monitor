import { NextResponse } from "next/server";
import { listHojokinItems, getHojokinByIds } from "@/lib/repositories/hojokin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // compare 用: ids パラメータ
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getHojokinByIds(ids) });
    }

    const result = listHojokinItems({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      sort: searchParams.get("sort") || "popular",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/hojokin error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
