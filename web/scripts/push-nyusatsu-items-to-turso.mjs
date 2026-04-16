#!/usr/bin/env node
/**
 * ローカル sqlite の nyusatsu_items を Turso にバッチ転送する。
 *
 * push-nyusatsu-results-to-turso.mjs の items 版。
 * 既存 6省庁 fetcher の公告は既に Turso 側にあるため、デフォルトでは
 * KKJ由来（slug が "kkj-" で始まる）のみを差分転送する。
 *
 * 使い方:
 *   node scripts/push-nyusatsu-items-to-turso.mjs [--batch 200] [--dry-run]
 *                                                 [--prefix kkj-] [--limit N]
 *                                                 [--month YYYY-MM]
 *
 *   --batch N       : 1 回の batch で送る件数（default 200）
 *   --prefix STR    : slug 接頭辞で絞り込み（default "kkj-"。"" で全件）
 *   --month YYYY-MM : announcement_date の YYYY-MM 先頭一致で絞り込み
 *   --limit N       : 全体で処理する最大件数
 *   --dry-run       : DB書き込みスキップ
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 未設定");
  process.exit(1);
}

const argv = process.argv.slice(2);
const argVal = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const dryRun = argv.includes("--dry-run");
const batchSize = parseInt(argVal("batch") || "200", 10);
const prefix = argVal("prefix") ?? "kkj-"; // 明示空指定で "" (全件)
const monthArg = argVal("month");
const limitArg = argVal("limit");
const limit = limitArg ? parseInt(limitArg, 10) : null;

const local = new Database(path.resolve(process.cwd(), "data/risk-monitor.db"));
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log(`[push] batch=${batchSize} prefix="${prefix}" month=${monthArg || "all"} limit=${limit || "none"} dryRun=${dryRun}`);

// local から対象 items を取得
const where = [];
const params = [];
if (prefix) { where.push("slug LIKE ?"); params.push(`${prefix}%`); }
if (monthArg) { where.push("substr(announcement_date, 1, 7) = ?"); params.push(monthArg); }
const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
const rows = local.prepare(`SELECT * FROM nyusatsu_items ${whereSql} ORDER BY id`).all(...params);
console.log(`[push] local rows: ${rows.length}`);

// Turso の既存 slugs を取得（差分判定用）
const existingSql = prefix
  ? "SELECT slug FROM nyusatsu_items WHERE slug LIKE ?"
  : "SELECT slug FROM nyusatsu_items";
const existingArgs = prefix ? [`${prefix}%`] : [];
const existingRes = await turso.execute({ sql: existingSql, args: existingArgs });
const existingSlugs = new Set(existingRes.rows.map((r) => r.slug));
console.log(`[push] turso existing: ${existingSlugs.size}`);

let toInsert = rows.filter((r) => !existingSlugs.has(r.slug));
if (limit && toInsert.length > limit) {
  console.log(`[push] applying --limit ${limit} (trimming from ${toInsert.length})`);
  toInsert = toInsert.slice(0, limit);
}
console.log(`[push] to insert: ${toInsert.length}`);

if (toInsert.length === 0) { console.log("[push] 差分なし"); process.exit(0); }
if (dryRun) { console.log("[push] dry-run 終了"); process.exit(0); }

// nyusatsu_items の転送対象カラム
const columns = [
  "slug", "title", "category", "issuer_name", "target_area",
  "deadline", "budget_amount", "bidding_method", "summary", "status",
  "is_published",
  "qualification", "announcement_url", "contact_info", "delivery_location",
  "has_attachment", "announcement_date", "contract_period",
  "lifecycle_status", "source_name", "source_url",
];

const start = Date.now();
let done = 0;

for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  const stmts = batch.map((row) => ({
    sql: `INSERT INTO nyusatsu_items (${columns.join(",")}, created_at, updated_at) VALUES (${columns.map(() => "?").join(",")}, datetime('now'), datetime('now'))`,
    args: columns.map((c) => row[c] ?? null),
  }));

  try {
    await turso.batch(stmts, "write");
    done += batch.length;
  } catch (e) {
    console.warn(`[batch ${i}] error: ${e.message}`);
    for (const stmt of stmts) {
      try { await turso.execute(stmt); done++; } catch { /* skip */ }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const rate = (done / parseFloat(elapsed)).toFixed(0);
  if (process.stdout.isTTY) {
    process.stdout.write(`\r[push] ${done}/${toInsert.length}  (${rate} rows/s, ${elapsed}s)`);
  } else if (done % (batchSize * 10) === 0 || done === toInsert.length) {
    console.log(`[push] ${done}/${toInsert.length}  (${rate} rows/s, ${elapsed}s)`);
  }
}

console.log(`\n[done] ${done}件転送完了`);
