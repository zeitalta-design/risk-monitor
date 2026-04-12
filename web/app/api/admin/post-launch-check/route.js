import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

/**
 * Phase229: 公開後チェックAPI
 *
 * GET /api/admin/post-launch-check
 * 公開直後に確認すべき項目を自動チェックし結果を返す。
 * 管理画面の公開チェックページから呼ばれる。
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: siteConfig.siteUrl,
    checks: [],
  };

  // 1. DB接続 + アクティブイベント数
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get();
    results.checks.push({
      name: "データベース接続",
      category: "インフラ",
      status: row.cnt > 0 ? "pass" : "warn",
      detail: `アクティブイベント: ${row.cnt}件`,
    });
  } catch (err) {
    results.checks.push({
      name: "データベース接続",
      category: "インフラ",
      status: "fail",
      detail: err.message,
    });
  }

  // 2. データ充実度チェック
  try {
    const db = getDb();

    const totalEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get().cnt;
    const marathonEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND sport_type = 'marathon'").get().cnt;
    const trailEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND sport_type = 'trail'").get().cnt;
    const withPhotos = db.prepare("SELECT COUNT(DISTINCT event_id) as cnt FROM event_photos").get().cnt;
    const withReviews = db.prepare("SELECT COUNT(DISTINCT event_id) as cnt FROM reviews").get().cnt;
    const totalUsers = db.prepare("SELECT COUNT(*) as cnt FROM users").get().cnt;
    const prefectures = db.prepare("SELECT COUNT(DISTINCT prefecture) as cnt FROM events WHERE is_active = 1 AND prefecture IS NOT NULL AND prefecture != ''").get().cnt;

    results.checks.push({
      name: "イベント総数",
      category: "データ",
      status: totalEvents >= 50 ? "pass" : totalEvents >= 20 ? "warn" : "fail",
      detail: `全${totalEvents}件 (マラソン${marathonEvents} / トレイル${trailEvents})`,
    });

    results.checks.push({
      name: "都道府県カバー率",
      category: "データ",
      status: prefectures >= 30 ? "pass" : prefectures >= 15 ? "warn" : "fail",
      detail: `${prefectures}/47都道府県`,
    });

    results.checks.push({
      name: "写真付き大会",
      category: "データ",
      status: withPhotos >= 10 ? "pass" : withPhotos >= 3 ? "warn" : "fail",
      detail: `${withPhotos}件`,
    });

    results.checks.push({
      name: "口コミ付き大会",
      category: "データ",
      status: withReviews >= 10 ? "pass" : withReviews >= 3 ? "warn" : "fail",
      detail: `${withReviews}件`,
    });

    results.checks.push({
      name: "登録ユーザー",
      category: "データ",
      status: totalUsers >= 0 ? "pass" : "warn",
      detail: `${totalUsers}人`,
    });
  } catch (err) {
    results.checks.push({
      name: "データ充実度",
      category: "データ",
      status: "fail",
      detail: err.message,
    });
  }

  // 3. データ鮮度
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT MAX(scraped_at) as last_scraped FROM events WHERE scraped_at IS NOT NULL"
    ).get();
    const lastScraped = row?.last_scraped ? new Date(row.last_scraped) : null;
    const hoursSince = lastScraped
      ? Math.round((Date.now() - lastScraped.getTime()) / (1000 * 60 * 60))
      : null;

    results.checks.push({
      name: "データ鮮度",
      category: "インフラ",
      status: hoursSince !== null && hoursSince < 72 ? "pass" : "warn",
      detail: hoursSince !== null ? `最終更新: ${hoursSince}時間前` : "不明",
    });
  } catch {
    results.checks.push({
      name: "データ鮮度",
      category: "インフラ",
      status: "warn",
      detail: "確認不可",
    });
  }

  // 4. 主要ページ存在チェック（内部ルート）
  const criticalPages = [
    { path: "/", label: "トップページ" },
    { path: "/marathon", label: "マラソン一覧" },
    { path: "/calendar", label: "カレンダー" },
    { path: "/rankings", label: "ランキング" },
    { path: "/popular", label: "人気大会" },
    { path: "/trail", label: "トレイル一覧" },
    { path: "/terms", label: "利用規約" },
    { path: "/privacy", label: "プライバシーポリシー" },
  ];

  // 内部ページはサーバーサイドで存在確認が難しいため、リストとして返す
  results.checks.push({
    name: "主要ページリスト",
    category: "ページ",
    status: "info",
    detail: `${criticalPages.length}ページ要確認`,
    pages: criticalPages,
  });

  // 5. SEO設定チェック
  results.checks.push({
    name: "サイトURL設定",
    category: "SEO",
    status: siteConfig.siteUrl.startsWith("https://") ? "pass" : "warn",
    detail: siteConfig.siteUrl,
  });

  results.checks.push({
    name: "サイト名",
    category: "SEO",
    status: siteConfig.siteName === "Risk Monitor" ? "pass" : "warn",
    detail: siteConfig.siteName,
  });

  // 全体サマリー
  const passCount = results.checks.filter((c) => c.status === "pass").length;
  const warnCount = results.checks.filter((c) => c.status === "warn").length;
  const failCount = results.checks.filter((c) => c.status === "fail").length;

  results.summary = {
    total: results.checks.length,
    pass: passCount,
    warn: warnCount,
    fail: failCount,
    overall: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
  };

  return NextResponse.json(results);
}
