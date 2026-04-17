#!/usr/bin/env node
/**
 * nyusatsu_results.winner_corporate_number を起点に organizations を育てる（Phase 2 Step F）
 *
 * 目的:
 *   organizations と resolved_entities が現状で corporate_number を共有しておらず、
 *   entity_links bridge が 0 件しか作れない。organizations 側の母数を増やすため、
 *   落札実績に現れた法人番号を organizations に upsert する。
 *
 * ポリシー:
 *   - 新規のみ insert（既存 organization は触らない — 既存データを壊さない）
 *   - display_name / normalized_name は winner_name（最新 award_date の1件）を採用
 *   - source = "nyusatsu_backfill"
 *   - fuzzy / LLM は使わない（corporate_number 完全一致のみ）
 *
 * 使い方:
 *   node scripts/backfill-organizations-from-nyusatsu.mjs [--local] [--dry-run] [--limit N]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const argVal = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const useLocal = hasFlag("local");
const dryRun = hasFlag("dry-run") || hasFlag("dryrun");
const limit = argVal("limit") ? parseInt(argVal("limit"), 10) : null;
const BATCH_SIZE = parseInt(argVal("batch") || "100", 10);

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
  console.error("[backfill-orgs] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { normalizeEntityName } = await import("../lib/kyoninka-config.js");

const db = getDb();
const start = Date.now();
const SOURCE = "nyusatsu_backfill";

console.log(`[backfill-orgs] Start: local=${useLocal} dryRun=${dryRun} limit=${limit ?? "—"} batch=${BATCH_SIZE}`);

// 1) nyusatsu_results から winner_corporate_number 単位で 1 行に畳み込む
const candidates = db.prepare(`
  SELECT winner_corporate_number AS corp,
         MIN(winner_name)         AS name
  FROM nyusatsu_results
  WHERE winner_corporate_number IS NOT NULL
    AND winner_corporate_number != ''
    AND winner_name IS NOT NULL
    AND winner_name != ''
    AND is_published = 1
  GROUP BY winner_corporate_number
`).all();

console.log(`[backfill-orgs] 候補法人番号: ${candidates.length}件`);

// 2) 既存 organizations の corporate_number を一括取得
const existing = new Set(
  db.prepare("SELECT corporate_number FROM organizations WHERE corporate_number IS NOT NULL AND corporate_number != ''")
    .all()
    .map((r) => r.corporate_number),
);
console.log(`[backfill-orgs] organizations 既存 corp: ${existing.size}件`);

const toInsert = candidates.filter((c) => !existing.has(c.corp));
console.log(`[backfill-orgs] 未登録 corp: ${toInsert.length}件`);
const targets = limit ? toInsert.slice(0, limit) : toInsert;

if (dryRun) {
  console.log("[backfill-orgs] dry-run: 書込みスキップ");
  for (const c of targets.slice(0, 5)) {
    console.log(`   - ${c.corp}: ${c.name}`);
  }
  process.exit(0);
}

// 3) 多行 VALUES で batch insert（Turso の round-trip を削減）
// 例: INSERT INTO organizations (...) VALUES (?, ?, ...), (?, ?, ...), ...
//     失敗（UNIQUE 競合）時は batch 単位で retry を1行ずつに切り替える

function runBatch(rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  const placeholders = rows.map(() => "(?, ?, ?, 'company', 1, datetime('now'), datetime('now'), ?)").join(", ");
  const sql = `
    INSERT INTO organizations
      (normalized_name, display_name, corporate_number, entity_type, is_active, created_at, updated_at, source)
    VALUES ${placeholders}
  `;
  const params = [];
  for (const r of rows) {
    const normalized = normalizeEntityName(r.name) || r.name;
    params.push(normalized, r.name, r.corp, SOURCE);
  }
  try {
    db.prepare(sql).run(...params);
    return { inserted: rows.length, skipped: 0 };
  } catch (e) {
    // UNIQUE 競合を含む可能性 → 1行ずつ再実行
    let inserted = 0, skipped = 0;
    const one = db.prepare(`
      INSERT INTO organizations (normalized_name, display_name, corporate_number, entity_type, is_active, created_at, updated_at, source)
      VALUES (?, ?, ?, 'company', 1, datetime('now'), datetime('now'), ?)
    `);
    for (const r of rows) {
      try {
        const normalized = normalizeEntityName(r.name) || r.name;
        one.run(normalized, r.name, r.corp, SOURCE);
        inserted++;
      } catch {
        skipped++;
      }
    }
    return { inserted, skipped };
  }
}

let inserted = 0, skipped = 0;
for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE);
  const r = runBatch(batch);
  inserted += r.inserted;
  skipped += r.skipped;
  if ((i + BATCH_SIZE) % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= targets.length) {
    const pct = ((i + batch.length) / targets.length * 100).toFixed(1);
    console.log(`  [${i + batch.length}/${targets.length}] inserted=${inserted} skipped=${skipped} (${pct}%)`);
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[backfill-orgs] Done (${elapsed}s)`);
console.log(`  candidates:      ${candidates.length}`);
console.log(`  already existed: ${existing.size}`);
console.log(`  targets:         ${targets.length}`);
console.log(`  inserted:        ${inserted}`);
console.log(`  skipped:         ${skipped}`);
console.log(`  source:          ${SOURCE}`);
console.log("========================================");

process.exit(0);
