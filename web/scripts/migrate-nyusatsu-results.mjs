#!/usr/bin/env node
/**
 * nyusatsu_results テーブル作成 + nyusatsu_items に蓄積列追加
 *
 * 入札ライフサイクル: 公告(active) → 締切(closed) → 落札(awarded)
 * 落札結果を別テーブルに格納し、items と紐付ける。
 * 過去データは削除せず蓄積する設計。
 *
 * 使い方:
 *   node scripts/migrate-nyusatsu-results.mjs [--local] [--dry-run]
 *
 *   --local: ローカル sqlite (data/risk-monitor.db) を直接更新
 *   (デフォルト): Turso (TURSO_DATABASE_URL) を更新
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const useLocal = process.argv.includes("--local");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIGRATIONS = [
  // ─── 1. nyusatsu_results テーブル作成 ───
  `CREATE TABLE IF NOT EXISTS nyusatsu_results (
    id INTEGER PRIMARY KEY,
    nyusatsu_item_id INTEGER,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    issuer_name TEXT,
    winner_name TEXT,
    winner_corporate_number TEXT,
    award_amount INTEGER,
    award_date TEXT,
    num_bidders INTEGER,
    award_rate REAL,
    budget_amount INTEGER,
    category TEXT,
    target_area TEXT,
    bidding_method TEXT,
    result_url TEXT,
    source_name TEXT,
    source_url TEXT,
    summary TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ─── 2. nyusatsu_results インデックス ───
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_slug ON nyusatsu_results(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_item_id ON nyusatsu_results(nyusatsu_item_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_winner ON nyusatsu_results(winner_name)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_award_date ON nyusatsu_results(award_date)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_published ON nyusatsu_results(is_published)`,

  // ─── 3. nyusatsu_items にライフサイクル列を追加 ───
  // lifecycle_status: 'active' → 'closed' → 'awarded'
  // source_name / source_url: どの省庁・自治体から取得したか
  // result_id: 紐付けた落札結果の ID
];

// ALTER TABLE は失敗する可能性がある（列が既に存在する場合）のでラップ
const ALTER_COLUMNS = [
  { col: "lifecycle_status", type: "TEXT DEFAULT 'active'" },
  { col: "result_id", type: "INTEGER" },
  { col: "source_name", type: "TEXT" },
  { col: "source_url", type: "TEXT" },
];

async function runLocal() {
  const Database = (await import("better-sqlite3")).default;
  const dbPath = path.resolve(process.cwd(), "data/risk-monitor.db");
  const db = new Database(dbPath);

  console.log("[migrate] ローカル sqlite モード");

  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 80), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }

  for (const { col, type } of ALTER_COLUMNS) {
    const sql = `ALTER TABLE nyusatsu_items ADD COLUMN ${col} ${type}`;
    try {
      if (dryRun) { console.log("[dry-run]", sql); continue; }
      db.exec(sql);
      console.log("[ok] ADD COLUMN", col);
    } catch (e) {
      if (e.message.includes("duplicate column")) {
        console.log("[skip] 既に存在:", col);
      } else {
        throw e;
      }
    }
  }

  // 既存データの lifecycle_status を設定
  if (!dryRun) {
    const updated = db.prepare(`
      UPDATE nyusatsu_items SET lifecycle_status = 'active'
      WHERE lifecycle_status IS NULL
    `).run();
    console.log(`[ok] lifecycle_status 初期値設定: ${updated.changes}件`);
  }

  const count = db.prepare("SELECT COUNT(*) c FROM nyusatsu_results").get();
  console.log(`[done] nyusatsu_results: ${count.c}件`);
  db.close();
}

async function runTurso() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("[migrate] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local で実行してください。");
    process.exit(1);
  }

  register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  console.log("[migrate] Turso モード");

  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 80), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }

  for (const { col, type } of ALTER_COLUMNS) {
    const sql = `ALTER TABLE nyusatsu_items ADD COLUMN ${col} ${type}`;
    try {
      if (dryRun) { console.log("[dry-run]", sql); continue; }
      db.exec(sql);
      console.log("[ok] ADD COLUMN", col);
    } catch (e) {
      if (String(e.message).includes("duplicate column")) {
        console.log("[skip] 既に存在:", col);
      } else {
        console.warn("[warn]", col, ":", e.message);
      }
    }
  }

  if (!dryRun) {
    db.prepare(`UPDATE nyusatsu_items SET lifecycle_status = 'active' WHERE lifecycle_status IS NULL`).run();
    console.log("[ok] lifecycle_status 初期値設定");
  }

  console.log("[done]");
}

if (useLocal) {
  await runLocal();
} else {
  await runTurso();
}
