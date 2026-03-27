#!/usr/bin/env node
/**
 * 許認可検索 seed — 仮データを kyoninka_entities + kyoninka_registrations に投入
 * Usage: node scripts/seed-kyoninka.js [--clear]
 */

const SEED_ENTITIES = [
  {
    slug: "tokyo-marubeni-kensetsu",
    entity_name: "丸紅建設株式会社",
    normalized_name: "(株)丸紅建設",
    corporate_number: "3010001012345",
    prefecture: "東京都",
    city: "中央区",
    address: "中央区日本橋2-3-4",
    entity_status: "active",
    primary_license_family: "construction",
    registration_count: 3,
    source_name: "国土交通省",
    notes: "一般建設業・特定建設業の両方を保有。宅建業も登録あり。",
  },
  {
    slug: "osaka-naniwa-fudosan",
    entity_name: "なにわ不動産株式会社",
    normalized_name: "(株)なにわ不動産",
    corporate_number: "5120001098765",
    prefecture: "大阪府",
    city: "大阪市",
    address: "大阪市中央区心斎橋1-1-1",
    entity_status: "active",
    primary_license_family: "real_estate",
    registration_count: 2,
    source_name: "大阪府",
    notes: "宅地建物取引業と賃貸住宅管理業を保有。",
  },
  {
    slug: "aichi-chubu-logistics",
    entity_name: "中部ロジスティクス株式会社",
    normalized_name: "(株)中部ロジスティクス",
    corporate_number: "7180001054321",
    prefecture: "愛知県",
    city: "名古屋市",
    address: "名古屋市港区築三町1-2",
    entity_status: "active",
    primary_license_family: "transport",
    registration_count: 2,
    source_name: "中部運輸局",
    notes: "一般貨物運送と産廃収集運搬の許可を保有。",
  },
  {
    slug: "fukuoka-kyushu-guard",
    entity_name: "九州ガードサービス株式会社",
    normalized_name: "(株)九州ガードサービス",
    corporate_number: "9400001076543",
    prefecture: "福岡県",
    city: "福岡市",
    address: "福岡市博多区博多駅前3-5-6",
    entity_status: "active",
    primary_license_family: "security",
    registration_count: 1,
    source_name: "福岡県公安委員会",
    notes: "警備業認定を保有。行政処分歴なし。",
  },
  {
    slug: "saitama-kanto-shokuhin",
    entity_name: "関東食品加工株式会社",
    normalized_name: "(株)関東食品加工",
    corporate_number: "2030001087654",
    prefecture: "埼玉県",
    city: "川口市",
    address: "川口市芝2-10-15",
    entity_status: "active",
    primary_license_family: "food_sanitation",
    registration_count: 2,
    source_name: "川口市保健所",
    notes: "食品製造業と飲食店営業の許可を保有。",
  },
  {
    slug: "hokkaido-sapporo-kensetsu",
    entity_name: "札幌総合建設有限会社",
    normalized_name: "(有)札幌総合建設",
    corporate_number: null,
    prefecture: "北海道",
    city: "札幌市",
    address: "札幌市北区北7条西2-1-1",
    entity_status: "closed",
    primary_license_family: "construction",
    registration_count: 1,
    source_name: "北海道",
    notes: "建設業許可は期限切れ。現在廃業。",
  },
  {
    slug: "kanagawa-yokohama-takken",
    entity_name: "横浜ホームズ株式会社",
    normalized_name: "(株)横浜ホームズ",
    corporate_number: "1021001065432",
    prefecture: "神奈川県",
    city: "横浜市",
    address: "横浜市中区山下町1-2-3",
    entity_status: "suspended",
    primary_license_family: "real_estate",
    registration_count: 1,
    source_name: "神奈川県",
    notes: "宅建業許可あり。行政処分により一部業務停止中。",
  },
];

