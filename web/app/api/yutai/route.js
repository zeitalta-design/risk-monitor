import { NextResponse } from "next/server";
import { listYutaiItems, getYutaiByIds } from "@/lib/repositories/yutai";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // compare 用: ids パラメータがあれば複数件取得
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      const items = getYutaiByIds(ids);
      return NextResponse.json({ items });
    }

    // 通常一覧
    const result = listYutaiItems({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      sort: searchParams.get("sort") || "popular",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("page_size") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/yutai error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
