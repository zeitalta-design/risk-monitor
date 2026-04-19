/**
 * POST /api/deals/unsave （Phase J-14）
 *
 * Body: { deal_slug: string }
 *
 * 保存解除。冪等: 保存されていなかった場合は 200 `not_found`。
 * 認証必須。他 user の保存には SQL 条件で触れない。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unsaveDeal } from "@/lib/repositories/saved-deals";

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

    const result = unsaveDeal(user.id, slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("POST /api/deals/unsave error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
