/**
 * GET /api/gyosei-shobun/stats — 行政処分DB 統計ダッシュボード用
 *
 * 検索・絞り込み条件に対して集計を返す。page は含まない。
 */

import { NextResponse } from "next/server";
import { getAdministrativeActionStats } from "@/lib/repositories/gyosei-shobun";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getAdministrativeActionStats({
      keyword: searchParams.get("keyword") || "",
      action_type: searchParams.get("action_type") || "",
      prefecture: searchParams.get("prefecture") || "",
      industry: searchParams.get("industry") || "",
      year: searchParams.get("year") || "",
      organization: searchParams.get("organization") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
