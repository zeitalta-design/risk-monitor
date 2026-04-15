#!/usr/bin/env node
/**
 * sanpai_items の latest_penalty_date を notes から抽出して埋めるバックフィル。
 *
 * notes 例:
 *   "岡山県による許可取消処分 (2026(令和8)年3月16日)"
 *   "広島市による許可取消処分 (2026(令和8)年3月17日)"
 *   "令和7年12月25日 ..."
 *
 * 対象:
 *   latest_penalty_date が NULL または空のレコード。
 *
 * 使い方:
 *   node --no-warnings --experimental-vm-modules scripts/backfill-sanpai-dates.mjs [--dry-run] [--local]
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

// .env.local 読み込み
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (useLocal) {
  console.log("[backfill-sanpai-dates] ローカル sqlite モード");
  const Database = (await import("better-sqlite3")).default;
  const dbPath = path.resolve(process.cwd(), "data/risk-monitor.db");
  const db = new Database(dbPath);
  runBackfillSync(db);
  db.close();
  process.exit(0);
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[backfill-sanpai-dates] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local を指定すれば data/risk-monitor.db を更新します。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const { getDb } = await import("../lib/db.js");
const db = getDb();
await runBackfill(db);

// ─── 本体 ─────────────────────

function runBackfillSync(db) {
  const rows = db.prepare(
    "SELECT id, notes FROM sanpai_items WHERE (latest_penalty_date IS NULL OR latest_penalty_date = '') AND notes IS NOT NULL AND notes != ''"
  ).all();

  console.log(`[backfill-sanpai-dates] 対象: ${rows.length}件`);
  let updated = 0, skipped = 0;
  const update = db.prepare("UPDATE sanpai_items SET latest_penalty_date = @d, updated_at = datetime('now') WHERE id = @id");

  for (const row of rows) {
    const d = extractDateFromText(row.notes);
    if (!d) { skipped++; continue; }
    if (!dryRun) update.run({ id: row.id, d });
    updated++;
  }
  console.log(`[backfill-sanpai-dates] Done: updated=${updated} skipped=${skipped} dryRun=${dryRun}`);
}

async function runBackfill(db) {
  const rows = db.prepare(
    "SELECT id, notes FROM sanpai_items WHERE (latest_penalty_date IS NULL OR latest_penalty_date = '') AND notes IS NOT NULL AND notes != ''"
  ).all();

  console.log(`[backfill-sanpai-dates] 対象: ${rows.length}件`);
  let updated = 0, skipped = 0;
  const update = db.prepare("UPDATE sanpai_items SET latest_penalty_date = @d, updated_at = datetime('now') WHERE id = @id");

  for (const row of rows) {
    const d = extractDateFromText(row.notes);
    if (!d) { skipped++; continue; }
    if (!dryRun) update.run({ id: row.id, d });
    updated++;
  }
  console.log(`[backfill-sanpai-dates] Done: updated=${updated} skipped=${skipped} dryRun=${dryRun}`);
}

/** テキストから日付を抽出（西暦 or 令和→西暦）。YYYY-MM-DD形式で返す。 */
function extractDateFromText(text) {
  if (!text) return null;
  const s = String(text);

  // 西暦: "2026年3月16日" or "2026(令和8)年3月16日"
  let m = s.match(/(\d{4})(?:\([^)]*\))?年(\d{1,2})月(\d{1,2})日/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // 令和のみ: "令和8年3月16日"
  m = s.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  // 平成
  m = s.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 1988 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}
