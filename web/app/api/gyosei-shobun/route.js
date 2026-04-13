import { NextResponse } from "next/server";
import { listAdministrativeActions, getAdministrativeActionsByIds } from "@/lib/repositories/gyosei-shobun";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // 複数ID指定の場合（比較機能用）
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ items: [] });
      const items = getAdministrativeActionsByIds(ids);
      return NextResponse.json({ ok: true, items });
    }

    const result = listAdministrativeActions({
      keyword: searchParams.get("keyword") || "",
      action_type: searchParams.get("action_type") || "",
      prefecture: searchParams.get("prefecture") || "",
      industry: searchParams.get("industry") || "",
      year: searchParams.get("year") || "",
      organization: searchParams.get("organization") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
