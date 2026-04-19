/**
 * POST /api/watch-notifications/read
 *
 * Body: { ids: number[] }
 *
 * 指定 id を既読化（UPDATE 一発）。user 所有チェックは SQL 条件で担保。
 * 既読済みはそのまま（read_at を上書きしない）。
 * 他ユーザーの id が混ざっていても WHERE user_id で弾かれる。
 *
 * ids なし / 配列でない / 空配列 / 数値要素無し → 400
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markWatchNotificationsRead } from "@/lib/repositories/watch-notifications";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    if (!body || !Array.isArray(body.ids)) {
      return NextResponse.json({ error: "ids (array) required" }, { status: 400 });
    }
    if (body.ids.length === 0) {
      return NextResponse.json({ error: "ids must not be empty" }, { status: 400 });
    }

    const { updatedCount } = markWatchNotificationsRead({
      userId: user.id,
      ids: body.ids,
    });

    return NextResponse.json({ ok: true, updatedCount });
  } catch (e) {
    console.error("POST /api/watch-notifications/read error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
