#!/usr/bin/env node
/**
 * 許認可検索 — 既存データの organizations バックフィル
 * entity_name + corporate_number を organizations に紐付ける
 *
 * Usage: node scripts/backfill-kyoninka-organizations.js [--dry-run]
 */

const DRY_RUN = process.argv.includes("--dry-run");

// ─── 法人格表記ゆれ正規化 ───

const CORP_PATTERNS = [
  [/^株式会社\s*/, "株式会社"], [/\s*株式会社$/, "株式会社"],
  [/^（株）\s*/, "株式会社"], [/\s*（株）$/, "株式会社"],
  [/^\(株\)\s*/, "株式会社"], [/\s*\(株\)$/, "株式会社"],
  [/^有限会社\s*/, "有限会社"], [/\s*有限会社$/, "有限会社"],
  [/^（有）\s*/, "有限会社"], [/\s*（有）$/, "有限会社"],
  [/^合同会社\s*/, "合同会社"], [/\s*合同会社$/, "合同会社"],
  [/^合資会社\s*/, "合資会社"],
  [/^一般社団法人\s*/, "一般社団法人"],
  [/^一般財団法人\s*/, "一般財団法人"],
  [/^社会福祉法人\s*/, "社会福祉法人"],
  [/^医療法人社団\s*/, "医療法人社団"],
  [/^医療法人\s*/, "医療法人"],
  [/^特定非営利活動法人\s*/, "特定非営利活動法人"],
  [/^NPO法人\s*/, "特定非営利活動法人"],
  [/^学校法人\s*/, "学校法人"],
  [/^宗教法人\s*/, "宗教法人"],
  [/^協同組合\s*/, "協同組合"],
  [/^事業協同組合\s*/, "事業協同組合"],
];

function normalizeName(rawName) {
  if (!rawName) return { normalized: "", corpType: null };
  let name = rawName.trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let corpType = null;
  for (const [pat, ct] of CORP_PATTERNS) {
    if (pat.test(name)) {
      name = name.replace(pat, "").trim();
      corpType = ct;
      break;
    }
  }
  return { normalized: name.toLowerCase().trim(), corpType };
}

function mapCorpType(corpType) {
  if (!corpType) return "company";
  if (corpType.includes("株式") || corpType.includes("有限") || corpType.includes("合同") || corpType.includes("合資")) return "company";
  if (corpType.includes("社会福祉")) return "welfare";
  if (corpType.includes("医療")) return "medical";
  if (corpType.includes("学校")) return "school";
  if (corpType.includes("特定非営利") || corpType.includes("NPO")) return "npo";
  if (corpType.includes("一般社団") || corpType.includes("一般財団")) return "association";
  if (corpType.includes("協同組合")) return "cooperative";
  return "company";
}

function findOrCreateOrg(db, rawName, corporateNumber, prefecture, city) {
  if (!rawName || rawName.trim().length < 2) return null;

  // 1. 法人番号一致（最優先）
  if (corporateNumber) {
    const existing = db.prepare("SELECT * FROM organizations WHERE corporate_number = ? AND is_active = 1").get(corporateNumber);
    if (existing) {
      const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(existing.id, rawName);
      if (!hasVariant && !DRY_RUN) {
        const { normalized } = normalizeName(rawName);
        db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'kyoninka', 'corporate_number', 1.0)").run(existing.id, rawName, normalized);
      }
      return { org: existing, action: "found_by_corp", isNew: false };
    }
  }

  // 2. 正規化名一致
  const { normalized, corpType } = normalizeName(rawName);
  if (!normalized || normalized.length < 2) return null;

  const byNormalized = db.prepare("SELECT * FROM organizations WHERE normalized_name = ? AND is_active = 1").get(normalized);
  if (byNormalized) {
    const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(byNormalized.id, rawName);
    if (!hasVariant && !DRY_RUN) {
      db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'kyoninka', 'normalized', 0.95)").run(byNormalized.id, rawName, normalized);
    }
    // 法人番号補完: 既存orgに法人番号がなく、今回あれば更新
    if (corporateNumber && !byNormalized.corporate_number && !DRY_RUN) {
      db.prepare("UPDATE organizations SET corporate_number = ?, updated_at = datetime('now') WHERE id = ?").run(corporateNumber, byNormalized.id);
    }
    return { org: byNormalized, action: "found_by_name", isNew: false };
  }

  // 3. variant テーブル一致
  const byVariant = db.prepare("SELECT o.* FROM organizations o JOIN organization_name_variants v ON v.organization_id = o.id WHERE v.normalized_name = ? AND o.is_active = 1 LIMIT 1").get(normalized);
  if (byVariant) {
    const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(byVariant.id, rawName);
    if (!hasVariant && !DRY_RUN) {
      db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'kyoninka', 'variant', 0.9)").run(byVariant.id, rawName, normalized);
    }
    return { org: byVariant, action: "found_by_variant", isNew: false };
  }

  // 4. 新規作成
  if (DRY_RUN) {
    return { org: { id: -1, display_name: rawName }, action: "would_create", isNew: true };
  }

  const entityType = mapCorpType(corpType);
  const result = db.prepare("INSERT INTO organizations (normalized_name, display_name, entity_type, corporate_number, prefecture, city) VALUES (?, ?, ?, ?, ?, ?)").run(normalized, rawName, entityType, corporateNumber || null, prefecture || null, city || null);
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(result.lastInsertRowid);
  db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'kyoninka', 'initial', 1.0)").run(org.id, rawName, normalized);
  return { org, action: "created", isNew: true };
}

