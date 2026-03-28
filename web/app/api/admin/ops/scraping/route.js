import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { execFile } from "child_process";
import path from "path";

/**
 * スクレイピング監視API
 * GET: ソース別ヘルス + 巡回ログ一覧
 * POST: 手動再実行
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 定義済みソース一覧（既存スクレイピングスクリプトに基づく）
    const SOURCES = [
      { name: "RUNNET", slug: "runnet", description: "マラソン大会情報（一覧＋詳細）", schedule: "3日に1回" },
      { name: "MOSHICOM", slug: "moshicom", description: "モシコム大会情報（一覧＋詳細）", schedule: "週1回" },
      { name: "SPORTS ENTRY", slug: "sportsentry", description: "スポーツエントリー大会情報", schedule: "3日に1回" },
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

      // DB上の大会数（ソース別）
      const eventCount = db.prepare(
        `SELECT COUNT(*) as count FROM events WHERE is_active = 1 AND (source_site = ? OR source_url LIKE ?)`
      ).get(source.slug, `%${source.slug}%`)?.count || 0;

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

/**
 * POST: 手動再実行
 * body: { source: "runnet" | "sportsentry" | "moshicom" }
 */
const SCRAPE_COMMANDS = {
  runnet: { script: "scripts/scrape-runnet-list.js", args: ["--pages", "all", "--verbose"] },
  sportsentry: { script: "scripts/scrape-sportsentry-list.js", args: ["--pages", "all", "--verbose"] },
  moshicom: { script: "scripts/scrape-moshicom-list.js", args: ["--pages", "all", "--verbose"] },
};

export async function POST(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { source } = await request.json();

    if (!source || !SCRAPE_COMMANDS[source]) {
      return NextResponse.json(
        { error: `無効なソース: ${source}。有効値: ${Object.keys(SCRAPE_COMMANDS).join(", ")}` },
        { status: 400 }
      );
    }

    const cmd = SCRAPE_COMMANDS[source];

    // スクリプトパスの解決（コンテナ内では /app/scripts/、ローカルでは ../scripts/）
    const scriptPaths = [
      path.join(process.cwd(), "..", cmd.script),  // ローカル: web/../scripts/
      path.join("/app", cmd.script),                // Docker: /app/scripts/
    ];
    const fs = await import("fs");
    const scriptPath = scriptPaths.find((p) => fs.existsSync(p));

    if (!scriptPath) {
      return NextResponse.json(
        { error: `スクリプトが見つかりません: ${cmd.script}` },
        { status: 500 }
      );
    }

    // 非同期でスクレイパーを実行
    const result = await new Promise((resolve, reject) => {
      const proc = execFile("node", [scriptPath, ...cmd.args], {
        timeout: 900_000, // 15分（終端巡回対応）
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            output: (stdout || "").slice(-2000),
            stderr: (stderr || "").slice(-1000),
          });
        } else {
          resolve({
            success: true,
            output: (stdout || "").slice(-2000),
          });
        }
      });
    });

    // ログ記録
    try {
      const db = getDb();
      const now = new Date().toISOString();

      // 出力からカウントを抽出
      const insertedMatch = result.output.match(/Inserted:\s*(\d+)/);
      const updatedMatch = result.output.match(/Updated:\s*(\d+)/);
      const totalMatch = result.output.match(/Total.*?:\s*(\d+)/);

      db.prepare(`
        INSERT INTO scraping_logs (source_name, job_type, status, success_count, fail_count, new_count, update_count, error_summary, started_at, finished_at, created_at)
        VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        source,
        result.success ? "success" : "failed",
        result.success ? 1 : 0,
        result.success ? 0 : 1,
        insertedMatch ? parseInt(insertedMatch[1]) : 0,
        updatedMatch ? parseInt(updatedMatch[1]) : 0,
        result.success ? null : (result.error || "").slice(0, 500),
        now,
        now,
        now,
      );
    } catch (logErr) {
      console.warn("[scraping] Failed to write log:", logErr.message);
    }

    return NextResponse.json({
      success: result.success,
      source,
      output: result.output,
      error: result.error || null,
    });
  } catch (err) {
    console.error("Scraping manual run error:", err);
    return NextResponse.json({ error: "実行に失敗しました: " + err.message }, { status: 500 });
  }
}
