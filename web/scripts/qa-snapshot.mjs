#!/usr/bin/env node
/**
 * QA 日次 snapshot + 全チェック実行 CLI
 *
 * 使い方:
 *   node scripts/qa-snapshot.mjs [--local] [--day YYYY-MM-DD]
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
const dayArg = argVal("day");

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
  console.error("[qa-snapshot] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { runAllChecks, todayJst } = await import("../lib/agents/qa/index.js");
const analyzer = await import("../lib/agents/analyzer/nyusatsu/index.js");

const db = getDb();
const day = dayArg || todayJst();
console.log(`[qa-snapshot] Start: local=${useLocal} day=${day}`);
const start = Date.now();

const r = await runAllChecks({ db, analyzer, day });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[qa-snapshot] Done (${elapsed}s)  day=${r.day}`);
console.log(`  snapshots:  ${r.snapshots}`);
console.log(`  capacity:   ${r.capacity.length}`);
console.log(`  freshness:  ${r.freshness.length}`);
console.log(`  delta:      ${r.delta.length}`);
console.log(`  resolver:   ${r.resolverGrowth.length}`);
console.log(`  api-health: ${r.apiHealth.length}`);

const bySev = r.findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {});
console.log(`  findings:   total=${r.findings.length} (${Object.entries(bySev).map(([k, v]) => `${k}:${v}`).join(", ") || "-"})`);
console.log("========================================");

if (r.findings.length > 0) {
  console.log("\n当日の finding:");
  for (const f of r.findings) {
    const mark = f.severity === "critical" ? "🔴" : f.severity === "warn" ? "🟡" : "🟢";
    console.log(`  ${mark} [${f.category}] ${f.metric || "-"}: ${f.message}`);
  }
}

// critical があれば exit 1（GitHub Actions の失敗通知用）
const hasCritical = r.findings.some((f) => f.severity === "critical");
process.exit(hasCritical ? 1 : 0);
