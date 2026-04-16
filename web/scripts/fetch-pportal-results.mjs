#!/usr/bin/env node
/**
 * 調達ポータル落札実績オープンデータを取得する CLI。
 *
 * 使い方:
 *   node scripts/fetch-pportal-results.mjs [--mode all|diff] [--date YYYYMMDD] [--year YYYY] [--dry-run] [--local]
 *
 *   --mode diff (default): 日次差分（昨日分）
 *   --mode all: 全件（指定年度 or 今年度）
 *   --date 20260415: diff モードの日付指定
 *   --year 2025: all モードの年度指定
 *   --local: ローカル sqlite を使用
 *   --dry-run: DB書き込みスキップ
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const useLocal = process.argv.includes("--local");
const modeArg = process.argv.find((a, i) => process.argv[i - 1] === "--mode") || "diff";
const dateArg = process.argv.find((a, i) => process.argv[i - 1] === "--date");
const yearArg = process.argv.find((a, i) => process.argv[i - 1] === "--year");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[fetch-pportal] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local を指定するか環境変数を設定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const { fetchPPortalResults } = await import("../lib/nyusatsu-result-fetcher.js");

console.log(`[fetch-pportal] Start: mode=${modeArg} dryRun=${dryRun}`);

const result = await fetchPPortalResults({
  mode: modeArg,
  date: dateArg || undefined,
  year: yearArg ? parseInt(yearArg) : undefined,
  dryRun,
});

console.log("\n========================================");
console.log(`[fetch-pportal] Done (${result.elapsed}s)`);
console.log(`  file:     ${result.filename}`);
console.log(`  total:    ${result.totalRows}`);
console.log(`  inserted: ${result.inserted}`);
console.log(`  updated:  ${result.updated}`);
console.log(`  skipped:  ${result.skipped}`);
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 調達ポータル 落札実績取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| ファイル | ${result.filename} |`,
    `| 総行数 | ${result.totalRows} |`,
    `| 新規追加 | ${result.inserted} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要時間 | ${result.elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