const SEED_REGISTRATIONS = [
  // 丸紅建設 (tokyo-marubeni-kensetsu) — 建設2 + 宅建1
  { entity_slug: "tokyo-marubeni-kensetsu", license_family: "construction", license_type: "general_construction", registration_number: "東京都知事（般-35）第123456号", authority_name: "東京都", prefecture: "東京都", valid_from: "2024-04-01", valid_to: "2029-03-31", registration_status: "active", disciplinary_flag: 0 },
  { entity_slug: "tokyo-marubeni-kensetsu", license_family: "construction", license_type: "special_construction", registration_number: "国土交通大臣（特-5）第7890号", authority_name: "国土交通省", prefecture: null, valid_from: "2023-10-01", valid_to: "2028-09-30", registration_status: "active", disciplinary_flag: 0 },
  { entity_slug: "tokyo-marubeni-kensetsu", license_family: "real_estate", license_type: "real_estate_broker", registration_number: "東京都知事（3）第54321号", authority_name: "東京都", prefecture: "東京都", valid_from: "2022-01-15", valid_to: "2027-01-14", registration_status: "active", disciplinary_flag: 0 },

  // なにわ不動産 (osaka-naniwa-fudosan) — 宅建 + 賃貸管理
  { entity_slug: "osaka-naniwa-fudosan", license_family: "real_estate", license_type: "real_estate_broker", registration_number: "大阪府知事（5）第98765号", authority_name: "大阪府", prefecture: "大阪府", valid_from: "2020-06-01", valid_to: "2025-05-31", registration_status: "active", disciplinary_flag: 0 },
  { entity_slug: "osaka-naniwa-fudosan", license_family: "real_estate", license_type: "real_estate_management", registration_number: "国土交通大臣（1）第012345号", authority_name: "国土交通省", prefecture: null, valid_from: "2023-08-01", valid_to: null, registration_status: "active", disciplinary_flag: 0 },

  // 中部ロジスティクス (aichi-chubu-logistics) — 運送 + 産廃
  { entity_slug: "aichi-chubu-logistics", license_family: "transport", license_type: "general_cargo", registration_number: "中運自貨第456号", authority_name: "中部運輸局", prefecture: "愛知県", valid_from: "2021-04-01", valid_to: null, registration_status: "active", disciplinary_flag: 0 },
  { entity_slug: "aichi-chubu-logistics", license_family: "waste_disposal", license_type: "collection_transport", registration_number: "愛知県知事 第02300123456号", authority_name: "愛知県", prefecture: "愛知県", valid_from: "2022-07-01", valid_to: "2027-06-30", registration_status: "active", disciplinary_flag: 0 },

  // 九州ガードサービス (fukuoka-kyushu-guard) — 警備
  { entity_slug: "fukuoka-kyushu-guard", license_family: "security", license_type: "security_service", registration_number: "福岡県公安委員会 第40001234号", authority_name: "福岡県公安委員会", prefecture: "福岡県", valid_from: "2023-01-10", valid_to: null, registration_status: "active", disciplinary_flag: 0 },

  // 関東食品加工 (saitama-kanto-shokuhin) — 食品
  { entity_slug: "saitama-kanto-shokuhin", license_family: "food_sanitation", license_type: "food_manufacturing", registration_number: "川口保食品製第789号", authority_name: "川口市保健所", prefecture: "埼玉県", valid_from: "2021-11-01", valid_to: "2027-10-31", registration_status: "active", disciplinary_flag: 0 },
  { entity_slug: "saitama-kanto-shokuhin", license_family: "food_sanitation", license_type: "restaurant", registration_number: "川口保飲食第456号", authority_name: "川口市保健所", prefecture: "埼玉県", valid_from: "2022-03-01", valid_to: "2028-02-28", registration_status: "active", disciplinary_flag: 0 },

  // 札幌総合建設 (hokkaido-sapporo-kensetsu) — 期限切れ
  { entity_slug: "hokkaido-sapporo-kensetsu", license_family: "construction", license_type: "general_construction", registration_number: "北海道知事（般-28）第001234号", authority_name: "北海道", prefecture: "北海道", valid_from: "2015-04-01", valid_to: "2020-03-31", registration_status: "expired", disciplinary_flag: 0 },

  // 横浜ホームズ (kanagawa-yokohama-takken) — 処分フラグ付き
  { entity_slug: "kanagawa-yokohama-takken", license_family: "real_estate", license_type: "real_estate_broker", registration_number: "神奈川県知事（4）第76543号", authority_name: "神奈川県", prefecture: "神奈川県", valid_from: "2019-09-01", valid_to: "2024-08-31", registration_status: "suspended", disciplinary_flag: 1 },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM kyoninka_registrations").run();
    db.prepare("DELETE FROM kyoninka_entities").run();
    console.log("kyoninka_entities + kyoninka_registrations cleared");
  }

  // Insert entities
  const insertEntity = db.prepare(`
    INSERT OR IGNORE INTO kyoninka_entities
      (slug, entity_name, normalized_name, corporate_number, prefecture, city, address,
       entity_status, primary_license_family, registration_count,
       source_name, source_url, notes, is_published, created_at, updated_at)
    VALUES
      (@slug, @entity_name, @normalized_name, @corporate_number, @prefecture, @city, @address,
       @entity_status, @primary_license_family, @registration_count,
       @source_name, @source_url, @notes, 1, datetime('now'), datetime('now'))
  `);

  let entitiesInserted = 0;
  for (const entity of SEED_ENTITIES) {
    const result = insertEntity.run({
      source_url: null, latest_update_date: null,
      ...entity,
    });
    if (result.changes > 0) entitiesInserted++;
  }
  console.log(`kyoninka_entities: ${entitiesInserted}/${SEED_ENTITIES.length} inserted (duplicates skipped)`);

  // Insert registrations
  const insertReg = db.prepare(`
    INSERT INTO kyoninka_registrations
      (entity_id, license_family, license_type, registration_number, authority_name, prefecture,
       valid_from, valid_to, registration_status, disciplinary_flag,
       source_name, source_url, detail_url, created_at, updated_at)
    VALUES
      (@entity_id, @license_family, @license_type, @registration_number, @authority_name, @prefecture,
       @valid_from, @valid_to, @registration_status, @disciplinary_flag,
       @source_name, @source_url, @detail_url, datetime('now'), datetime('now'))
  `);

  let regsInserted = 0;
  if (entitiesInserted > 0) {
    for (const reg of SEED_REGISTRATIONS) {
      const entity = db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ?").get(reg.entity_slug);
      if (!entity) { console.log(`  SKIP reg: entity ${reg.entity_slug} not found`); continue; }
      insertReg.run({
        entity_id: entity.id,
        license_family: reg.license_family,
        license_type: reg.license_type,
        registration_number: reg.registration_number,
        authority_name: reg.authority_name,
        prefecture: reg.prefecture,
        valid_from: reg.valid_from,
        valid_to: reg.valid_to,
        registration_status: reg.registration_status,
        disciplinary_flag: reg.disciplinary_flag,
        source_name: null,
        source_url: null,
        detail_url: null,
      });
      regsInserted++;
    }
  } else {
    const existingRegs = db.prepare("SELECT COUNT(*) as c FROM kyoninka_registrations").get().c;
    if (existingRegs === 0) {
      for (const reg of SEED_REGISTRATIONS) {
        const entity = db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ?").get(reg.entity_slug);
        if (!entity) continue;
        insertReg.run({
          entity_id: entity.id,
          license_family: reg.license_family,
          license_type: reg.license_type,
          registration_number: reg.registration_number,
          authority_name: reg.authority_name,
          prefecture: reg.prefecture,
          valid_from: reg.valid_from,
          valid_to: reg.valid_to,
          registration_status: reg.registration_status,
          disciplinary_flag: reg.disciplinary_flag,
          source_name: null,
          source_url: null,
          detail_url: null,
        });
        regsInserted++;
      }
    }
  }
  console.log(`kyoninka_registrations: ${regsInserted} inserted`);
}

main().catch((err) => { console.error(err); process.exit(1); });
