import { NextResponse } from "next/server";
import { getFoodRecallBySlug } from "@/lib/repositories/food-recall";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getFoodRecallBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/food-recall/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
