import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { notifyPatrolDanger } from "@/lib/ops-notify";

/**
 * Phase228: パトロール品質チェック → 危険件数があればSlack通知
 *
 * POST /api/admin/ops/patrol/check-notify
 * 用途: cronジョブやダッシュボードから定期呼び出し
 * 認証不要（サーバーサイドのジョブから呼ぶため）ただしsecretで保護
 */
export async function POST(request) {
  // 簡易シークレット保護（cronジョブ用）
  const authHeader = request.headers.get("x-ops-secret");
  const secret = process.env.OPS_CRON_SECRET;
  if (secret && authHeader !== secret) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const db = getDb();
    const now = new Date().toISOString().split("T")[0];

    const dangerChecks = [
      {
        key: "no_date",
        label: "開催日未設定",
        query: `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '')`,
      },
      {
        key: "no_prefecture",
        label: "都道府県未設定",
        query: `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '')`,
      },
      {
        key: "past_active",
        label: "過去データなのに公開中",
        query: `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND event_date < '${now}' AND event_date IS NOT NULL AND event_date != ''`,
      },
      {
        key: "conflict",
        label: "情報矛盾あり",
        query: `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND verification_conflict = 1`,
      },
    ];

    const issues = dangerChecks.map((check) => ({
      key: check.key,
      label: check.label,
      count: db.prepare(check.query).get()?.c || 0,
    }));

    const dangerIssues = issues.filter((i) => i.count > 0);

    if (dangerIssues.length > 0) {
      await notifyPatrolDanger({ issues: dangerIssues });
    }

    return NextResponse.json({
      notified: dangerIssues.length > 0,
      issues,
      dangerCount: dangerIssues.length,
    });
  } catch (err) {
    console.error("Patrol check-notify error:", err);
    return NextResponse.json({ error: "チェック失敗" }, { status: 500 });
  }
}
