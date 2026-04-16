import { NextResponse } from "next/server";
import { getHojokinStats } from "@/lib/repositories/hojokin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getHojokinStats({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      target_type: searchParams.get("target_type") || "",
      status: searchParams.get("status") || "",
      provider: searchParams.get("provider") || "",
      year: searchParams.get("year") || "",
      deadline_from: searchParams.get("deadline_from") || "",
      deadline_to: searchParams.get("deadline_to") || "",
      amount_min: searchParams.get("amount_min") || "",
      amount_max: searchParams.get("amount_max") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
