#!/usr/bin/env node
/**
 * QA 層用テーブル:
 *   - qa_snapshots : 日次メトリクス（件数系）の履歴
 *   - qa_findings  : 検知された問題の履歴（severity + category）
 *
 * 使い方:
 *   node scripts/migrate-qa.mjs [--local] [--dry-run]
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
  `CREATE TABLE IF NOT EXISTS qa_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_on TEXT NOT NULL,
    metric TEXT NOT NULL,
    value INTEGER NOT NULL,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_snapshots_day_metric
     ON qa_snapshots(captured_on, metric)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_snapshots_metric
     ON qa_snapshots(metric, captured_on)`,

  `CREATE TABLE IF NOT EXISTS qa_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    captured_on TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    metric TEXT,
    message TEXT NOT NULL,
    detail TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_qa_findings_day ON qa_findings(captured_on)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_findings_severity ON qa_findings(severity, captured_on)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_findings_category ON qa_findings(category, captured_on)`,
];

async function runLocal() {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(path.resolve(process.cwd(), "data/risk-monitor.db"));
  console.log("[migrate-qa] ローカル sqlite モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60)); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60));
  }
  const n1 = db.prepare("SELECT COUNT(*) c FROM qa_snapshots").get().c;
  const n2 = db.prepare("SELECT COUNT(*) c FROM qa_findings").get().c;
  console.log(`[done] snapshots=${n1} findings=${n2}`);
  db.close();
}

async function runTurso() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("[migrate-qa] TURSO env 未設定。--local で実行してください。");
    process.exit(1);
  }
  register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  console.log("[migrate-qa] Turso モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60)); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60));
  }
  console.log("[done]");
}

if (useLocal) await runLocal();
else await runTurso();
