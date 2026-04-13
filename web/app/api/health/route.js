import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Phase224: ヘルスチェックAPI
 *
 * GET /api/health — サービス稼働状況を返す
 * 外部監視ツール（UptimeRobot等）から定期的にアクセスして死活監視。
 */
export async function GET() {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // DBヘルスチェック
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get();
    checks.checks.database = {
      status: "ok",
      active_events: row.cnt,
    };
  } catch (err) {
    checks.checks.database = { status: "error", message: err.message };
    checks.status = "degraded";
  }

  // データ鮮度チェック（最終スクレイピング日時）
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT MAX(scraped_at) as last_scraped FROM events WHERE scraped_at IS NOT NULL"
    ).get();
    const lastScraped = row?.last_scraped ? new Date(row.last_scraped) : null;
    const hoursSince = lastScraped
      ? Math.round((Date.now() - lastScraped.getTime()) / (1000 * 60 * 60))
      : null;

    checks.checks.data_freshness = {
      status: hoursSince !== null && hoursSince < 72 ? "ok" : "warning",
      last_scraped: row?.last_scraped || null,
      hours_since: hoursSince,
    };
  } catch {
    checks.checks.data_freshness = { status: "unknown" };
  }

  // 全体ステータス判定
  const hasError = Object.values(checks.checks).some((c) => c.status === "error");
  if (hasError) checks.status = "degraded";

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
