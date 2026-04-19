/**
 * POST /api/watch-notifications/read-daily-digest （Phase J-12）
 *
 * 「今日の有望案件まとめ (digest)」をサーバー側で安全に一括既読化する。
 *
 * 対象:
 *   - type = 'deal_score'
 *   - frequency = 'daily'
 *   - created_at >= JST 当日 0:00
 *   - read_at IS NULL
 *
 * これにより、dropdown / 一覧ページで表示中の item だけでなく、
 * ページング境界外の当日 daily digest 行もまとめて既読化できる。
 *
 * 既存 `/read` `/read-all` は残したまま、daily digest 専用経路として追加する。
 * user 所有チェックは SQL 条件に含める（他ユーザーの行は絶対に触れない）。
 * 返却は updatedCount のみ。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markDailyDigestRead } from "@/lib/repositories/watch-notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { updatedCount, cutoff } = markDailyDigestRead({ userId: user.id });
    return NextResponse.json({ ok: true, updatedCount, cutoff });
  } catch (e) {
    console.error("POST /api/watch-notifications/read-daily-digest error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
