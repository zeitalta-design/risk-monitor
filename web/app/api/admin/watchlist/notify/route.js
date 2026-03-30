/**
 * POST /api/admin/watchlist/notify — ウォッチ通知を実行
 *
 * body: { dryRun?: boolean }
 *
 * 新着処分があるウォッチ対象について、ユーザーごとに digest メールを送信する。
 * dryRun=true で送信せずに対象確認のみ。
 * 将来 GitHub Actions scheduled workflow から呼ぶことを想定。
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { runWatchlistNotifications } from "@/lib/watchlist-notification-service";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;

    const result = await runWatchlistNotifications({ dryRun });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
