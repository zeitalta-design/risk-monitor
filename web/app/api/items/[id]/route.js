import { NextResponse } from "next/server";
import { getItemBySlug, getItemById, getAlternatives } from "@/lib/items-service";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // slug またはIDで取得
    let item = getItemBySlug(id);
    if (!item && /^\d+$/.test(id)) {
      item = getItemById(Number(id));
      if (item && item.slug) {
        // IDアクセスはslugへリダイレクト用にフラグ付与
        item._redirectSlug = item.slug;
      }
    }

    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // 代替ツール
    const alternatives = getAlternatives(item.id, item.category);

    return NextResponse.json({ item, alternatives });
  } catch (error) {
    console.error("GET /api/items/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
