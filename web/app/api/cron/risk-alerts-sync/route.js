import { NextResponse } from "next/server";
import { syncRiskAlerts } from "@/lib/watchlist-notification-service";
import { runWatchlistNotifications } from "@/lib/watchlist-notification-service";

/**
 * POST /api/cron/risk-alerts-sync
 *
 * 定期実行用: ウォッチ対象の新着処分を risk_alerts に同期し、
 * メール通知を送信する。
 *
 * 外部 cron / setup-cron-risk-alerts.sh から呼ばれる想定。
 *
 * Query params:
 *   dry_run  - "1" のとき送信せず結果のみ返す
 *   sync_only - "1" のとき risk_alerts 同期のみ（メール送信なし）
 *
 * 認証:
 *   CRON_SECRET 環境変数が設定されている場合、
 *   Authorization: Bearer <CRON_SECRET> ヘッダーを必須とする。
 */
export async function POST(request) {
  // オプション: CRON_SECRET による簡易認証
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dry_run") === "1";
    const syncOnly = searchParams.get("sync_only") === "1";

    // Step 1: risk_alerts 同期（冪等）
    const syncResult = syncRiskAlerts();

    if (syncOnly) {
      return NextResponse.json({
        ok: true,
        mode: "sync_only",
        syncResult,
        dryRun: false,
      });
    }

    // Step 2: メール通知送信
    const notifyResult = await runWatchlistNotifications({ dryRun });

    return NextResponse.json({
      ok: true,
      mode: dryRun ? "dry_run" : "live",
      syncResult,
      notifyResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
