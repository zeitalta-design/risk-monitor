#!/usr/bin/env node
/**
 * entity_links テーブル + 企業横断 API 向け index を Turso へ適用するマイグレーション。
 *
 * db.js の schema 初期化は Turso ではスキップされるため、Turso 側は
 * 本スクリプトで明示的に実行する必要がある。冪等（IF NOT EXISTS）。
 *
 * 使い方:
 *   node scripts/migrate-entity-links.mjs          # Turso (要 env)
 *   node scripts/migrate-entity-links.mjs --local  # ローカルSQLite
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");

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
  console.error("[migrate-entity-links] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
console.log(`[migrate-entity-links] Start: local=${useLocal}`);

const STEPS = [
  // Phase 2 Step F: organizations の追加元トラッキング
  // （ALTER 文は skip 判定を special-case で通すので、失敗メッセージのパターンを調整）
  `ALTER TABLE organizations ADD COLUMN source TEXT`,
  // entity_links 本体
  `CREATE TABLE IF NOT EXISTS entity_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    resolved_entity_id INTEGER NOT NULL REFERENCES resolved_entities(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (organization_id, resolved_entity_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_entity_links_org ON entity_links(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entity_links_resolved ON entity_links(resolved_entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entity_links_type ON entity_links(link_type)`,
  // cross-domain JOIN の index
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_winner_corp ON nyusatsu_results(winner_corporate_number)`,
  // composite で (corp, published) を先に評価させる（single-col だと planner が
  // is_published 側の index を誤って選ぶケースがあったため）
  `CREATE INDEX IF NOT EXISTS idx_nyusatsu_results_winner_corp_pub ON nyusatsu_results(winner_corporate_number, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_sanpai_items_corp ON sanpai_items(corporate_number)`,
  `CREATE INDEX IF NOT EXISTS idx_hojokin_items_org ON hojokin_items(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_kyoninka_entities_org ON kyoninka_entities(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_kyoninka_entities_corp ON kyoninka_entities(corporate_number)`,
];

let ok = 0, skipped = 0, failed = 0;
for (const sql of STEPS) {
  const name =
    sql.match(/(TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[2] ||
    sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/)?.slice(1).join(".") ||
    "(unknown)";
  try {
    db.exec(sql);
    console.log(`  ✓ ${name}`);
    ok++;
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("already exists") || msg.includes("duplicate column")) {
      console.log(`  ⊘ ${name} (already exists)`);
      skipped++;
    } else {
      console.error(`  ✗ ${name}: ${msg}`);
      failed++;
    }
  }
}

console.log("\n========================================");
console.log(`[migrate-entity-links] Done: ok=${ok} skipped=${skipped} failed=${failed}`);
console.log("========================================");

process.exit(failed > 0 ? 1 : 0);
