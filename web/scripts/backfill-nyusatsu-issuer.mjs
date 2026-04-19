#!/usr/bin/env node
/**
 * 入札 issuer 正規化 Phase 1: 既存データへの backfill。
 *
 * 処理:
 *   1. nyusatsu_results.issuer_code が NULL の行を一括更新
 *      → issuer_code = issuer_name（元コードをそのまま移す）
 *   2. issuer_dept_hint が NULL の行について、title から
 *      extractIssuerDeptHint() で deterministic に抽出して埋める
 *   3. nyusatsu_items も同じ処理を試みる
 *
 * 明示的にやらないこと:
 *   - issuer_name の上書き（意味論的に誤記載になるため）
 *   - code → 省庁名の 1:1 マッピング
 *   - fuzzy / LIKE / LLM 補完
 *
 * 使い方:
 *   node scripts/backfill-nyusatsu-issuer.mjs           # Turso
 *   node scripts/backfill-nyusatsu-issuer.mjs --local   # ローカル SQLite
 *   node scripts/backfill-nyusatsu-issuer.mjs --dry-run # UPDATE を実行せず件数だけ表示
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

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { extractIssuerDeptHint, ISSUER_HINT_SOURCE_TITLE_BRACKET } = await import("../lib/nyusatsu-issuer.js");

const db = getDb();
console.log(`[backfill-nyusatsu-issuer] Start: local=${useLocal} dryRun=${dryRun}`);

function backfillTable(tableName) {
  console.log(`\n──── ${tableName} ────`);

  // Step 1: issuer_code = issuer_name where issuer_code IS NULL
  const needCode = db.prepare(`
    SELECT COUNT(*) n FROM ${tableName}
    WHERE issuer_code IS NULL AND issuer_name IS NOT NULL
  `).get().n;
  console.log(`  issuer_code 未セット: ${needCode}`);

  if (!dryRun && needCode > 0) {
    // 一括 UPDATE。Turso でも数万〜数十万行なら OK。
    const res = db.prepare(`
      UPDATE ${tableName}
      SET issuer_code = issuer_name
      WHERE issuer_code IS NULL AND issuer_name IS NOT NULL
    `).run();
    console.log(`  -> issuer_code backfill: ${res.changes} 行`);
  }

  // Step 2: title から hint を抽出
  const rows = db.prepare(`
    SELECT id, title FROM ${tableName}
    WHERE issuer_dept_hint IS NULL AND title IS NOT NULL AND title LIKE '【%】%'
  `).all();
  console.log(`  hint 候補（title が 【...】 で始まる）: ${rows.length}`);

  // JS で extract
  const updates = [];
  for (const r of rows) {
    const hint = extractIssuerDeptHint(r.title);
    if (hint) updates.push({ id: r.id, hint });
  }
  console.log(`  -> deterministic に抽出できた行: ${updates.length} (除外: ${rows.length - updates.length})`);

  if (dryRun || updates.length === 0) {
    // サンプルを出す
    for (const u of updates.slice(0, 5)) console.log(`     sample: id=${u.id}  hint=${u.hint}`);
    return;
  }

  // CASE WHEN で batch UPDATE（SQLite 999 parameter 制限内で安全に収める）
  // batch size: 100 rows → 2 params/row × 100 + 100 (WHERE IN) = 300 params
  const BATCH = 100;
  let done = 0;
  const t0 = Date.now();
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    const caseWhen = slice.map(() => "WHEN ? THEN ?").join(" ");
    const inClause = slice.map(() => "?").join(",");
    const sql = `
      UPDATE ${tableName}
      SET issuer_dept_hint = CASE id ${caseWhen} END,
          issuer_hint_source = ?
      WHERE id IN (${inClause})
    `;
    const params = [];
    for (const u of slice) params.push(u.id, u.hint);
    params.push(ISSUER_HINT_SOURCE_TITLE_BRACKET);
    for (const u of slice) params.push(u.id);
    db.prepare(sql).run(...params);
    done += slice.length;
    if (done % 2000 === 0 || done === updates.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`     progress ${done}/${updates.length} (${elapsed}s)`);
    }
  }
  console.log(`  -> hint backfill 完了: ${done} 行`);
}

backfillTable("nyusatsu_results");
backfillTable("nyusatsu_items");

// 最終確認
console.log("\n──── 最終状態 ────");
for (const t of ["nyusatsu_results", "nyusatsu_items"]) {
  const total = db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  const code = db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE issuer_code IS NOT NULL`).get().n;
  const hint = db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE issuer_dept_hint IS NOT NULL`).get().n;
  console.log(`  ${t}: total=${total}  issuer_code 入り=${code}  issuer_dept_hint 入り=${hint}`);
}

console.log("\n※ issuer_name は一切上書きしていません。");
process.exit(0);
