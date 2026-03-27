#!/usr/bin/env node
/**
 * 行政処分DB — サンプルデータ投入
 * Usage: node scripts/seed-gyosei-shobun.js [--clear]
 */

const SEED_ITEMS = [
  {
    organization_name_raw: "株式会社大林組",
    corporate_number: "9120001076530",
    action_type: "improvement_order",
    action_date: "2026-02-15",
    authority_name: "国土交通省 関東地方整備局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "construction",
    summary: "建設業法第28条第1項に基づく改善命令。施工管理体制の不備により、工事の品質管理が不十分であったため。",
    detail: "令和8年2月15日付で、建設業法第28条第1項の規定に基づき、施工管理体制の改善を命ずる。主任技術者の配置不備が確認された現場について、30日以内に改善計画を提出すること。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/example/penalty-001",
    source_name: "国土交通省",
  },
  {
    organization_name_raw: "清水建設株式会社",
    action_type: "warning",
    action_date: "2026-01-20",
    authority_name: "国土交通省 近畿地方整備局",
    authority_level: "national",
    prefecture: "大阪府",
    industry: "construction",
    summary: "建設業法に基づく警告。元請として下請業者への指導監督が不十分であったため。",
    legal_basis: "建設業法第41条",
    source_url: "https://www.mlit.go.jp/example/penalty-002",
    source_name: "国土交通省",
  },
  {
    organization_name_raw: "（株）大林組",
    corporate_number: "9120001076530",
    action_type: "business_suspension",
    action_date: "2025-11-01",
    authority_name: "国土交通省 中部地方整備局",
    authority_level: "national",
    prefecture: "愛知県",
    industry: "construction",
    summary: "建設業法第28条第3項に基づく営業停止命令（30日間）。入札談合事件への関与が認定されたため。",
    detail: "令和7年11月1日から30日間の営業停止を命ずる。独占禁止法違反により公正取引委員会から排除措置命令を受けたことに伴う。",
    legal_basis: "建設業法第28条第3項",
    penalty_period: "30日間",
    source_url: "https://www.mlit.go.jp/example/penalty-003",
    source_name: "国土交通省",
  },
  {
    organization_name_raw: "東亜建設工業株式会社",
    action_type: "license_revocation",
    action_date: "2026-03-01",
    authority_name: "国土交通省",
    authority_level: "national",
    prefecture: "東京都",
    industry: "construction",
    summary: "建設業法第29条に基づく建設業許可取消。虚偽の申請により許可を取得していたことが判明。",
    legal_basis: "建設業法第29条第1項第5号",
    source_url: "https://www.mlit.go.jp/example/penalty-004",
    source_name: "国土交通省",
  },
  {
    organization_name_raw: "有限会社山田運送",
    action_type: "business_suspension",
    action_date: "2026-02-01",
    authority_name: "関東運輸局",
    authority_level: "national",
    prefecture: "埼玉県",
    city: "さいたま市",
    industry: "transport",
    summary: "貨物自動車運送事業法に基づく事業停止命令（20日間）。運行管理者の選任義務違反および点呼の未実施。",
    legal_basis: "貨物自動車運送事業法第33条",
    penalty_period: "20日間",
    source_url: "https://wwwtb.mlit.go.jp/kanto/example/penalty-005",
    source_name: "関東運輸局",
  },
  {
    organization_name_raw: "株式会社グリーンリサイクル",
    action_type: "license_revocation",
    action_date: "2026-01-10",
    authority_name: "千葉県",
    authority_level: "prefectural",
    prefecture: "千葉県",
    city: "市原市",
    industry: "waste",
    summary: "廃棄物処理法に基づく産業廃棄物処理業の許可取消。無許可での特別管理産業廃棄物の処理が発覚。",
    legal_basis: "廃棄物処理法第14条の3の2",
    source_url: "https://www.pref.chiba.lg.jp/example/penalty-006",
    source_name: "千葉県環境生活部",
  },
  {
    organization_name_raw: "株式会社スタッフサービス東京",
    action_type: "improvement_order",
    action_date: "2026-03-10",
    authority_name: "東京労働局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "staffing",
    summary: "労働者派遣法に基づく改善命令。派遣先への抵触日通知の遅延および派遣労働者への就業条件明示義務違反。",
    legal_basis: "労働者派遣法第49条第1項",
    source_url: "https://jsite.mhlw.go.jp/example/penalty-007",
    source_name: "東京労働局",
  },
  {
    organization_name_raw: "医療法人社団仁愛会",
    action_type: "guidance",
    action_date: "2026-02-20",
    authority_name: "東京都福祉保健局",
    authority_level: "prefectural",
    prefecture: "東京都",
    industry: "medical",
    summary: "医療法に基づく行政指導。病院の人員配置基準を満たしていないことが立入検査で判明。",
    legal_basis: "医療法第25条",
    source_url: "https://www.metro.tokyo.lg.jp/example/penalty-008",
    source_name: "東京都福祉保健局",
  },
  {
    organization_name_raw: "三井不動産リアルティ株式会社",
    action_type: "warning",
    action_date: "2026-01-25",
    authority_name: "国土交通省",
    authority_level: "national",
    prefecture: "東京都",
    industry: "real_estate",
    summary: "宅地建物取引業法に基づく指示処分。重要事項説明における記載不備が複数件確認。",
    legal_basis: "宅地建物取引業法第65条第1項",
    source_url: "https://www.mlit.go.jp/example/penalty-009",
    source_name: "国土交通省",
  },
  {
    organization_name_raw: "大林組",
    corporate_number: "9120001076530",
    action_type: "guidance",
    action_date: "2025-09-15",
    authority_name: "国土交通省 北海道開発局",
    authority_level: "national",
    prefecture: "北海道",
    industry: "construction",
    summary: "施工計画に対する行政指導。安全管理体制の強化を要請。",
    legal_basis: "建設業法",
    source_url: "https://www.mlit.go.jp/example/penalty-010",
    source_name: "国土交通省",
  },
];

