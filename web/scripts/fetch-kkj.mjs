#!/usr/bin/env node
/**
 * 官公需情報ポータル（KKJ）入札公告の取得 CLI。
 *
 * 使い方:
 *   node scripts/fetch-kkj.mjs [--mode daily|range] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                              [--lg 13,14,23] [--dry-run] [--local]
 *
 *   --mode daily (default): 昨日〜今日の 2 日間分（全47都道府県）
 *   --mode range:           --from / --to で指定した期間
 *   --from 2026-04-01:      range モードの開始日
 *   --to   2026-04-15:      range モードの終了日（省略時は from と同日）
 *   --lg   13,14,23:        都道府県コード絞り込み（省略時は全47）
 *   --local:                ローカル sqlite (data/risk-monitor.db) を更新
 *   --dry-run:              DB 書き込みスキップ
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

const mode = argVal("mode") || "daily";
const fromDate = argVal("from");
const toDate = argVal("to");
const lgArg = argVal("lg");
const lgCodes = lgArg ? lgArg.split(",").map((s) => s.trim()) : undefined;
const dryRun = hasFlag("dry-run");
const useLocal = hasFlag("local");

// .env.local をロード
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
  console.error("[fetch-kkj] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local を指定するか環境変数を設定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

// 新パイプライン経由: runKkjPipeline が内部で日付×LG反復 + fetchKkjSlice + processKkjRecords を実行
const { runKkjPipeline } = await import("../lib/agents/pipeline/nyusatsu.js");

console.log(`[fetch-kkj] Start: mode=${mode} dryRun=${dryRun} local=${useLocal}`);

const result = await runKkjPipeline({
  mode,
  fromDate: fromDate || undefined,
  toDate: toDate || undefined,
  lgCodes,
  dryRun,
});

console.log("\n========================================");
console.log(`[fetch-kkj] Done (${result.elapsed}s)`);
console.log(`  range:     ${result.dateRange}`);
console.log(`  fetched:   ${result.totalFetched}`);
console.log(`  inserted:  ${result.inserted}`);
console.log(`  updated:   ${result.updated}`);
console.log(`  skipped:   ${result.skipped}`);
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 官公需情報ポータル（KKJ）入札公告取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| モード | ${result.mode} |`,
    `| 対象期間 | ${result.dateRange} |`,
    `| 取得件数 | ${result.totalFetched} |`,
    `| 新規追加 | ${result.inserted} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要時間 | ${result.elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
