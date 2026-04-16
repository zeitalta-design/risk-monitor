#!/usr/bin/env node
/**
 * ローカル sqlite の nyusatsu_results を Turso にバッチ転送する。
 *
 * Turso への単発 INSERT は HTTP 往復が遅いため、batch execute を使って
 * 数百件ずつまとめて転送する。
 *
 * 使い方:
 *   node scripts/push-nyusatsu-results-to-turso.mjs [--batch 200] [--dry-run]
 *                                                   [--year YYYY] [--limit N]
 *
 *   --batch N   : 1 回の batch で送る件数（default 200）
 *   --year YYYY : 対象年度を絞る（award_date の先頭4桁と一致）
 *   --limit N   : 全体で処理する最大件数（途中で止めたいとき）
 *   --dry-run   : DB書き込みスキップ
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

const dryRun = process.argv.includes("--dry-run");
const batchSize = parseInt(
  process.argv.find((a, i) => process.argv[i - 1] === "--batch") || "200", 10,
);
const yearArg = process.argv.find((a, i) => process.argv[i - 1] === "--year");
const limitArg = process.argv.find((a, i) => process.argv[i - 1] === "--limit");
const limit = limitArg ? parseInt(limitArg, 10) : null;

const local = new Database(path.resolve(process.cwd(), "data/risk-monitor.db"));
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log(`[push] batchSize=${batchSize} year=${yearArg || "all"} limit=${limit || "none"} dryRun=${dryRun}`);

// local から対象 results を取得（year 指定時は award_date で絞り込み）
const sql = yearArg
  ? "SELECT * FROM nyusatsu_results WHERE substr(award_date, 1, 4) = ? ORDER BY id"
  : "SELECT * FROM nyusatsu_results ORDER BY id";
const rows = yearArg
  ? local.prepare(sql).all(yearArg)
  : local.prepare(sql).all();
console.log(`[push] local rows: ${rows.length}${yearArg ? ` (year=${yearArg})` : ""}`);

// Turso の既存 slugs を取得（更新対象を確定）
// year 指定時は既存も同じ年だけ取得してメモリ節約
const existingSql = yearArg
  ? "SELECT slug FROM nyusatsu_results WHERE substr(award_date, 1, 4) = ?"
  : "SELECT slug FROM nyusatsu_results";
const existingSlugsRes = yearArg
  ? await turso.execute({ sql: existingSql, args: [yearArg] })
  : await turso.execute(existingSql);
const existingSlugs = new Set(existingSlugsRes.rows.map((r) => r.slug));
console.log(`[push] turso existing: ${existingSlugs.size}`);

let toInsert = rows.filter((r) => !existingSlugs.has(r.slug));
if (limit && toInsert.length > limit) {
  console.log(`[push] applying --limit ${limit} (trimming from ${toInsert.length})`);
  toInsert = toInsert.slice(0, limit);
}
console.log(`[push] to insert: ${toInsert.length}`);

if (toInsert.length === 0) { console.log("[push] 差分なし"); process.exit(0); }
if (dryRun) { console.log("[push] dry-run 終了"); process.exit(0); }

const columns = [
  "slug", "nyusatsu_item_id", "title", "issuer_name", "winner_name",
  "winner_corporate_number", "award_amount", "award_date",
  "num_bidders", "award_rate", "budget_amount", "category",
  "target_area", "bidding_method", "result_url", "source_name",
  "source_url", "summary", "is_published",
];

const start = Date.now();
let done = 0;

for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  const stmts = batch.map((row) => ({
    sql: `INSERT INTO nyusatsu_results (${columns.join(",")}, created_at, updated_at) VALUES (${columns.map(() => "?").join(",")}, datetime('now'), datetime('now'))`,
    args: columns.map((c) => row[c] ?? null),
  }));

  try {
    await turso.batch(stmts, "write");
    done += batch.length;
  } catch (e) {
    console.warn(`[batch ${i}] error: ${e.message}`);
    // 個別投入にフォールバック
    for (const stmt of stmts) {
      try { await turso.execute(stmt); done++; } catch { /* skip */ }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const rate = (done / parseFloat(elapsed)).toFixed(0);
  // TTY の時は 1 行上書き、非 TTY（CI/bash tool キャプチャ）は batch ごとに改行
  if (process.stdout.isTTY) {
    process.stdout.write(`\r[push] ${done}/${toInsert.length}  (${rate} rows/s, ${elapsed}s)`);
  } else if (done % (batchSize * 10) === 0 || done === toInsert.length) {
    // 10 batch（2,000 件）ごとにのみ 1 行ログを出す
    console.log(`[push] ${done}/${toInsert.length}  (${rate} rows/s, ${elapsed}s)`);
  }
}

console.log(`\n[done] ${done}件転送完了`);
