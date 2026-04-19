#!/usr/bin/env node
/**
 * Phase H Step 4.5: nyusatsu_category_yearly の schema migration。
 *
 * 背景: deal-score API は market-score + category-score の全表集計を毎リクエスト
 *   走らせており 55〜85 秒かかる。(year, category) の事前計算テーブルを用意し、
 *   市場スコアと業種スコアを両方ここから引けるようにする。
 *
 * データ投入は scripts/rebuild-nyusatsu-category-yearly.mjs で別途行う。
 *
 * 使い方:
 *   node scripts/migrate-nyusatsu-category-yearly.mjs          # Turso
 *   node scripts/migrate-nyusatsu-category-yearly.mjs --local  # ローカル
 *   node scripts/migrate-nyusatsu-category-yearly.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");
const dryRun   = argv.includes("--dry-run");

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
  console.error("[migrate-category-yearly] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[migrate-category-yearly] Start: local=${useLocal} dryRun=${dryRun}`);

const STEPS = [
  `CREATE TABLE IF NOT EXISTS nyusatsu_category_yearly (
    year          TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    count         INTEGER NOT NULL,
    total_amount  INTEGER NOT NULL DEFAULT 0,
    premium_count INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(year, category)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_category_yearly_year_category
     ON nyusatsu_category_yearly(year, category)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_category_yearly_category_year
     ON nyusatsu_category_yearly(category, year)`,
];

let ok = 0, failed = 0;
for (const sql of STEPS) {
  const name = sql.match(/(TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[2] || "(unknown)";
  if (dryRun) { console.log(`  [dry-run] ${name}`); continue; }
  try { db.exec(sql); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}
console.log(`[migrate-category-yearly] Done: ok=${ok} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
