import { NextResponse } from "next/server";
import { getItemsForCompare } from "@/lib/items-service";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam.split(",").map(Number).filter((n) => n > 0);

    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }
    if (ids.length > 3) {
      return NextResponse.json({ error: "比較は最大3件までです" }, { status: 400 });
    }

    const items = getItemsForCompare(ids);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/items/compare error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
