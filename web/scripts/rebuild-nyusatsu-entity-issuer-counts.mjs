#!/usr/bin/env node
/**
 * Phase H Step 5: nyusatsu_entity_issuer_counts の再構築。
 *
 * ロジック:
 *   1. 各 resolved row（RESOLVED_RESULTS_SQL 相当）から issuer_key / issuer_key_type を決定
 *      - issuer_dept_hint があればそれを使う（type='dept_hint'）
 *      - なければ issuer_code を使う（type='code'）
 *      - どちらも無ければ除外（fuzzy / 推定は一切しない）
 *   2. JS 側で (entity_id, issuer_key, issuer_key_type) 単位に集計
 *      - count = 件数
 *      - last_awarded_year = MAX(SUBSTR(award_date,1,4))
 *   3. entity 全体の count から share_ratio = count / entity_total を算出
 *   4. 年別 DELETE ではなく全量置換（idempotent）
 *
 * 使い方:
 *   node scripts/rebuild-nyusatsu-entity-issuer-counts.mjs          # 全再構築
 *   node scripts/rebuild-nyusatsu-entity-issuer-counts.mjs --dry-run
 *   node scripts/rebuild-nyusatsu-entity-issuer-counts.mjs --local
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const useLocal = argv.includes("--local");
const dryRun   = argv.includes("--dry-run");

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
  console.error("[rebuild-entity-issuer-counts] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[rebuild-entity-issuer-counts] Start: local=${useLocal} dryRun=${dryRun}`);

const t0 = Date.now();

// 1 本の大きい SELECT で resolved entity_id + issuer_key + year を取得。
// RESOLVED_RESULTS_SQL 相当の JOIN を inline で書く（issuer_dept_hint / issuer_code は
// 既存 helper に含まれないため）。fuzzy / LIKE / LLM は使わない。
const rows = db.prepare(`
  SELECT
    entity_id,
    issuer_key,
    issuer_key_type,
    year
  FROM (
    SELECT
      COALESCE(e_by_corp.id, e_by_alias.id) AS entity_id,
      CASE
        WHEN r.issuer_dept_hint IS NOT NULL AND TRIM(r.issuer_dept_hint) != ''
          THEN TRIM(r.issuer_dept_hint)
        WHEN r.issuer_code IS NOT NULL AND TRIM(r.issuer_code) != ''
          THEN TRIM(r.issuer_code)
        ELSE NULL
      END AS issuer_key,
      CASE
        WHEN r.issuer_dept_hint IS NOT NULL AND TRIM(r.issuer_dept_hint) != ''
          THEN 'dept_hint'
        WHEN r.issuer_code IS NOT NULL AND TRIM(r.issuer_code) != ''
          THEN 'code'
        ELSE NULL
      END AS issuer_key_type,
      SUBSTR(r.award_date, 1, 4) AS year
    FROM nyusatsu_results r
    LEFT JOIN resolved_entities e_by_corp
      ON r.winner_corporate_number IS NOT NULL AND r.winner_corporate_number != ''
     AND e_by_corp.corporate_number = r.winner_corporate_number
    LEFT JOIN resolution_aliases a
      ON e_by_corp.id IS NULL AND a.raw_name = r.winner_name
    LEFT JOIN resolved_entities e_by_alias
      ON e_by_corp.id IS NULL AND e_by_alias.id = a.entity_id
    WHERE r.is_published = 1
      AND r.winner_name IS NOT NULL AND r.winner_name != ''
      AND r.award_date IS NOT NULL AND r.award_date != ''
  ) x
  WHERE entity_id IS NOT NULL AND issuer_key IS NOT NULL
`).all();

console.log(`[rebuild-entity-issuer-counts] Fetched: ${rows.length} resolved rows (${Date.now() - t0}ms)`);

// (entity_id, issuer_key, issuer_key_type) で畳み込み
const groups = new Map();              // key = `${entity_id}|${issuer_key}|${type}`
const entityTotal = new Map();         // entity_id → total_count（全 issuer 合計）
for (const r of rows) {
  const key = `${r.entity_id}|${r.issuer_key}|${r.issuer_key_type}`;
  const cur = groups.get(key);
  if (cur) {
    cur.count += 1;
    if (r.year && (!cur.last_awarded_year || r.year > cur.last_awarded_year)) {
      cur.last_awarded_year = r.year;
    }
  } else {
    groups.set(key, {
      entity_id:         r.entity_id,
      issuer_key:        r.issuer_key,
      issuer_key_type:   r.issuer_key_type,
      count:             1,
      last_awarded_year: r.year || null,
    });
  }
  entityTotal.set(r.entity_id, (entityTotal.get(r.entity_id) || 0) + 1);
}

// share_ratio を付与
const outRows = [];
for (const g of groups.values()) {
  const total = entityTotal.get(g.entity_id) || 0;
  const share_ratio = total > 0 ? g.count / total : 0;
  outRows.push({ ...g, share_ratio });
}

console.log(`[rebuild-entity-issuer-counts] Aggregated: ${outRows.length} (entity, issuer_key) pairs, ${entityTotal.size} entities`);

if (dryRun) {
  // サンプル 5 件表示
  for (const r of outRows.slice(0, 5)) {
    console.log(`  [dry-run]`, r);
  }
  console.log(`[rebuild-entity-issuer-counts] Dry-run done: ${outRows.length} rows`);
  process.exit(0);
}

// 全量置換（idempotent）
db.prepare(`DELETE FROM nyusatsu_entity_issuer_counts`).run();

const CHUNK = 300;
let written = 0;
for (let i = 0; i < outRows.length; i += CHUNK) {
  const chunk = outRows.slice(i, i + CHUNK);
  const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
  const params = [];
  for (const r of chunk) {
    params.push(
      r.entity_id,
      r.issuer_key,
      r.issuer_key_type,
      r.count,
      r.last_awarded_year,
      r.share_ratio,
    );
  }
  db.prepare(`
    INSERT INTO nyusatsu_entity_issuer_counts
      (entity_id, issuer_key, issuer_key_type, count, last_awarded_year, share_ratio)
    VALUES ${placeholders}
  `).run(...params);
  written += chunk.length;
  if (written % 3000 === 0 || written === outRows.length) {
    console.log(`  ✓ inserted ${written}/${outRows.length}`);
  }
}
console.log(`[rebuild-entity-issuer-counts] Done: rows=${written} elapsed=${Date.now() - t0}ms`);
