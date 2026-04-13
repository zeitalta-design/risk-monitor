import { NextResponse } from "next/server";
import { listMinpakuItems, getMinpakuByIds } from "@/lib/repositories/minpaku";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((n) => n > 0);
      return NextResponse.json({ items: getMinpakuByIds(ids) });
    }
    return NextResponse.json(listMinpakuItems({
      keyword: searchParams.get("keyword") || "", category: searchParams.get("category") || "",
      sort: searchParams.get("sort") || "popular", page: parseInt(searchParams.get("page") || "1"),
    }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
