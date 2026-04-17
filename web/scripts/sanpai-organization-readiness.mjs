#!/usr/bin/env node
/**
 * 産廃 (sanpai_items) の organizations 接続準備状況レポート（Phase 2 Step H）
 *
 * 目的:
 *   sanpai_items へ organization_id を追加する可否と、追加した場合にどのくらい
 *   埋まるかを事前評価する。
 *
 * 調査項目:
 *   1. 現状 organization_id カラムが存在するか
 *   2. sanpai_items の総数と、corporate_number 保有率
 *   3. 保有 corp のうち organizations（現状）に一致する件数 → 即 link できる数
 *   4. 保有 corp のうち organizations に無い件数 → backfill 余地
 *   5. corp 無しの件数 → 名前一致 fallback が必要な件数
 *
 * 使い方:
 *   node scripts/sanpai-organization-readiness.mjs [--local]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const useLocal = hasFlag("local");

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
  console.error("[sanpai-readiness] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
const q = (sql, ...args) => db.prepare(sql).get(...args);

// 1) organization_id カラム存在チェック
const columns = db.prepare("PRAGMA table_info(sanpai_items)").all();
const hasOrgIdColumn = columns.some((c) => c.name === "organization_id");

// 2) 総数 + corp 保有率
const totals = q(`
  SELECT COUNT(*) total,
         SUM(CASE WHEN corporate_number IS NOT NULL AND corporate_number != '' THEN 1 ELSE 0 END) with_corp
  FROM sanpai_items
`);

// 3) corp あり & organizations に存在 → 即 link
const linkable = q(`
  SELECT COUNT(DISTINCT s.id) n
  FROM sanpai_items s
  INNER JOIN organizations o ON o.corporate_number = s.corporate_number
  WHERE s.corporate_number IS NOT NULL AND s.corporate_number != ''
`).n;

// 4) corp あり & organizations に無い → backfill 余地
const missingOrg = q(`
  SELECT COUNT(DISTINCT s.id) n
  FROM sanpai_items s
  WHERE s.corporate_number IS NOT NULL AND s.corporate_number != ''
    AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.corporate_number = s.corporate_number)
`).n;

// 5) corp 無し → 別戦略が必要な件数
const noCorp = totals.total - totals.with_corp;

// 6) 上位 unique corp（どの数まで救えるかの参考）
const uniqueCorps = q(`
  SELECT COUNT(DISTINCT corporate_number) n
  FROM sanpai_items
  WHERE corporate_number IS NOT NULL AND corporate_number != ''
`).n;

const pct = (num, den) => (den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "—");

console.log("========================================");
console.log("sanpai 連携準備レポート (Phase 2 Step H)");
console.log("========================================");
console.log(`DB: ${useLocal ? "local SQLite" : "Turso"}`);
console.log("");
console.log("【現状スキーマ】");
console.log(`  sanpai_items.organization_id カラム: ${hasOrgIdColumn ? "✓ 既に存在" : "✗ 未追加（要migration）"}`);
console.log("");
console.log("【sanpai_items 母数】");
console.log(`  total:         ${totals.total}`);
console.log(`  corp 保有:     ${totals.with_corp} (${pct(totals.with_corp, totals.total)})`);
console.log(`  unique corps:  ${uniqueCorps}`);
console.log(`  corp 無し:     ${noCorp} (${pct(noCorp, totals.total)})`);
console.log("");
console.log("【organizations への接続可否】");
console.log(`  即 link 可能（corp が orgs に存在）: ${linkable}件 / ${totals.with_corp}件 (${pct(linkable, totals.with_corp)})`);
console.log(`  要 backfill（corp あるが orgs 未登録）: ${missingOrg}件`);
console.log(`  要他手段（corp 無し）               : ${noCorp}件`);
console.log("");
console.log("【推奨アクション】");
if (!hasOrgIdColumn) {
  console.log("  1. sanpai_items.organization_id カラムを追加（ALTER TABLE）");
}
if (linkable > 0) {
  console.log(`  2. 即 link 可能な ${linkable}件を UPDATE で organization_id 埋める`);
}
if (missingOrg > 0) {
  console.log(`  3. backfill-organizations 相当を sanpai 版で用意し、${missingOrg}件を organizations に追加`);
}
if (noCorp > 0) {
  console.log(`  4. corp 無しの ${noCorp}件は本 step では対象外（名前一致 fallback は禁止ポリシー）`);
}
console.log("========================================");

process.exit(0);
