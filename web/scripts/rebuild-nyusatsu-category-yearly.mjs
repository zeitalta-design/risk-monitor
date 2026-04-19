#!/usr/bin/env node
/**
 * Phase H Step 4.5: nyusatsu_category_yearly の再構築。
 *
 * 集計ロジック:
 *   既存 yearly-stats / category-year / band-year / category-score と同条件。
 *   - is_published = 1
 *   - award_date IS NOT NULL AND award_date != ''
 *   - year = SUBSTR(award_date, 1, 4)（暦年）
 *   - category = COALESCE(NULLIF(TRIM(category), ''), '未分類')
 *   - count = COUNT(*)
 *   - total_amount = ROUND(SUM(award_amount))
 *   - premium_count = SUM(CASE WHEN award_amount > 50000000 THEN 1 ELSE 0 END)
 *     （Step 1 amount-bands の「5000万〜1億円」+「1億円以上」と同じ境界）
 *
 * 使い方:
 *   node scripts/rebuild-nyusatsu-category-yearly.mjs              # 全年
 *   node scripts/rebuild-nyusatsu-category-yearly.mjs --year 2025  # 単年
 *   node scripts/rebuild-nyusatsu-category-yearly.mjs --dry-run
 *   node scripts/rebuild-nyusatsu-category-yearly.mjs --local
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");
const dryRun   = argv.includes("--dry-run");
const yearIdx  = argv.indexOf("--year");
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
  console.error("[rebuild-category-yearly] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[rebuild-category-yearly] Start: local=${useLocal} dryRun=${dryRun} year=${onlyYear || "ALL"}`);

const UNCATEGORIZED = "未分類";
const PREMIUM_THRESHOLD = 50_000_000;

function fetchAllAggregates() {
  // 1 クエリで全年 × 全カテゴリを集計。Turso HTTP の round-trip を最小化。
  const where = [
    "is_published = 1",
    "award_date IS NOT NULL",
    "award_date != ''",
  ];
  const params = { uncat: UNCATEGORIZED, premium: PREMIUM_THRESHOLD };
  if (onlyYear) {
    if (!/^\d{4}$/.test(onlyYear)) {
      console.error("--year は YYYY 形式で指定");
      process.exit(1);
    }
    where.push("award_date >= @from AND award_date <= @to");
    params.from = `${onlyYear}-01-01`;
    params.to   = `${onlyYear}-12-31`;
  }
  return db.prepare(`
    SELECT
      SUBSTR(award_date, 1, 4)                              AS year,
      COALESCE(NULLIF(TRIM(category), ''), @uncat)          AS category,
      COUNT(*)                                              AS count,
      COALESCE(SUM(award_amount), 0)                        AS total_amount,
      SUM(CASE WHEN award_amount > @premium THEN 1 ELSE 0 END) AS premium_count
    FROM nyusatsu_results
    WHERE ${where.join(" AND ")}
    GROUP BY year, category
    ORDER BY year ASC, count DESC
  `).all(params);
}

const CHUNK = 200;

function writeForYears(rowsByYear) {
  let totalWritten = 0;
  for (const [year, rows] of rowsByYear.entries()) {
    if (dryRun) {
      console.log(`  [dry-run] year=${year} categories=${rows.length}`);
      continue;
    }
    db.prepare(`DELETE FROM nyusatsu_category_yearly WHERE year = ?`).run(year);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(",");
      const params = [];
      for (const r of chunk) {
        params.push(
          r.year,
          r.category,
          r.count,
          Math.round(r.total_amount || 0),
          r.premium_count || 0,
        );
      }
      db.prepare(`
        INSERT INTO nyusatsu_category_yearly
          (year, category, count, total_amount, premium_count)
        VALUES ${placeholders}
      `).run(...params);
    }
    totalWritten += rows.length;
    console.log(`  ✓ year=${year} categories=${rows.length}`);
  }
  return totalWritten;
}

const t0 = Date.now();
const raw = fetchAllAggregates();
const byYear = new Map();
for (const r of raw) {
  if (!/^\d{4}$/.test(r.year)) continue; // 念のため
  if (!byYear.has(r.year)) byYear.set(r.year, []);
  byYear.get(r.year).push(r);
}
const years = [...byYear.keys()].sort();
console.log(`[rebuild-category-yearly] Fetched: ${raw.length} rows across ${years.length} years (${Date.now() - t0}ms)`);
console.log(`[rebuild-category-yearly] Target years: ${years.join(", ")}`);

const totalRows = writeForYears(byYear);
console.log(`[rebuild-category-yearly] Done: years=${years.length} rows=${totalRows} elapsed=${Date.now() - t0}ms`);
