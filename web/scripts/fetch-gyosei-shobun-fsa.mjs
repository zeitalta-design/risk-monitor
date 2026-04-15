#!/usr/bin/env node
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const c = fs.readFileSync(envLocalPath, "utf8");
  for (const line of c.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;
const dryRun = args.includes("--dry-run");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-fsa] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-fsa] Start: limit=${limit || "all"} dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertFsaJirei } = await import("../lib/gyosei-shobun-fsa-fetcher.js");
const result = await fetchAndUpsertFsaJirei({ limit, dryRun });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-fsa] Done (${elapsed}s)`);
console.log(`  processed: ${result.processed}`);
console.log(`  created:   ${result.created}`);
console.log(`  updated:   ${result.updated}`);
console.log(`  skipped:   ${result.skipped}`);
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 金融庁 行政処分事例集 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 処理件数 | ${result.processed} |`,
    `| 新規追加 | ${result.created} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要時間 | ${elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
