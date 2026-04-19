#!/usr/bin/env node
/**
 * watch_notifications テーブル + 関連 index を Turso へ適用するマイグレーション。
 *
 * db.js の schema 初期化は Turso ではスキップされるため、Turso 側は
 * 本スクリプトで明示的に実行する必要がある。冪等（IF NOT EXISTS）。
 *
 * 目的:
 *   - 通知機能 v1（gyosei-shobun / nyusatsu の watched 更新検知）の永続化基盤
 *   - (user_id, type, source_slug, event_date) の複合 UNIQUE で冪等 INSERT
 *
 * 命名:
 *   既存 `notifications`（汎用 user_key ベース、sports-event 系で使用中）とは
 *   分離するため `watch_notifications` とした。
 *
 * 使い方:
 *   node scripts/migrate-notifications.mjs          # Turso (要 env)
 *   node scripts/migrate-notifications.mjs --local  # ローカル SQLite
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (useLocal) {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
}
if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[migrate-notifications] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
console.log(`[migrate-notifications] Start: local=${useLocal}`);

const STEPS = [
  // watched_organizations へ cursor 列追加（冪等）
  //
  //   既存 email digest (lib/watchlist-notification-service.js) が
  //   last_notified_action_date を cursor として使っているため、in-app cron が
  //   同じ列を更新すると email digest が記録をスキップしてしまう。
  //   二系統を独立させるため、in-app 専用の cursor 列を分離する:
  //     - last_inapp_notified_action_date : gyosei-shobun in-app cron が更新
  //     - last_notified_award_date        : nyusatsu in-app cron が更新
  //       （nyusatsu 側は既存 email digest なし、新設）
  `ALTER TABLE watched_organizations ADD COLUMN last_notified_award_date TEXT`,
  `ALTER TABLE watched_organizations ADD COLUMN last_inapp_notified_action_date TEXT`,

  // watch_notifications 本体
  `CREATE TABLE IF NOT EXISTS watch_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    source_slug TEXT NOT NULL,
    event_date TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    UNIQUE (user_id, type, source_slug, event_date)
  )`,

  // 未読取得: WHERE user_id = ? AND read_at IS NULL
  `CREATE INDEX IF NOT EXISTS idx_watch_notifications_user_unread ON watch_notifications(user_id, read_at)`,
  // 時系列取得: WHERE user_id = ? ORDER BY created_at DESC
  `CREATE INDEX IF NOT EXISTS idx_watch_notifications_user_created ON watch_notifications(user_id, created_at DESC)`,

  // ─── Phase J-7: watch ごとの Deal Score 通知 threshold ───────────
  //   DEFAULT 80 で新規行は自動的に 80 になる。SQLite は ADD COLUMN DEFAULT
  //   で既存行に対しても該当値を返すため backfill UPDATE も併せて行う（NULL
  //   対策）。範囲 0..100 はアプリ層でバリデート。
  `ALTER TABLE watched_organizations ADD COLUMN deal_score_threshold INTEGER DEFAULT 80`,
  `UPDATE watched_organizations SET deal_score_threshold = 80 WHERE deal_score_threshold IS NULL`,

  // ─── Phase J-8: watch ごとの通知頻度（realtime / daily / off） ───
  //   realtime: 即時通知（既存挙動）
  //   daily:    日次まとめ cron のみ拾う
  //   off:      通知しない
  //   値の妥当性チェックはアプリ層。既存行は realtime にbackfill。
  `ALTER TABLE watched_organizations ADD COLUMN notify_frequency TEXT DEFAULT 'realtime'`,
  `UPDATE watched_organizations SET notify_frequency = 'realtime' WHERE notify_frequency IS NULL`,

  // ─── Phase J-9: 通知行にも frequency を残して UI で「今日のまとめ」を区別 ───
  //   realtime / daily のどちらの cron で insert されたかを保持する。
  //   dedupe キー (user_id, type, source_slug, event_date) は変えないので
  //   既存 UNIQUE 挙動は維持。既存行は realtime に backfill。
  `ALTER TABLE watch_notifications ADD COLUMN frequency TEXT DEFAULT 'realtime'`,
  `UPDATE watch_notifications SET frequency = 'realtime' WHERE frequency IS NULL`,

  // ─── Phase J-14: 有望案件のピン留め / 保存テーブル ───────────────
  //   1 user × 1 deal_slug の小さな結合テーブル。
  //   UNIQUE(user_id, deal_slug) で二重保存を防ぐ。
  `CREATE TABLE IF NOT EXISTS saved_deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    deal_slug TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, deal_slug)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_saved_deals_user_created ON saved_deals(user_id, created_at DESC)`,

  // ─── Phase J-16: 保存案件の status 変化通知用に「前回見た status」を保持 ───
  //   初回保存時に snapshot、cron で現在 status と不一致なら通知 + 更新。
  //   既存行は NULL 許容。cron 初回実行の backfill で埋める（通知はしない）。
  `ALTER TABLE saved_deals ADD COLUMN last_seen_status TEXT`,

  // ─── Phase J-17: 保存案件の軽量 pin（優先表示フラグ） ───────────
  //   0/1 の INTEGER。既存行は DEFAULT 0 で非 pin。
  //   並び順 (is_pinned DESC, created_at DESC) に合わせた複合 index も追加。
  `ALTER TABLE saved_deals ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_saved_deals_user_pinned_created ON saved_deals(user_id, is_pinned DESC, created_at DESC)`,
];

let ok = 0, skipped = 0, failed = 0;
for (const sql of STEPS) {
  const name =
    sql.match(/(TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[2] ||
    sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/)?.slice(1).join(".") ||
    "(unknown)";
  try {
    db.exec(sql);
    console.log(`  ✓ ${name}`);
    ok++;
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("already exists") || msg.includes("duplicate column")) {
      console.log(`  ⊘ ${name} (already exists)`);
      skipped++;
    } else {
      console.error(`  ✗ ${name}: ${msg}`);
      failed++;
    }
  }
}

console.log("\n========================================");
console.log(`[migrate-notifications] Done: ok=${ok} skipped=${skipped} failed=${failed}`);
console.log("========================================");

process.exit(failed > 0 ? 1 : 0);
