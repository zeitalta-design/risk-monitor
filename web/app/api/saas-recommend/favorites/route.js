import { NextResponse } from "next/server";
import { getRecommendationsFromFavorites } from "@/lib/saas-recommend";

/**
 * GET /api/saas-recommend/favorites?user_key=xxx&limit=5
 * お気に入りベースの推薦
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("user_key") || "";
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!userKey) return NextResponse.json({ items: [], message: "user_key required" });

    const items = getRecommendationsFromFavorites(userKey, limit);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ items: [], error: error.message });
  }
}
