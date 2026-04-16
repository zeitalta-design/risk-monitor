import { NextResponse } from "next/server";
import { getNyusatsuStats } from "@/lib/repositories/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getNyusatsuStats({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      area: searchParams.get("area") || "",
      bidding_method: searchParams.get("bidding_method") || "",
      budget_range: searchParams.get("budget_range") || "",
      deadline_within: searchParams.get("deadline_within") || "",
      status: searchParams.get("status") || "",
      issuer: searchParams.get("issuer") || "",
      year: searchParams.get("year") || "",
      deadline_from: searchParams.get("deadline_from") || "",
      deadline_to: searchParams.get("deadline_to") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
