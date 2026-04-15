#!/usr/bin/env node
/**
 * 産廃許可取消情報を取得する CLI（大阪府Excel + 神奈川県HTML）。
 *
 * 旧 ingest-sanpai.mjs の Python/better-sqlite3 依存を排除し、Turso対応化。
 *
 * 環境変数:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *
 * オプション:
 *   --dry-run   DB書き込みをスキップ
 *
 * 実行:
 *   npm run fetch:sanpai
 */
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

const dryRun = process.argv.includes("--dry-run");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-sanpai] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

console.log(`[fetch-sanpai] Start: dryRun=${dryRun}`);

const start = Date.now();
const { fetchAndUpsertSanpai } = await import("../lib/sanpai-fetcher.js");
const result = await fetchAndUpsertSanpai({ dryRun });
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log("\n========================================");
console.log(`[fetch-sanpai] Done (${elapsed}s)`);
console.log(`  inserted: ${result.totalInserted}`);
console.log(`  updated:  ${result.totalUpdated}`);
console.log(`  skipped:  ${result.totalSkipped}`);
for (const s of result.sources) {
  if (s.error) {
    console.log(`  ! ${s.name}: ${s.error}`);
  } else {
    console.log(`  ${s.name}: inserted=${s.inserted} updated=${s.updated} skipped=${s.skipped}`);
  }
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 産廃許可取消情報 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 新規追加 | ${result.totalInserted} |`,
    `| 更新 | ${result.totalUpdated} |`,
    `| スキップ | ${result.totalSkipped} |`,
    `| 所要時間 | ${elapsed}s |`,
    "",
    "### ソース別",
    "",
    "| ソース | inserted | updated | skipped | error |",
    "|--------|----------|---------|---------|-------|",
    ...result.sources.map((s) =>
      `| ${s.name} | ${s.inserted || 0} | ${s.updated || 0} | ${s.skipped || 0} | ${s.error || "-"} |`
    ),
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

// 全ソースが失敗した場合のみ失敗扱い
const allFailed = result.sources.every((s) => s.error);
process.exit(allFailed ? 1 : 0);
