import { NextResponse } from "next/server";
import { getCompareMarathons } from "@/lib/marathon-compare-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/compare?ids=1,2,3
 *
 * 比較対象の大会データを取得する
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ marathons: [] });
    }

    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .slice(0, 3); // 最大3件

    if (ids.length === 0) {
      return NextResponse.json({ marathons: [] });
    }

    const marathons = getCompareMarathons(ids);

    return NextResponse.json({ marathons });
  } catch (err) {
    console.error("Compare API error:", err);
    return NextResponse.json({ marathons: [], error: err.message }, { status: 500 });
  }
}