// ─── 名寄せ最小ロジック（organization-matcher.js の簡易版） ───

function normalizeName(rawName) {
  if (!rawName) return { normalized: "", corpType: null };
  let name = rawName.trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    [/^株式会社\s*/, "株式会社"], [/\s*株式会社$/, "株式会社"],
    [/^（株）\s*/, "株式会社"], [/\s*（株）$/, "株式会社"],
    [/^\(株\)\s*/, "株式会社"], [/\s*\(株\)$/, "株式会社"],
    [/^有限会社\s*/, "有限会社"], [/\s*有限会社$/, "有限会社"],
    [/^（有）\s*/, "有限会社"],
    [/^合同会社\s*/, "合同会社"],
    [/^一般社団法人\s*/, "一般社団法人"],
    [/^社会福祉法人\s*/, "社会福祉法人"],
    [/^医療法人社団\s*/, "医療法人社団"],
    [/^医療法人\s*/, "医療法人"],
    [/^特定非営利活動法人\s*/, "特定非営利活動法人"],
    [/^NPO法人\s*/, "特定非営利活動法人"],
  ];

  let corpType = null;
  for (const [pat, ct] of patterns) {
    if (pat.test(name)) {
      name = name.replace(pat, "").trim();
      corpType = ct;
      break;
    }
  }
  return { normalized: name.toLowerCase().trim(), corpType };
}

function findOrCreateOrg(db, rawName, corporateNumber, prefecture, city) {
  // 法人番号一致
  if (corporateNumber) {
    const existing = db.prepare("SELECT * FROM organizations WHERE corporate_number = ? AND is_active = 1").get(corporateNumber);
    if (existing) {
      // variant 記録
      const { normalized } = normalizeName(rawName);
      const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(existing.id, rawName);
      if (!hasVariant) {
        db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'corporate_number', 1.0)").run(existing.id, rawName, normalized);
      }
      return { org: existing, action: "found" };
    }
  }

  // 正規化名一致
  const { normalized, corpType } = normalizeName(rawName);
  if (normalized) {
    const existing = db.prepare("SELECT * FROM organizations WHERE normalized_name = ? AND is_active = 1").get(normalized);
    if (existing) {
      const hasVariant = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(existing.id, rawName);
      if (!hasVariant) {
        db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'normalized', 0.95)").run(existing.id, rawName, normalized);
      }
      return { org: existing, action: "found" };
    }
  }

  // 新規作成
  const entityType = corpType && (corpType.includes("株式") || corpType.includes("有限") || corpType.includes("合同")) ? "company" : "company";
  const result = db.prepare("INSERT INTO organizations (normalized_name, display_name, entity_type, corporate_number, prefecture, city) VALUES (?, ?, ?, ?, ?, ?)").run(normalized, rawName, entityType, corporateNumber || null, prefecture || null, city || null);
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(result.lastInsertRowid);
  db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'initial', 1.0)").run(org.id, rawName, normalized);
  return { org, action: "created" };
}

function generateSlug(item) {
  const datePart = (item.action_date || "unknown").replace(/-/g, "");
  const orgPart = normalizeName(item.organization_name_raw).normalized.substring(0, 10);
  const typePart = item.action_type;
  return `${datePart}-${typePart}-${orgPart}`.replace(/\s+/g, "-").replace(/[^\w\u3000-\u9FFF-]/g, "").substring(0, 60);
}

