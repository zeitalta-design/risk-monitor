import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase228: 運営ダッシュボードAPI
 * KPI・アラート・直近の状況を一括取得
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now - 7 * 86400000).toISOString().split("T")[0];
    const monthAgo = new Date(now - 30 * 86400000).toISOString().split("T")[0];

    // --- KPI ---
    const todayViews = db.prepare(
      `SELECT COUNT(*) as count FROM event_activity_logs WHERE action_type = 'detail_view' AND created_at >= ?`
    ).get(today + "T00:00:00")?.count || 0;

    const weekViews = db.prepare(
      `SELECT COUNT(*) as count FROM event_activity_logs WHERE action_type = 'detail_view' AND created_at >= ?`
    ).get(weekAgo + "T00:00:00")?.count || 0;

    const todaySearches = db.prepare(
      `SELECT COUNT(*) as count FROM event_activity_logs WHERE action_type IN ('search', 'filter_change') AND created_at >= ?`
    ).get(today + "T00:00:00")?.count || 0;

    const todayExtClicks = db.prepare(
      `SELECT COUNT(*) as count FROM event_activity_logs WHERE action_type IN ('entry_click', 'external_click') AND created_at >= ?`
    ).get(today + "T00:00:00")?.count || 0;

    // 問い合わせ
    const openInquiries = db.prepare(
      `SELECT COUNT(*) as count FROM inquiries WHERE status IN ('open', 'in_progress')`
    ).get()?.count || 0;

    const urgentInquiries = db.prepare(
      `SELECT COUNT(*) as count FROM inquiries WHERE status IN ('open', 'in_progress') AND priority = 'urgent'`
    ).get()?.count || 0;

    // スクレイピング
    const scrapingFails = db.prepare(
      `SELECT COUNT(DISTINCT source_name) as count FROM scraping_logs WHERE status = 'failed' AND created_at >= ?`
    ).get(weekAgo + "T00:00:00")?.count || 0;

    const lastScraping = db.prepare(
      `SELECT source_name, status, finished_at, success_count, fail_count, new_count
       FROM scraping_logs ORDER BY created_at DESC LIMIT 5`
    ).all();

    // 大会品質
    const totalEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE is_active = 1`
    ).get()?.count || 0;

    const noDateEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '')`
    ).get()?.count || 0;

    const noPrefEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '')`
    ).get()?.count || 0;

    const staleEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE is_active = 1 AND updated_at < ?`
    ).get(monthAgo + "T00:00:00")?.count || 0;

    const todayUpdated = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE updated_at >= ?`
    ).get(today + "T00:00:00")?.count || 0;

    const todayNew = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE created_at >= ?`
    ).get(today + "T00:00:00")?.count || 0;

    const patrolIssues = noDateEvents + noPrefEvents;

    // --- アラート生成 ---
    const alerts = [];

    if (openInquiries > 0) {
      alerts.push({
        level: urgentInquiries > 0 ? "danger" : "warning",
        message: `未対応の問い合わせが${openInquiries}件あります`,
        detail: urgentInquiries > 0 ? `うち${urgentInquiries}件が緊急` : null,
        href: "/admin/ops/inquiries?status=open",
      });
    }

    if (scrapingFails > 0) {
      alerts.push({
        level: "danger",
        message: `${scrapingFails}件の取得元で巡回に失敗しています`,
        href: "/admin/ops/scraping",
      });
    }

    if (noDateEvents > 0) {
      alerts.push({
        level: "warning",
        message: `開催日が未設定の大会が${noDateEvents}件あります`,
        href: "/admin/ops/patrol?issue=no_date",
      });
    }

    if (staleEvents > 10) {
      alerts.push({
        level: "info",
        message: `30日以上更新されていない大会が${staleEvents}件あります`,
        href: "/admin/ops/patrol?issue=stale",
      });
    }

    // --- 今日の対応タスク ---
    const tasks = [];

    // 緊急: 未対応の緊急問い合わせ
    if (urgentInquiries > 0) {
      tasks.push({
        priority: "urgent",
        label: `緊急問い合わせ ${urgentInquiries}件に対応する`,
        href: "/admin/ops/inquiries?priority=urgent&status=open",
        count: urgentInquiries,
        category: "問い合わせ",
      });
    }

    // 緊急: スクレイピング失敗
    if (scrapingFails > 0) {
      tasks.push({
        priority: "urgent",
        label: `巡回失敗 ${scrapingFails}ソースの原因を確認する`,
        href: "/admin/ops/scraping",
        count: scrapingFails,
        category: "スクレイピング",
      });
    }

    // 重要: 未対応問い合わせ（通常以上）
    const normalInquiries = openInquiries - urgentInquiries;
    if (normalInquiries > 0) {
      tasks.push({
        priority: "high",
        label: `未対応の問い合わせ ${normalInquiries}件を処理する`,
        href: "/admin/ops/inquiries?status=open",
        count: normalInquiries,
        category: "問い合わせ",
      });
    }

    // 重要: 開催日未設定
    if (noDateEvents > 0) {
      tasks.push({
        priority: "high",
        label: `開催日未設定の大会 ${noDateEvents}件を修正する`,
        href: "/admin/ops/patrol?issue=no_date",
        count: noDateEvents,
        category: "品質",
      });
    }

    // 重要: 過去開催なのに公開中
    const pastActiveEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE is_active = 1 AND event_date < ? AND event_date IS NOT NULL AND event_date != ''`
    ).get(today)?.count || 0;
    if (pastActiveEvents > 0) {
      tasks.push({
        priority: "high",
        label: `過去開催で公開中の大会 ${pastActiveEvents}件を確認する`,
        href: "/admin/ops/patrol?issue=past_active",
        count: pastActiveEvents,
        category: "品質",
      });
    }

    // 通常: 都道府県未設定
    if (noPrefEvents > 0) {
      tasks.push({
        priority: "normal",
        label: `都道府県未設定の大会 ${noPrefEvents}件を補完する`,
        href: "/admin/ops/patrol?issue=no_prefecture",
        count: noPrefEvents,
        category: "品質",
      });
    }

    // 通常: 長期未更新
    if (staleEvents > 10) {
      tasks.push({
        priority: "normal",
        label: `30日以上未更新の大会 ${staleEvents}件を再巡回する`,
        href: "/admin/ops/patrol?issue=stale",
        count: staleEvents,
        category: "品質",
      });
    }

    // --- 直近の問い合わせ ---
    const recentInquiries = db.prepare(
      `SELECT id, inquiry_type, subject, name, status, priority, created_at
       FROM inquiries ORDER BY created_at DESC LIMIT 5`
    ).all();

    // --- 直近の活動ログ ---
    const recentActivity = db.prepare(
      `SELECT action_type, COUNT(*) as count, MAX(created_at) as latest
       FROM event_activity_logs
       WHERE created_at >= ?
       GROUP BY action_type
       ORDER BY count DESC
       LIMIT 10`
    ).all(today + "T00:00:00");

    return NextResponse.json({
      kpi: {
        todayViews,
        weekViews,
        todaySearches,
        todayExtClicks,
        openInquiries,
        scrapingFails,
        patrolIssues,
        todayUpdated,
        todayNew,
        totalEvents,
      },
      alerts,
      tasks,
      recentInquiries,
      recentScraping: lastScraping,
      recentActivity,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
