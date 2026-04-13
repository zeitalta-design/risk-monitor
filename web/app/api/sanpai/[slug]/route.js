import { NextResponse } from "next/server";
import { getSanpaiBySlug, listPenaltiesByItemId } from "@/lib/repositories/sanpai";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getSanpaiBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    const penalties = listPenaltiesByItemId(item.id);
    return NextResponse.json({ item, penalties });
  } catch (error) {
    console.error("GET /api/sanpai/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