// ─── メイン処理 ───

async function main() {
  const { default: Database } = await import("better-sqlite3");
  const { join } = await import("path");

  const dbPath = join(process.cwd(), "data", "sports-event.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // テーブル作成（getDb のロジックと同等だが、スクリプト用に直接実行）
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      entity_type TEXT DEFAULT 'company',
      corporate_number TEXT,
      prefecture TEXT,
      city TEXT,
      address TEXT,
      merged_into_id INTEGER REFERENCES organizations(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_normalized ON organizations(normalized_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_corporate ON organizations(corporate_number)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_corp_unique ON organizations(corporate_number) WHERE corporate_number IS NOT NULL`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_name_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      raw_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      source_domain TEXT,
      source_entity_type TEXT,
      source_entity_id INTEGER,
      match_method TEXT DEFAULT 'exact',
      confidence REAL DEFAULT 1.0,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_org_variants_org ON organization_name_variants(organization_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_org_variants_normalized ON organization_name_variants(normalized_name)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS administrative_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      organization_id INTEGER REFERENCES organizations(id),
      organization_name_raw TEXT NOT NULL,
      action_type TEXT NOT NULL DEFAULT 'other',
      action_date TEXT,
      authority_name TEXT,
      authority_level TEXT DEFAULT 'national',
      prefecture TEXT,
      city TEXT,
      industry TEXT,
      summary TEXT,
      detail TEXT,
      legal_basis TEXT,
      penalty_period TEXT,
      source_url TEXT,
      source_name TEXT,
      is_published INTEGER NOT NULL DEFAULT 0,
      review_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS administrative_action_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      action_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_key, action_id)
    )
  `);

  // --clear オプション
  if (process.argv.includes("--clear")) {
    console.log("既存データをクリア...");
    db.exec("DELETE FROM administrative_actions");
    db.exec("DELETE FROM organization_name_variants WHERE source_domain = 'gyosei-shobun'");
    db.exec("DELETE FROM organizations WHERE id NOT IN (SELECT DISTINCT organization_id FROM organization_name_variants WHERE source_domain != 'gyosei-shobun')");
  }

  console.log("=== 行政処分DB seed 開始 ===\n");

  let created = 0, updated = 0, orgCreated = 0, orgFound = 0;

  for (const item of SEED_ITEMS) {
    const slug = generateSlug(item);
    const { org, action: orgAction } = findOrCreateOrg(db, item.organization_name_raw, item.corporate_number, item.prefecture, item.city);
    if (orgAction === "created") orgCreated++;
    else orgFound++;

    const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
    if (existing) {
      db.prepare(`UPDATE administrative_actions SET organization_id=?, organization_name_raw=?, action_type=?, action_date=?, authority_name=?, authority_level=?, prefecture=?, city=?, industry=?, summary=?, detail=?, legal_basis=?, penalty_period=?, source_url=?, source_name=?, is_published=1, review_status='approved', updated_at=datetime('now') WHERE slug=?`).run(org.id, item.organization_name_raw, item.action_type, item.action_date, item.authority_name, item.authority_level || "national", item.prefecture, item.city || null, item.industry, item.summary, item.detail || null, item.legal_basis || null, item.penalty_period || null, item.source_url, item.source_name, slug);
      updated++;
    } else {
      db.prepare(`INSERT INTO administrative_actions (slug, organization_id, organization_name_raw, action_type, action_date, authority_name, authority_level, prefecture, city, industry, summary, detail, legal_basis, penalty_period, source_url, source_name, is_published, review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'approved')`).run(slug, org.id, item.organization_name_raw, item.action_type, item.action_date, item.authority_name, item.authority_level || "national", item.prefecture, item.city || null, item.industry, item.summary, item.detail || null, item.legal_basis || null, item.penalty_period || null, item.source_url, item.source_name);
      created++;
    }
    console.log(`  ${existing ? "updated" : "created"}: ${slug} → org_id=${org.id} (${orgAction})`);
  }

  console.log(`\n--- 結果 ---`);
  console.log(`処分データ: created=${created}, updated=${updated}`);
  console.log(`organizations: created=${orgCreated}, found=${orgFound}`);

  const orgs = db.prepare("SELECT id, display_name FROM organizations ORDER BY id").all();
  console.log(`\n全 organizations: ${orgs.length}件`);
  for (const o of orgs) {
    const vc = db.prepare("SELECT COUNT(*) as c FROM organization_name_variants WHERE organization_id = ?").get(o.id).c;
    console.log(`  id=${o.id}: "${o.display_name}" (variants: ${vc})`);
  }

  db.close();
  console.log("\n=== seed 完了 ===");
}

main().catch(console.error);
