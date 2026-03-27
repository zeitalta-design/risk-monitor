import { NextResponse } from "next/server";
import { getShiteiBySlug } from "@/lib/repositories/shitei";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getShiteiBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/shitei/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
