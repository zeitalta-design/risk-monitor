/**
 * 自動巡回ディスパッチャー
 *
 * Vercel Cronから呼び出され、cron_settingsテーブルの設定に基づいて
 * 各カテゴリの更新処理を実行する。
 *
 * POST /api/cron/auto-sync
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const db = getDb();

    // cron_settings テーブルから有効な設定を取得
    let settings = [];
    try {
      settings = db.prepare(
        "SELECT * FROM cron_settings WHERE enabled = 1"
      ).all();
    } catch {
      // テーブルが存在しない場合は空
      return NextResponse.json({ ok: true, message: "No cron_settings table", results: [] });
    }

    if (settings.length === 0) {
      return NextResponse.json({ ok: true, message: "No enabled cron settings", results: [] });
    }

    const now = new Date();
    const currentHour = now.getUTCHours() + 9; // JST変換（簡易）
    const jstHour = currentHour >= 24 ? currentHour - 24 : currentHour;

    const results = [];

    for (const setting of settings) {
      // 時間チェック（±1時間の許容範囲）
      if (Math.abs(setting.schedule_hour - jstHour) > 1) {
        results.push({ domain: setting.domain_id, status: "skipped", reason: `Not scheduled hour (${setting.schedule_hour} JST)` });
        continue;
      }

      const targets = JSON.parse(setting.targets || "[]");
      let totalItems = 0;
      let runResult = "success";

      for (const target of targets) {
        try {
          // 行政処分の特別処理
          if (target === "mlit") {
            const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";
            const res = await fetch(`${baseUrl}/api/cron/fetch-gyosei-shobun?maxPages=3`, { method: "POST" });
            const data = await res.json();
            totalItems += data.totalFetched || 0;
          } else if (target === "prefecture") {
            const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";
            const res = await fetch(`${baseUrl}/api/cron/fetch-prefecture-shobun?max=10`, { method: "POST" });
            const data = await res.json();
            totalItems += data.results?.reduce((s, r) => s + (r.items || 0), 0) || 0;
          } else {
            // 汎用ドメイン同期
            const domain = target.replace("_sync", "");
            const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";
            const res = await fetch(`${baseUrl}/api/admin/sync?domain=${domain}`, { method: "POST" });
            const data = await res.json();
            totalItems += data.totalFetched || 0;
          }
        } catch (err) {
          runResult = `error: ${err.message}`;
        }
      }

      // 実行結果を記録
      const runAt = new Date().toISOString().replace("T", " ").slice(0, 19);
      try {
        db.prepare(`
          UPDATE cron_settings SET last_run_at = ?, last_run_result = ?, last_run_items = ?, updated_at = ?
          WHERE domain_id = ?
        `).run(runAt, runResult, totalItems, runAt, setting.domain_id);
      } catch {}

      results.push({ domain: setting.domain_id, status: runResult, items: totalItems });
    }

    return NextResponse.json({ ok: true, results, executedAt: new Date().toISOString() });
  } catch (error) {
    console.error("POST /api/cron/auto-sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
