#!/usr/bin/env node
/**
 * 指定管理者（shitei）パイロット取得 CLI。
 *
 * パイロット対象:
 *   - 東京都 生活文化スポーツ局（文化施設）
 *   - 東京都 建設局（都立公園）
 *
 * 環境変数: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 * オプション: --dry-run
 *
 * 実行: npm run fetch:shitei
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
  console.error("[fetch-shitei] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

console.log(`[fetch-shitei] Start (pilot): dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertShitei } = await import("../lib/shitei-fetcher.js");
const result = await fetchAndUpsertShitei({ dryRun });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-shitei] Done (${elapsed}s)`);
console.log(`  inserted: ${result.totalInserted}`);
console.log(`  updated:  ${result.totalUpdated}`);
console.log(`  skipped:  ${result.totalSkipped}`);
for (const s of result.sources) {
  if (s.error) {
    console.log(`  ! ${s.name} (${s.label}): ${s.error}`);
  } else {
    console.log(`  ${s.name} (${s.label}): inserted=${s.inserted} updated=${s.updated} skipped=${s.skipped}`);
  }
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 指定管理者（パイロット）取得結果",
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
    "| ソース | ラベル | inserted | updated | skipped | error |",
    "|--------|--------|----------|---------|---------|-------|",
    ...result.sources.map((s) =>
      `| ${s.name} | ${s.label} | ${s.inserted || 0} | ${s.updated || 0} | ${s.skipped || 0} | ${s.error || "-"} |`
    ),
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

const allFailed = result.sources.every((s) => s.error);
process.exit(allFailed ? 1 : 0);
