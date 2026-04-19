/**
 * POST /api/deals/save （Phase J-14）
 *
 * Body: { deal_slug: string }
 *
 * 指定 slug を保存（ピン留め）する。冪等: 既に保存済みなら 200 `already_saved`。
 * slug は nyusatsu_items に実在する公開行のみ許可（存在しない slug / 未公開は 404）。
 * 認証必須。他 user の保存には SQL 条件で触れない。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { saveDeal } from "@/lib/repositories/saved-deals";

export const dynamic = "force-dynamic";

// Phase M-5: 非 Pro ユーザーの保存上限 (件)
const FREE_SAVE_LIMIT = 3;

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

    // slug の実在チェック（未公開 / 存在しないと 404）。
    // Phase J-16: 初回保存の last_seen_status snapshot 用に status も同時取得。
    const db = getDb();
    const item = db.prepare(
      "SELECT id, status FROM nyusatsu_items WHERE slug = ? AND is_published = 1 LIMIT 1"
    ).get(slug);
    if (!item) {
      return NextResponse.json({ error: "deal not found" }, { status: 404 });
    }

    // Phase M-5: 非 Pro ユーザーは FREE_SAVE_LIMIT 件まで。
    //   既に保存済みの slug を再 POST する冪等ケースは制限対象外（total は既に同値）。
    if (!user.isPro) {
      const alreadySaved = db.prepare(
        "SELECT 1 FROM saved_deals WHERE user_id = ? AND deal_slug = ? LIMIT 1",
      ).get(user.id, slug);
      if (!alreadySaved) {
        const { n } = db.prepare(
          "SELECT COUNT(*) AS n FROM saved_deals WHERE user_id = ?",
        ).get(user.id) || { n: 0 };
        if ((n || 0) >= FREE_SAVE_LIMIT) {
          return NextResponse.json(
            {
              error: "save_limit_reached",
              message: `無料プランでは ${FREE_SAVE_LIMIT} 件までしか保存できません`,
              limit: FREE_SAVE_LIMIT,
              upgradeUrl: "/pricing",
            },
            { status: 402 },
          );
        }
      }
    }

    const result = saveDeal(user.id, slug, item.status ?? null);
    const status = result.action === "added" ? 201 : 200;
    return NextResponse.json({ ok: true, ...result }, { status });
  } catch (e) {
    console.error("POST /api/deals/save error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
