#!/usr/bin/env node
/**
 * Resolver Step 3.5 クラスタリング用マイグレーション
 *   - entity_clusters テーブル新設
 *   - resolved_entities に cluster_id 列追加
 *
 * 使い方:
 *   node scripts/migrate-clusters.mjs [--local] [--dry-run]
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
  `CREATE TABLE IF NOT EXISTS entity_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name TEXT,
    representative_entity_id INTEGER,
    signal TEXT,
    size INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_clusters_repr ON entity_clusters(representative_entity_id)`,
];

const ALTER_COLUMNS = [
  { col: "cluster_id", type: "INTEGER" },
];

async function runLocal() {
  const Database = (await import("better-sqlite3")).default;
  const dbPath = path.resolve(process.cwd(), "data/risk-monitor.db");
  const db = new Database(dbPath);
  console.log("[migrate-clusters] ローカル sqlite モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }
  for (const { col, type } of ALTER_COLUMNS) {
    const sql = `ALTER TABLE resolved_entities ADD COLUMN ${col} ${type}`;
    try {
      if (dryRun) { console.log("[dry-run]", sql); continue; }
      db.exec(sql);
      console.log("[ok] ADD COLUMN", col);
    } catch (e) {
      if (String(e.message).includes("duplicate column")) {
        console.log("[skip] 既に存在:", col);
      } else throw e;
    }
  }
  if (!dryRun) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_entities_cluster ON resolved_entities(cluster_id)");
    console.log("[ok] idx_entities_cluster");
  }
  const n = db.prepare("SELECT COUNT(*) c FROM entity_clusters").get().c;
  console.log(`[done] entity_clusters=${n}`);
  db.close();
}

async function runTurso() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("[migrate-clusters] TURSO env 未設定。--local を指定してください。");
    process.exit(1);
  }
  register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  console.log("[migrate-clusters] Turso モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }
  for (const { col, type } of ALTER_COLUMNS) {
    const sql = `ALTER TABLE resolved_entities ADD COLUMN ${col} ${type}`;
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
    db.exec("CREATE INDEX IF NOT EXISTS idx_entities_cluster ON resolved_entities(cluster_id)");
    console.log("[ok] idx_entities_cluster");
  }
  console.log("[done]");
}

if (useLocal) await runLocal();
else await runTurso();
