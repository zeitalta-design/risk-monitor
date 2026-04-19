/**
 * POST /api/deals/unpin （Phase J-17）
 *
 * Body: { deal_slug: string }
 *
 * 保存済み案件の pin を外す。冪等: 既に非 pin なら 200 `already_unpinned`。
 * 未保存 slug は 404 `not_saved`。
 * 認証必須。他 user の saved_deals には SQL 条件で触れない。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unpinDeal } from "@/lib/repositories/saved-deals";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
    const slug = typeof body?.deal_slug === "string" ? body.deal_slug.trim() : "";
    if (!slug) {
      return NextResponse.json({ error: "deal_slug is required" }, { status: 400 });
    }

    const result = unpinDeal(user.id, slug);
    if (result.action === "not_saved") {
      return NextResponse.json({ error: "deal is not saved", ...result }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("POST /api/deals/unpin error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
