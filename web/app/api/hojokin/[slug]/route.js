import { NextResponse } from "next/server";
import { getHojokinBySlug } from "@/lib/repositories/hojokin";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getHojokinBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/hojokin/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
