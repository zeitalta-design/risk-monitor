/**
 * GET /api/deals/saved （Phase J-14）
 *
 * ログインユーザーの保存案件一覧を案件メタ付きで返す。
 *
 * Query:
 *   - mode=set : 保存 slug の Set のみを返す（一覧バッジ用、軽量）
 *   - limit    : 1..100 (default 30)
 *   - offset   : >=0    (default 0)
 *
 * 認証必須。未ログインは 401。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listSavedDeals, getSavedDealSlugSet } from "@/lib/repositories/saved-deals";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    if (searchParams.get("mode") === "set") {
      const set = getSavedDealSlugSet(user.id);
      return NextResponse.json({ slugs: [...set] });
    }

    const limitRaw = parseInt(searchParams.get("limit") || "", 10);
    const offsetRaw = parseInt(searchParams.get("offset") || "", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, limitRaw) : 30;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const { items, total } = listSavedDeals({ userId: user.id, limit, offset });
    return NextResponse.json({ items, total, limit, offset });
  } catch (e) {
    console.error("GET /api/deals/saved error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