async function main() {
  const { default: Database } = await import("better-sqlite3");
  const { join } = await import("path");

  const dbPath = join(process.cwd(), "data", "sports-event.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // organization_id カラム追加
  try {
    db.exec("ALTER TABLE kyoninka_entities ADD COLUMN organization_id INTEGER REFERENCES organizations(id)");
    console.log("organization_id カラムを追加しました");
  } catch { /* 既に存在 */ }

  const items = db.prepare("SELECT id, entity_name, corporate_number, prefecture, city FROM kyoninka_entities").all();

  console.log(`=== 許認可検索 organizations バックフィル ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`対象: ${items.length}件\n`);

  let linked = 0, skipped = 0;
  const stats = { found_by_corp: 0, found_by_name: 0, found_by_variant: 0, created: 0, would_create: 0 };

  for (const item of items) {
    const result = findOrCreateOrg(db, item.entity_name, item.corporate_number, item.prefecture, item.city);
    if (!result) {
      skipped++;
      continue;
    }

    stats[result.action] = (stats[result.action] || 0) + 1;

    if (!DRY_RUN && result.org.id > 0) {
      db.prepare("UPDATE kyoninka_entities SET organization_id = ? WHERE id = ?").run(result.org.id, item.id);
    }
    linked++;

    // 最初の20件 + 新規作成は全てログ
    if (linked <= 20 || result.isNew) {
      console.log(`  ${result.action}: "${item.entity_name}" corp=${item.corporate_number || "NULL"} → org_id=${result.org.id}`);
    }
  }

  console.log(`\n--- 結果 ---`);
  console.log(`紐付け: ${linked}件 / skip: ${skipped}件`);
  console.log(`法人番号一致: ${stats.found_by_corp}件`);
  console.log(`正規化名一致: ${stats.found_by_name}件`);
  console.log(`variant一致: ${stats.found_by_variant}件`);
  console.log(`新規作成: ${stats.created || stats.would_create || 0}件`);

  // organizations 全体状況
  const totalOrgs = db.prepare("SELECT COUNT(*) as c FROM organizations").get().c;
  console.log(`\n全 organizations: ${totalOrgs}件`);

  // kyoninka 紐付き上位
  if (!DRY_RUN) {
    const kyoninkaOrgs = db.prepare(`
      SELECT o.id, o.display_name, o.entity_type, o.corporate_number, COUNT(k.id) as count
      FROM organizations o
      JOIN kyoninka_entities k ON k.organization_id = o.id
      GROUP BY o.id ORDER BY count DESC LIMIT 10
    `).all();
    console.log(`\nkyoninka 紐付き organizations TOP10:`);
    for (const o of kyoninkaOrgs) {
      console.log(`  id=${o.id}: "${o.display_name}" (${o.entity_type}, corp=${o.corporate_number || "NULL"}) → ${o.count}件`);
    }

    const unlinked = db.prepare("SELECT COUNT(*) as c FROM kyoninka_entities WHERE organization_id IS NULL").get().c;
    console.log(`\n未紐付け kyoninka: ${unlinked}件`);

    // ドメイン横断: 複数ドメインに跨る organizations
    const crossDomain = db.prepare(`
      SELECT o.id, o.display_name,
        (SELECT COUNT(*) FROM kyoninka_entities k WHERE k.organization_id = o.id) as kyoninka_count,
        (SELECT COUNT(*) FROM administrative_actions a WHERE a.organization_id = o.id) as gyosei_count,
        (SELECT COUNT(*) FROM hojokin_items h WHERE h.organization_id = o.id) as hojokin_count
      FROM organizations o
      HAVING kyoninka_count + gyosei_count + hojokin_count > 0
      ORDER BY kyoninka_count + gyosei_count + hojokin_count DESC
      LIMIT 5
    `).all();
    console.log(`\nドメイン横断 organizations TOP5:`);
    for (const o of crossDomain) {
      console.log(`  id=${o.id}: "${o.display_name}" kyoninka=${o.kyoninka_count} gyosei=${o.gyosei_count} hojokin=${o.hojokin_count}`);
    }
  }

  db.close();
  console.log("\n=== 完了 ===");
}

main().catch(console.error);
