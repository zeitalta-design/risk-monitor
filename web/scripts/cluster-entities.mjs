#!/usr/bin/env node
/**
 * Resolver Step 3.5 クラスタリング CLI
 *
 * 既存の resolved_entities を prefix+類似度で cluster_id 付与する。
 * 再実行で同じ結果が出る（冪等）。
 *
 * 使い方:
 *   node scripts/cluster-entities.mjs [--local] [--prefix 4] [--sim 0.7]
 *
 *   --prefix N   前方一致 N 文字以上で同一 cluster 候補（既定 4）
 *   --sim F      Levenshtein 類似度 F 以上で同一 cluster 候補（既定 0.7）
 *   --local      ローカル sqlite を対象
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
const prefixLen = argVal("prefix") ? parseInt(argVal("prefix"), 10) : 4;
const simThreshold = argVal("sim") ? parseFloat(argVal("sim")) : 0.7;

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
  console.error("[cluster-entities] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { assignClusters } = await import("../lib/agents/resolver/index.js");

const db = getDb();
console.log(`[cluster-entities] Start: local=${useLocal} prefix=${prefixLen} sim=${simThreshold}`);
const start = Date.now();

const r = assignClusters({ db, prefixLen, simThreshold });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// 代表的なクラスタを表示
const top = db.prepare(`
  SELECT c.id, c.canonical_name, c.signal, c.size, GROUP_CONCAT(e.canonical_name, '｜') AS members
  FROM entity_clusters c
  LEFT JOIN resolved_entities e ON e.cluster_id = c.id
  GROUP BY c.id
  ORDER BY c.size DESC
  LIMIT 10
`).all();

console.log("\n========================================");
console.log(`[cluster-entities] Done (${elapsed}s)`);
console.log(`  entities:       ${r.entities}`);
console.log(`  clusters:       ${r.clusters}`);
console.log(`  assigned:       ${r.assigned}`);
console.log(`  singletons:     ${r.singletons}`);
console.log(`  largestCluster: ${r.largestCluster}`);
console.log("========================================");
if (top.length > 0) {
  console.log("\n上位クラスタ:");
  for (const c of top) {
    const m = (c.members || "").split("｜").slice(0, 6).join(" / ");
    console.log(`  #${c.id} ${c.canonical_name} (size=${c.size}, ${c.signal}): ${m}${c.size > 6 ? " ..." : ""}`);
  }
}
