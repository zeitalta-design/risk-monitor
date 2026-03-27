import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { findSimilarServices } from "@/lib/saas-recommend";

/**
 * GET /api/saas-recommend/similar?item_id=1&limit=5
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = parseInt(searchParams.get("item_id") || "0");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 });

    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    const similar = findSimilarServices(item, limit);

    return NextResponse.json({
      similar: similar.map(s => ({
        id: s.item.id,
        slug: s.item.slug,
        title: s.item.title,
        category: s.item.category,
        summary: s.item.summary,
        price_display: s.item.price_display,
        provider_name: s.item.provider_name,
        popularity_score: s.item.popularity_score,
        score: s.score,
        reasons: s.reasons,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
