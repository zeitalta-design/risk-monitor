import { NextResponse } from "next/server";
import { listAdministrativeActions } from "@/lib/repositories/gyosei-shobun";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = listAdministrativeActions({
      keyword: searchParams.get("keyword") || "",
      action_type: searchParams.get("action_type") || "",
      prefecture: searchParams.get("prefecture") || "",
      industry: searchParams.get("industry") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
