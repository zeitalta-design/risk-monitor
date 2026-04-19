/**
 * sanpai の corporate_number を organization_name_variants 逆引きで
 * どこまで補完できるか、書き込み無しで検証する dry-run。
 *
 * 手順:
 *   1. corp 無しの sanpai_items を列挙
 *   2. company_name を normalizeCompanyKey で正規化
 *   3. organization_name_variants.raw_name / normalized_name と照合
 *   4. マッチした organization → corporate_number を候補として収集
 *   5. 都道府県一致で候補を絞り込む（厳格モード）
 *   6. 単一 corp / 複数 corp / 一致なし / corp 未登録 org に分類
 *
 * 書き込み: 無し（集計のみ）
 *
 * 実行: node scripts/dry-run-sanpai-corp-backfill.mjs
 */
import path from "node:path";
import fs from "node:fs";

// .env.local ロード（Turso 接続用）
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const c = fs.readFileSync(envLocalPath, "utf8");
  for (const line of c.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { getDb } = await import("../lib/db.js");
const { normalizeCompanyKey } = await import("../lib/agents/resolver/normalize.js");

const db = getDb();

// ─── 1. 対象 sanpai 行取得 ─────────────────────────────────
const sanpaiRows = db.prepare(`
  SELECT id, slug, company_name, prefecture, city, corporate_number, source_name
  FROM sanpai_items
  WHERE is_published = 1
`).all();

const withCorpAlready = sanpaiRows.filter((r) => r.corporate_number && r.corporate_number !== "").length;
const needsCorp = sanpaiRows.filter((r) => !r.corporate_number || r.corporate_number === "");

console.log("=== sanpai corp-backfill dry-run ===");
console.log(`total sanpai rows (published): ${sanpaiRows.length}`);
console.log(`  already has corp:       ${withCorpAlready}`);
console.log(`  needs corp (target):    ${needsCorp.length}`);
console.log();

// ─── 2. 候補検索（raw_name / normalized_name の両方で exact 一致） ─────
//
// raw_name  : 他ドメインで観測された原文表記。NFKC 等は行われない「そのまま」。
// normalized_name: organization_name_variants.normalized_name。登録時の正規化済みキー。
//   （本プロジェクト内で同じ normalizeCompanyKey 経由で入れられていれば完全一致可能）
//
// exact-match で raw_name がヒットするケースと、normalized_key 経由でヒットするケースを
// 両方拾う。いずれも SQL index が効く。
//

const findByRawStmt = db.prepare(`
  SELECT v.raw_name, v.normalized_name, v.source_domain,
         o.id   AS org_id,
         o.corporate_number AS corp,
         o.prefecture       AS org_prefecture,
         o.display_name     AS org_display_name
  FROM organization_name_variants v
  JOIN organizations o ON o.id = v.organization_id
  WHERE v.raw_name = ?
`);

const findByNormalizedStmt = db.prepare(`
  SELECT v.raw_name, v.normalized_name, v.source_domain,
         o.id   AS org_id,
         o.corporate_number AS corp,
         o.prefecture       AS org_prefecture,
         o.display_name     AS org_display_name
  FROM organization_name_variants v
  JOIN organizations o ON o.id = v.organization_id
  WHERE v.normalized_name = ?
`);

const buckets = {
  no_match:              [],   // 候補 0
  single_no_corp:        [],   // 候補 1 org、corp 未登録
  single_with_corp:      [],   // 候補 1 corp、都道府県未確認 or 未一致（= 未一致の場合は警戒）
  single_with_corp_pref: [],   // 候補 1 corp、都道府県一致 or 県情報が片方欠損 → 高信頼
  multi_corp:            [],   // 2件以上の distinct corp → 曖昧
};

for (const s of needsCorp) {
  const nk = normalizeCompanyKey(s.company_name);

  // raw_name と normalized_name の両方で照合
  const rawHits = s.company_name ? findByRawStmt.all(s.company_name) : [];
  const nkHits  = nk              ? findByNormalizedStmt.all(nk)       : [];

  // org_id を de-dupe しながら merge（raw を先に、nk は補完）
  const byOrg = new Map();
  for (const h of rawHits) {
    if (!byOrg.has(h.org_id)) byOrg.set(h.org_id, { ...h, hit_by: new Set(["raw"]) });
    else byOrg.get(h.org_id).hit_by.add("raw");
  }
  for (const h of nkHits) {
    if (!byOrg.has(h.org_id)) byOrg.set(h.org_id, { ...h, hit_by: new Set(["normalized"]) });
    else byOrg.get(h.org_id).hit_by.add("normalized");
  }

  const candidates = [...byOrg.values()];
  if (candidates.length === 0) { buckets.no_match.push({ s }); continue; }

  // candidates を corp の有無で分割
  const withCorp = candidates.filter((c) => c.corp && c.corp !== "");
  if (withCorp.length === 0) {
    buckets.single_no_corp.push({ s, candidates });
    continue;
  }

  const distinctCorps = new Set(withCorp.map((c) => c.corp));
  if (distinctCorps.size >= 2) {
    buckets.multi_corp.push({ s, candidates: withCorp });
    continue;
  }

  // 単一 corp 候補
  const c = withCorp[0];
  const sPref = (s.prefecture || "").trim();
  const oPref = (c.org_prefecture || "").trim();

  // 都道府県判定:
  //   一致     → 高信頼
  //   どちらかが欠損 → 扱いを "pref" 側にしておく（変換先で警戒）
  //   不一致   → single_with_corp（警戒対象）へ
  const prefMatch = sPref && oPref
    ? (sPref === oPref)
    : null; // nullable = 判定不能

  if (prefMatch === true || prefMatch === null) {
    buckets.single_with_corp_pref.push({ s, candidate: c, prefMatch });
  } else {
    buckets.single_with_corp.push({ s, candidate: c, prefMatch: false });
  }
}

// ─── 3. 集計 ──────────────────────────────────────────────

const n = needsCorp.length;
function pct(v) { return n > 0 ? ((v / n) * 100).toFixed(1) + "%" : "—"; }

console.log("── 照合結果（needs_corp = " + n + " を分母） ─────────────");
console.log(`  no_match              : ${String(buckets.no_match.length).padStart(4)}  (${pct(buckets.no_match.length)})`);
console.log(`  single_no_corp        : ${String(buckets.single_no_corp.length).padStart(4)}  (${pct(buckets.single_no_corp.length)})  ← org はあるが corp 未登録`);
console.log(`  single_with_corp_pref : ${String(buckets.single_with_corp_pref.length).padStart(4)}  (${pct(buckets.single_with_corp_pref.length)})  ← 採用候補`);
console.log(`  single_with_corp      : ${String(buckets.single_with_corp.length).padStart(4)}  (${pct(buckets.single_with_corp.length)})  ← 県不一致（採用保留）`);
console.log(`  multi_corp            : ${String(buckets.multi_corp.length).padStart(4)}  (${pct(buckets.multi_corp.length)})  ← 曖昧（採用しない）`);
console.log();

// 都道府県一致だけを集計
const prefConfirmed = buckets.single_with_corp_pref.filter((x) => x.prefMatch === true).length;
const prefUnknown   = buckets.single_with_corp_pref.filter((x) => x.prefMatch === null).length;
console.log("  └─ single_with_corp_pref の内訳:");
console.log(`       県一致        : ${prefConfirmed}`);
console.log(`       県情報不明    : ${prefUnknown}   ← どちらかの prefecture が空`);
console.log();

// ─── 4. サンプル出力 ──────────────────────────────────────

function printSample(title, items, max, render) {
  console.log(`── sample: ${title} ─────────────`);
  const take = items.slice(0, max);
  if (take.length === 0) { console.log("  (none)"); return; }
  for (const x of take) console.log("  " + render(x));
  if (items.length > max) console.log(`  ... and ${items.length - max} more`);
  console.log();
}

printSample("single_with_corp_pref（採用候補）", buckets.single_with_corp_pref, 10, (x) => {
  return `${(x.s.company_name || "").padEnd(30)} [${x.s.prefecture || "?"}] -> corp=${x.candidate.corp} (${x.candidate.org_display_name}, ${[...x.candidate.hit_by].join("+")}, pref=${x.prefMatch === null ? "unknown" : x.prefMatch})`;
});

printSample("single_with_corp（県不一致 - 採用しない）", buckets.single_with_corp, 8, (x) => {
  return `${(x.s.company_name || "").padEnd(30)} [sanpai:${x.s.prefecture || "?"} vs org:${x.candidate.org_prefecture || "?"}] -> corp=${x.candidate.corp} (${x.candidate.org_display_name})`;
});

printSample("multi_corp（曖昧）", buckets.multi_corp, 6, (x) => {
  const corps = [...new Set(x.candidates.map((c) => c.corp))].join(", ");
  return `${(x.s.company_name || "").padEnd(30)} -> { ${corps} }`;
});

printSample("single_no_corp（org はあるが corp 未登録）", buckets.single_no_corp, 5, (x) => {
  return `${(x.s.company_name || "").padEnd(30)} -> org_ids=[${x.candidates.map((c) => c.org_id).join(",")}]`;
});

// ─── 5. 推奨アクション ───────────────────────────────────

const adoptable = buckets.single_with_corp_pref.length;
console.log("── 推奨 ─────────────");
console.log(`採用可能件数（= single_with_corp_pref）: ${adoptable}`);
console.log(`現在の sanpai.corp 付与率: ${withCorpAlready} / ${sanpaiRows.length} = ${((withCorpAlready / sanpaiRows.length) * 100).toFixed(1)}%`);
console.log(`dry-run 適用後の付与率見込み: ${withCorpAlready + adoptable} / ${sanpaiRows.length} = ${(((withCorpAlready + adoptable) / sanpaiRows.length) * 100).toFixed(1)}%`);
console.log();
console.log("※ この dry-run は DB を変更していません。");

process.exit(0);
