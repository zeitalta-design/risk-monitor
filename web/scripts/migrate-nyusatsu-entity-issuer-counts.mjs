#!/usr/bin/env node
/**
 * Phase H Step 5: entity × issuer の相性スコア precomputed table migration。
 *
 * テーブル: nyusatsu_entity_issuer_counts
 *   - (entity_id, issuer_key, issuer_key_type) で UNIQUE
 *   - issuer_key_type は 'dept_hint' | 'code'（将来 'master' 等を追加可能）
 *
 * データ投入は scripts/rebuild-nyusatsu-entity-issuer-counts.mjs で別途行う。
 *
 * 使い方:
 *   node scripts/migrate-nyusatsu-entity-issuer-counts.mjs          # Turso
 *   node scripts/migrate-nyusatsu-entity-issuer-counts.mjs --local  # ローカル
 *   node scripts/migrate-nyusatsu-entity-issuer-counts.mjs --dry-run
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
  console.error("[migrate-entity-issuer-counts] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[migrate-entity-issuer-counts] Start: local=${useLocal} dryRun=${dryRun}`);

const STEPS = [
  `CREATE TABLE IF NOT EXISTS nyusatsu_entity_issuer_counts (
    entity_id         INTEGER NOT NULL,
    issuer_key        TEXT    NOT NULL,
    issuer_key_type   TEXT    NOT NULL,
    count             INTEGER NOT NULL,
    last_awarded_year TEXT,
    share_ratio       REAL,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_id, issuer_key, issuer_key_type)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_entity_issuer_counts_entity_key
     ON nyusatsu_entity_issuer_counts(entity_id, issuer_key)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_entity_issuer_counts_key_entity
     ON nyusatsu_entity_issuer_counts(issuer_key, entity_id)`,
];

let ok = 0, failed = 0;
for (const sql of STEPS) {
  const name = sql.match(/(TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[2] || "(unknown)";
  if (dryRun) { console.log(`  [dry-run] ${name}`); continue; }
  try { db.exec(sql); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}
console.log(`[migrate-entity-issuer-counts] Done: ok=${ok} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
