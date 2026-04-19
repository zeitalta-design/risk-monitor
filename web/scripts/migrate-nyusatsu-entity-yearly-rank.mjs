#!/usr/bin/env node
/**
 * Phase H Step 1.5: entity ranking の事前計算テーブルを作成する migration。
 *
 * 背景:
 *   - fetchRankingDiff / entity score は 2 年分の全表集計をリクエストのたびに回しており
 *     冷 cache 時 12〜20 秒かかる。
 *   - 年次 entity ranking を事前に固めておけば、diff 計算は「両年の precomputed 行を
 *     取って JS で比較するだけ」になり、桁違いに速くなる。
 *
 * このマイグレーションは schema 作成のみ（冪等）。データ投入は
 *   scripts/rebuild-nyusatsu-entity-yearly-rank.mjs
 * で行う。
 *
 * 使い方:
 *   node scripts/migrate-nyusatsu-entity-yearly-rank.mjs          # Turso
 *   node scripts/migrate-nyusatsu-entity-yearly-rank.mjs --local  # ローカル SQLite
 *   node scripts/migrate-nyusatsu-entity-yearly-rank.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");
const dryRun = argv.includes("--dry-run");

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
  console.error("[migrate-yearly-rank] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[migrate-yearly-rank] Start: local=${useLocal} dryRun=${dryRun}`);

const STEPS = [
  `CREATE TABLE IF NOT EXISTS nyusatsu_entity_yearly_rank (
    year                 TEXT    NOT NULL,
    entity_id            INTEGER NOT NULL,
    rank_by_count        INTEGER NOT NULL,
    count                INTEGER NOT NULL,
    total_amount         INTEGER NOT NULL DEFAULT 0,
    avg_amount           INTEGER NOT NULL DEFAULT 0,
    entity_name_snapshot TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(year, entity_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_entity_yearly_rank_year_rank
     ON nyusatsu_entity_yearly_rank(year, rank_by_count)`,
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_entity_yearly_rank_entity_year
     ON nyusatsu_entity_yearly_rank(entity_id, year)`,
];

let ok = 0, failed = 0;
for (const sql of STEPS) {
  const name = sql.match(/(TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[2] || "(unknown)";
  if (dryRun) {
    console.log(`  [dry-run] ${name}`);
    continue;
  }
  try {
    db.exec(sql);
    console.log(`  ✓ ${name}`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}
console.log(`[migrate-yearly-rank] Done: ok=${ok} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
