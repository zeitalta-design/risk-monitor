#!/usr/bin/env node
/**
 * Phase H Step 1.5: nyusatsu_entity_yearly_rank の再構築。
 *
 * 集計ロジック:
 *   既存 getAwardRanking({by:"entity",metric:"count"}) と同じ条件を使う。
 *   - RESOLVED_RESULTS_SQL 経由の entity 解決（winner_corporate_number OR alias）
 *   - is_published = 1（RESOLVED_RESULTS_SQL 内）
 *   - entity_id IS NOT NULL
 *   - 年度は award_date の暦年
 *   - ORDER BY count DESC, total_amount DESC → rank_by_count = 1..N
 *
 * 使い方:
 *   node scripts/rebuild-nyusatsu-entity-yearly-rank.mjs              # 全年
 *   node scripts/rebuild-nyusatsu-entity-yearly-rank.mjs --year 2025  # 単年
 *   node scripts/rebuild-nyusatsu-entity-yearly-rank.mjs --dry-run
 *   node scripts/rebuild-nyusatsu-entity-yearly-rank.mjs --local
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");
const dryRun = argv.includes("--dry-run");
const yearIdx = argv.indexOf("--year");
const onlyYear = yearIdx >= 0 ? argv[yearIdx + 1] : null;

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
  console.error("[rebuild-yearly-rank] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { RESOLVED_RESULTS_SQL } = await import("../lib/agents/analyzer/nyusatsu/resolved.js");

const db = getDb();
console.log(`[rebuild-yearly-rank] Start: local=${useLocal} dryRun=${dryRun} year=${onlyYear || "ALL"}`);

// 対象年一覧（データがある年のみ）
function listYears() {
  if (onlyYear) {
    if (!/^\d{4}$/.test(onlyYear)) { console.error("--year は YYYY 形式で指定"); process.exit(1); }
    return [onlyYear];
  }
  const rows = db.prepare(`
    SELECT DISTINCT SUBSTR(award_date, 1, 4) AS y
    FROM nyusatsu_results
    WHERE is_published = 1 AND award_date IS NOT NULL AND award_date != ''
    ORDER BY y ASC
  `).all();
  return rows.map(r => r.y).filter(y => /^\d{4}$/.test(y));
}

// 1 年分の集計 → JS で rank 付与
function buildYear(year) {
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;
  const rows = db.prepare(`
    SELECT entity_id,
           MAX(entity_name)               AS entity_name,
           COUNT(*)                       AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM (${RESOLVED_RESULTS_SQL})
    WHERE entity_id IS NOT NULL
      AND award_date >= @from AND award_date <= @to
    GROUP BY entity_id
    ORDER BY count DESC, total_amount DESC
  `).all({ from, to });

  return rows.map((r, i) => ({
    year,
    entity_id: r.entity_id,
    rank_by_count: i + 1,
    count: r.count,
    total_amount: Math.round(r.total_amount || 0),
    avg_amount: r.count > 0 ? Math.round((r.total_amount || 0) / r.count) : 0,
    entity_name_snapshot: r.entity_name || null,
  }));
}

// multi-row INSERT で batch 書き込み（Turso HTTP の round-trip を抑える）
const CHUNK = 200;
function writeYear(year, rows) {
  db.prepare(`DELETE FROM nyusatsu_entity_yearly_rank WHERE year = ?`).run(year);
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
    const params = [];
    for (const r of chunk) {
      params.push(r.year, r.entity_id, r.rank_by_count, r.count, r.total_amount, r.avg_amount, r.entity_name_snapshot);
    }
    db.prepare(`
      INSERT INTO nyusatsu_entity_yearly_rank
        (year, entity_id, rank_by_count, count, total_amount, avg_amount, entity_name_snapshot)
      VALUES ${placeholders}
    `).run(...params);
    inserted += chunk.length;
  }
  return inserted;
}

const years = listYears();
console.log(`[rebuild-yearly-rank] Target years: ${years.join(", ")}`);

let totalRows = 0;
const t0 = Date.now();
for (const y of years) {
  const ty = Date.now();
  const rows = buildYear(y);
  if (dryRun) {
    console.log(`  [dry-run] year=${y} entities=${rows.length}`);
    continue;
  }
  const n = writeYear(y, rows);
  totalRows += n;
  console.log(`  ✓ year=${y} entities=${n} (${Date.now() - ty}ms)`);
}
console.log(`[rebuild-yearly-rank] Done: years=${years.length} rows=${totalRows} elapsed=${Date.now() - t0}ms`);
