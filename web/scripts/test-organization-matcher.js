/**
 * organization-matcher のローカル検証スクリプト
 * 実行: node scripts/test-organization-matcher.js
 */

import { normalizeName, compareNames, findOrCreateOrganization } from "../lib/core/organization-matcher.js";
import { getDb, closeDb } from "../lib/db.js";

console.log("=== 名寄せロジック検証 ===\n");

// ─── Step 1: normalizeName テスト ───

console.log("--- normalizeName テスト ---");
const normalizeTests = [
  "株式会社大林組",
  "（株）大林組",
  "(株) 大林組",
  "大林組株式会社",
  "有限会社山田建設",
  "（有）山田建設",
  "一般社団法人日本建設業連合会",
  "社会福祉法人愛育会",
  "医療法人社団徳洲会",
  "特定非営利活動法人まちづくり支援センター",
  "NPO法人まちづくり支援センター",
  "合同会社ＡＢＣ　ホールディングス",
  "  株式会社  テスト  ",
];

for (const name of normalizeTests) {
  const result = normalizeName(name);
  console.log(`  "${name}" → normalized: "${result.normalized}", corpType: ${result.corpType || "null"}`);
}

// ─── Step 2: compareNames テスト ───

console.log("\n--- compareNames テスト ---");
const compareTests = [
  // 完全一致
  ["株式会社大林組", "株式会社大林組"],
  // 正規化一致（法人格位置ゆれ）
  ["株式会社大林組", "（株）大林組"],
  // 法人格が異なる → review
  ["株式会社山田建設", "有限会社山田建設"],
  // NPO表記ゆれ → 正規化一致
  ["特定非営利活動法人まちづくり支援センター", "NPO法人まちづくり支援センター"],
  // 全角半角
  ["合同会社ＡＢＣホールディングス", "合同会社ABCホールディングス"],
  // 無関係
  ["株式会社大林組", "清水建設株式会社"],
  // 短い名前（誤マージ防止）
  ["（株）AB", "（株）AC"],
];

for (const [a, b] of compareTests) {
  const result = compareNames(a, b);
  console.log(`  "${a}" vs "${b}" → ${result.match} (conf: ${result.confidence}, reason: ${result.reason})`);
}

// ─── Step 3: DB 統合テスト ───

console.log("\n--- findOrCreateOrganization DB テスト ---");
const db = getDb();

// 既存データをクリーン（テスト用）
db.exec("DELETE FROM organization_name_variants");
db.exec("DELETE FROM organizations");

// 1) 初回作成
const r1 = findOrCreateOrganization(db, {
  rawName: "株式会社大林組",
  corporateNumber: "1234567890123",
  prefecture: "東京都",
  sourceDomain: "gyosei-shobun",
});
console.log(`  1) "${r1.organization.display_name}" → action: ${r1.action}, id: ${r1.organization.id}`);

// 2) 法人番号で一致
const r2 = findOrCreateOrganization(db, {
  rawName: "（株）大林組",
  corporateNumber: "1234567890123",
  sourceDomain: "kyoninka",
});
console.log(`  2) "（株）大林組" (法人番号一致) → action: ${r2.action}, id: ${r2.organization.id}`);

// 3) 正規化名で一致（法人番号なし）
const r3 = findOrCreateOrganization(db, {
  rawName: "大林組株式会社",
  sourceDomain: "sanpai",
});
console.log(`  3) "大林組株式会社" (正規化一致) → action: ${r3.action}, id: ${r3.organization.id}`);

// 4) 新規事業者
const r4 = findOrCreateOrganization(db, {
  rawName: "清水建設株式会社",
  prefecture: "東京都",
  sourceDomain: "gyosei-shobun",
});
console.log(`  4) "清水建設株式会社" → action: ${r4.action}, id: ${r4.organization.id}`);

// 5) 法人格が異なる → review 対象 or 新規
const r5 = findOrCreateOrganization(db, {
  rawName: "有限会社大林組",
  sourceDomain: "test",
});
console.log(`  5) "有限会社大林組" (法人格違い) → action: ${r5.action}, id: ${r5.organization.id}${r5.candidates ? `, candidates: ${r5.candidates.length}` : ""}`);

// 6) variant から一致
const r6 = findOrCreateOrganization(db, {
  rawName: "（株）大林組",
  sourceDomain: "shitei",
});
console.log(`  6) "（株）大林組" (variant一致) → action: ${r6.action}, id: ${r6.organization.id}`);

// variants 確認
const variants = db.prepare("SELECT * FROM organization_name_variants WHERE organization_id = ?").all(r1.organization.id);
console.log(`\n  大林組の name_variants: ${variants.length}件`);
for (const v of variants) {
  console.log(`    raw: "${v.raw_name}", method: ${v.match_method}, source: ${v.source_domain}`);
}

// organizations 一覧
const allOrgs = db.prepare("SELECT id, display_name, normalized_name, corporate_number FROM organizations").all();
console.log(`\n  全 organizations: ${allOrgs.length}件`);
for (const o of allOrgs) {
  console.log(`    id=${o.id}: "${o.display_name}" (normalized: "${o.normalized_name}", corp: ${o.corporate_number || "null"})`);
}

closeDb();
console.log("\n=== 検証完了 ===");
