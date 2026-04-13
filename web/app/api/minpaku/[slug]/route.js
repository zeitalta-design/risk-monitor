import { NextResponse } from "next/server";
import { getMinpakuBySlug } from "@/lib/repositories/minpaku";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getMinpakuBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
