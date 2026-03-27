import { NextResponse } from "next/server";
import { getKyoninkaBySlug, listRegistrationsByEntityId } from "@/lib/repositories/kyoninka";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getKyoninkaBySlug(slug);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    const registrations = listRegistrationsByEntityId(item.id);
    return NextResponse.json({ item, registrations });
  } catch (error) {
    console.error("GET /api/kyoninka/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
