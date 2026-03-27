import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase228: スクレイピング監視API
 * GET: ソース別ヘルス + 巡回ログ一覧
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 定義済みソース一覧（既存スクレイピングスクリプトに基づく）
    const SOURCES = [
      { name: "RUNNET", slug: "runnet", description: "マラソン大会情報（一覧＋詳細）" },
      { name: "MOSHICOM", slug: "moshicom", description: "モシコム大会情報" },
    ];

    // ソース別の最新ログと集計
    const sourceHealth = SOURCES.map((source) => {
      const latestLog = db.prepare(
        `SELECT * FROM scraping_logs WHERE source_name = ? ORDER BY created_at DESC LIMIT 1`
      ).get(source.slug);

      const weekLogs = db.prepare(
        `SELECT status, COUNT(*) as count, SUM(success_count) as total_success, SUM(fail_count) as total_fail, SUM(new_count) as total_new, SUM(update_count) as total_update
         FROM scraping_logs WHERE source_name = ? AND created_at >= ?
         GROUP BY status`
      ).all(source.slug, weekAgo);

      const recentLogs = db.prepare(
        `SELECT id, job_type, status, success_count, fail_count, new_count, update_count, error_summary, started_at, finished_at
         FROM scraping_logs WHERE source_name = ? ORDER BY created_at DESC LIMIT 10`
      ).all(source.slug);

      // 連続失敗回数
      const consecutiveFails = db.prepare(
        `SELECT COUNT(*) as count FROM (
           SELECT status, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
           FROM scraping_logs WHERE source_name = ?
         ) WHERE status = 'failed' AND rn <= 10`
      ).get(source.slug)?.count || 0;

      // ヘルス判定
      let health = "unknown";
      if (latestLog) {
        if (latestLog.status === "success") health = "healthy";
        else if (latestLog.status === "failed") health = consecutiveFails >= 3 ? "critical" : "warning";
        else health = "running";
      }

      // 週間統計
      const weekStats = { success: 0, failed: 0, totalSuccess: 0, totalFail: 0, totalNew: 0, totalUpdate: 0 };
      weekLogs.forEach((row) => {
        if (row.status === "success") weekStats.success = row.count;
        if (row.status === "failed") weekStats.failed = row.count;
        weekStats.totalSuccess += row.total_success || 0;
        weekStats.totalFail += row.total_fail || 0;
        weekStats.totalNew += row.total_new || 0;
        weekStats.totalUpdate += row.total_update || 0;
      });

      // DB上の大会数
      const eventCount = db.prepare(
        `SELECT COUNT(*) as count FROM events WHERE is_active = 1`
      ).get()?.count || 0;

      return {
        ...source,
        health,
        consecutiveFails,
        lastRun: latestLog,
        weekStats,
        recentLogs,
        eventCount,
      };
    });

    // 全体サマリー
    const totalLogs = db.prepare(
      `SELECT COUNT(*) as count FROM scraping_logs WHERE created_at >= ?`
    ).get(weekAgo)?.count || 0;

    const failedSources = sourceHealth.filter((s) => s.health === "critical" || s.health === "warning").length;

    return NextResponse.json({
      sources: sourceHealth,
      summary: { totalLogs, failedSources, totalSources: SOURCES.length },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Scraping API error:", err);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
