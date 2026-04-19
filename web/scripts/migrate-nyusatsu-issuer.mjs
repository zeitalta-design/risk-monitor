#!/usr/bin/env node
/**
 * 入札 issuer 正規化 Phase 1: schema 整備（破壊なし・冪等）。
 *
 * 追加:
 *   nyusatsu_results / nyusatsu_items に
 *     - issuer_code         TEXT   元CSVの発注機関コード相当
 *     - issuer_dept_hint    TEXT   title 先頭 【...】 から deterministic 抽出した補助値
 *     - issuer_hint_source  TEXT   hint の生成元（例: title_bracket_prefix）
 *
 *   index: (issuer_code)
 *
 * 既存 issuer_name はそのまま残す（上書きしない）。意味論的な "code → 省庁名"
 * 変換は行わない（上位コードは複数省庁混在のため誤記載になる）。
 *
 * 使い方:
 *   node scripts/migrate-nyusatsu-issuer.mjs          # Turso
 *   node scripts/migrate-nyusatsu-issuer.mjs --local  # ローカル SQLite
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
  console.error("[migrate-nyusatsu-issuer] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
console.log(`[migrate-nyusatsu-issuer] Start: local=${useLocal}`);

const STEPS = [
  // results
  `ALTER TABLE nyusatsu_results ADD COLUMN issuer_code TEXT`,
  `ALTER TABLE nyusatsu_results ADD COLUMN issuer_dept_hint TEXT`,
  `ALTER TABLE nyusatsu_results ADD COLUMN issuer_hint_source TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_issuer_code ON nyusatsu_results(issuer_code)`,

  // items
  `ALTER TABLE nyusatsu_items ADD COLUMN issuer_code TEXT`,
  `ALTER TABLE nyusatsu_items ADD COLUMN issuer_dept_hint TEXT`,
  `ALTER TABLE nyusatsu_items ADD COLUMN issuer_hint_source TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_items_issuer_code ON nyusatsu_items(issuer_code)`,
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
console.log(`[migrate-nyusatsu-issuer] Done: ok=${ok} skipped=${skipped} failed=${failed}`);
console.log("========================================");

process.exit(failed > 0 ? 1 : 0);
