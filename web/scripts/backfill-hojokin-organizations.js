#!/usr/bin/env node
/**
 * 補助金ナビ — 既存データの organizations バックフィル
 * provider_name を organizations に紐付ける
 *
 * Usage: node scripts/backfill-hojokin-organizations.js [--dry-run]
 */

const DRY_RUN = process.argv.includes("--dry-run");

function normalizeName(rawName) {
  if (!rawName) return { normalized: "", corpType: null };
  let name = rawName.trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 省庁・公的機関は法人格除去しない — そのまま正規化名にする
  return { normalized: name.toLowerCase().trim(), corpType: null };
}

function findOrCreateOrg(db, rawName) {
  if (!rawName || rawName.trim().length === 0) return null;

  const { normalized } = normalizeName(rawName);
  if (!normalized || normalized.length < 2) return null;

  // 正規化名一致
  const existing = db.prepare("SELECT * FROM organizations WHERE normalized_name = ? AND is_active = 1").get(normalized);
  if (existing) {
    // variant 記録
    const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(existing.id, rawName);
    if (!hasVariant && !DRY_RUN) {
      db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'hojokin', 'normalized', 0.95)").run(existing.id, rawName, normalized);
    }
    return { org: existing, action: "found" };
  }

  // variant テーブル一致
  const byVariant = db.prepare(`
    SELECT o.* FROM organizations o
    JOIN organization_name_variants v ON v.organization_id = o.id
    WHERE v.normalized_name = ? AND o.is_active = 1
    LIMIT 1
  `).get(normalized);
  if (byVariant) {
    const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(byVariant.id, rawName);
    if (!hasVariant && !DRY_RUN) {
      db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'hojokin', 'variant', 0.9)").run(byVariant.id, rawName, normalized);
    }
    return { org: byVariant, action: "found" };
  }

  // 新規作成
  if (DRY_RUN) {
    return { org: { id: -1, display_name: rawName }, action: "would_create" };
  }

  // 省庁・公的機関の entity_type 判定
  let entityType = "government";
  if (rawName.includes("機構") || rawName.includes("公社") || rawName.includes("協会") || rawName.includes("商工会議所")) {
    entityType = "public_agency";
  }
  if (rawName.includes("都") || rawName.includes("府") || rawName.includes("県") || rawName.includes("市") || rawName.includes("区") || rawName.includes("町") || rawName.includes("村")) {
    entityType = "local_government";
  }

  const result = db.prepare("INSERT INTO organizations (normalized_name, display_name, entity_type) VALUES (?, ?, ?)").run(normalized, rawName, entityType);
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(result.lastInsertRowid);
  db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'hojokin', 'initial', 1.0)").run(org.id, rawName, normalized);
  return { org, action: "created" };
}

async function main() {
  const { default: Database } = await import("better-sqlite3");
  const { join } = await import("path");

  const dbPath = join(process.cwd(), "data", "sports-event.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // organization_id カラムがなければ追加
  try {
    db.exec("ALTER TABLE hojokin_items ADD COLUMN organization_id INTEGER REFERENCES organizations(id)");
    console.log("organization_id カラムを追加しました");
  } catch {
    // 既に存在
  }

  const items = db.prepare("SELECT id, slug, title, provider_name FROM hojokin_items WHERE provider_name IS NOT NULL AND provider_name != ''").all();

  console.log(`=== 補助金ナビ organizations バックフィル ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`対象: ${items.length}件\n`);

  let linked = 0, created = 0, found = 0, skipped = 0;

  for (const item of items) {
    const result = findOrCreateOrg(db, item.provider_name);
    if (!result) {
      skipped++;
      continue;
    }

    if (result.action === "created" || result.action === "would_create") created++;
    else found++;

    if (!DRY_RUN && result.org.id > 0) {
      db.prepare("UPDATE hojokin_items SET organization_id = ? WHERE id = ?").run(result.org.id, item.id);
    }
    linked++;

    if (linked <= 20 || result.action === "created" || result.action === "would_create") {
      console.log(`  ${result.action}: "${item.provider_name}" → org_id=${result.org.id} (hojokin_id=${item.id})`);
    }
  }

  console.log(`\n--- 結果 ---`);
  console.log(`紐付け: ${linked}件`);
  console.log(`organization found: ${found}件`);
  console.log(`organization created: ${created}件`);
  console.log(`skipped: ${skipped}件`);

  // organizations の状況
  const orgs = db.prepare("SELECT id, display_name, entity_type FROM organizations ORDER BY id").all();
  console.log(`\n全 organizations: ${orgs.length}件`);

  // hojokin 由来の organizations
  const hojokinOrgs = db.prepare(`
    SELECT DISTINCT o.id, o.display_name, o.entity_type, COUNT(h.id) as hojokin_count
    FROM organizations o
    JOIN hojokin_items h ON h.organization_id = o.id
    GROUP BY o.id
    ORDER BY hojokin_count DESC
  `).all();
  console.log(`\nhojokin 紐付き organizations: ${hojokinOrgs.length}件`);
  for (const o of hojokinOrgs) {
    console.log(`  id=${o.id}: "${o.display_name}" (${o.entity_type}) → ${o.hojokin_count}件`);
  }

  // 未紐付け確認
  const unlinked = db.prepare("SELECT COUNT(*) as c FROM hojokin_items WHERE organization_id IS NULL").get().c;
  console.log(`\n未紐付け hojokin: ${unlinked}件`);

  db.close();
  console.log("\n=== 完了 ===");
}

main().catch(console.error);
