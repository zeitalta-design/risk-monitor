import { NextResponse } from "next/server";
import { getAdministrativeActionBySlug } from "@/lib/repositories/gyosei-shobun";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const item = getAdministrativeActionBySlug(slug);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
