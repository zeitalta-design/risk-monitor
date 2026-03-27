import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/automation/status
 * 4ドメイン横断の運用ステータスサマリー
 */
export async function GET() {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const db = getDb();

    const domains = ["food-recall", "shitei", "sanpai", "kyoninka"];
    const status = {};

    for (const domainId of domains) {
      // 最新 sync_run
      const lastRun = db.prepare(
        "SELECT * FROM sync_runs WHERE domain_id = ? ORDER BY id DESC LIMIT 1"
      ).get(domainId);

      // review 待ち件数
      const reviewPending = db.prepare(
        "SELECT COUNT(*) as c FROM change_logs WHERE domain_id = ? AND requires_review = 1 AND reviewed_at IS NULL"
      ).get(domainId).c;

      // AI抽出件数
      const aiTotal = db.prepare(
        "SELECT COUNT(*) as c FROM ai_extractions WHERE domain_id = ?"
      ).get(domainId).c;
      const aiApplied = db.prepare(
        "SELECT COUNT(*) as c FROM ai_extractions WHERE domain_id = ? AND applied_at IS NOT NULL"
      ).get(domainId).c;

      // 未読通知
      const unreadNotifs = db.prepare(
        "SELECT COUNT(*) as c FROM admin_notifications WHERE domain_id = ? AND read_at IS NULL"
      ).get(domainId).c;

      // アイテム数
      const tableMap = { "food-recall": "food_recall_items", shitei: "shitei_items", sanpai: "sanpai_items", kyoninka: "kyoninka_entities" };
      const table = tableMap[domainId];
      const itemCount = table ? db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE is_published = 1`).get().c : 0;

      status[domainId] = {
        itemCount,
        lastRun: lastRun ? {
          id: lastRun.id,
          status: lastRun.run_status,
          fetched: lastRun.fetched_count,
          created: lastRun.created_count,
          updated: lastRun.updated_count,
          unchanged: lastRun.unchanged_count,
          failed: lastRun.failed_count,
          startedAt: lastRun.started_at,
          finishedAt: lastRun.finished_at,
        } : null,
        reviewPending,
        aiExtractions: { total: aiTotal, applied: aiApplied },
        unreadNotifications: unreadNotifs,
      };
    }

    return NextResponse.json({ status, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
