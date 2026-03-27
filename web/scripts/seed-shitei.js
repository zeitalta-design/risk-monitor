#!/usr/bin/env node
/**
 * 指定管理公募まとめ seed — 仮データを shitei_items テーブルに投入
 * Usage: node scripts/seed-shitei.js [--clear]
 */

const SEED = [
  {
    slug: "yokohama-sports-center-2026",
    title: "横浜市スポーツセンター指定管理者の募集",
    municipality_name: "横浜市",
    prefecture: "神奈川県",
    facility_category: "sports",
    facility_name: "横浜市スポーツセンター（全5施設）",
    recruitment_status: "open",
    application_start_date: "2026-03-01",
    application_deadline: "2026-04-30",
    opening_date: "2026-03-15",
    contract_start_date: "2027-04-01",
    contract_end_date: "2032-03-31",
    summary: "横浜市内5箇所のスポーツセンターの指定管理者を公募します。体育館、プール、トレーニング室等の管理運営業務。",
    eligibility: "法人格を有すること。スポーツ施設の管理運営実績が3年以上あること。",
    application_method: "所定の申請書類を横浜市スポーツ振興課に持参または郵送",
    source_name: "横浜市",
  },
  {
    slug: "osaka-bunka-hall-2026",
    title: "大阪市立文化ホール指定管理者募集",
    municipality_name: "大阪市",
    prefecture: "大阪府",
    facility_category: "culture",
    facility_name: "大阪市立文化ホール",
    recruitment_status: "open",
    application_start_date: "2026-03-10",
    application_deadline: "2026-05-15",
    opening_date: "2026-03-25",
    contract_start_date: "2027-04-01",
    contract_end_date: "2032-03-31",
    summary: "大阪市立文化ホール（大ホール1,200席、小ホール300席）の指定管理者を募集。文化事業の企画・実施を含む。",
    eligibility: "法人格を有し、文化施設の管理運営実績があること。",
    application_method: "電子申請システムにて提出",
    source_name: "大阪市",
  },
  {
    slug: "nagoya-fukushi-center-2026",
    title: "名古屋市総合福祉センター管理運営業務委託",
    municipality_name: "名古屋市",
    prefecture: "愛知県",
    facility_category: "welfare",
    facility_name: "名古屋市総合福祉センター",
    recruitment_status: "upcoming",
    application_start_date: "2026-04-15",
    application_deadline: "2026-06-15",
    contract_start_date: "2027-04-01",
    contract_end_date: "2030-03-31",
    summary: "高齢者・障害者向け福祉サービスの提供を行う総合福祉センターの管理運営業務。",
    eligibility: "社会福祉法人または医療法人であること。",
    application_method: "名古屋市福祉局窓口にて申請書類を受け取り、持参にて提出",
    source_name: "名古屋市",
  },
  {
    slug: "setagaya-park-2026",
    title: "世田谷区立公園（5公園）指定管理者の公募",
    municipality_name: "世田谷区",
    prefecture: "東京都",
    facility_category: "park",
    facility_name: "世田谷区立公園（5公園一括）",
    recruitment_status: "closed",
    application_start_date: "2025-12-01",
    application_deadline: "2026-02-28",
    contract_start_date: "2026-10-01",
    contract_end_date: "2031-09-30",
    summary: "世田谷区内5箇所の区立公園の指定管理者を一括公募。維持管理、イベント企画、地域連携を含む。",
    eligibility: "法人格を有すること。公園管理の実績があること。",
    application_method: "世田谷区公園緑地課に郵送にて提出",
    source_name: "世田谷区",
  },
  {
    slug: "sapporo-community-center-2026",
    title: "札幌市地区センター（10施設）指定管理者募集",
    municipality_name: "札幌市",
    prefecture: "北海道",
    facility_category: "community",
    facility_name: "札幌市地区センター（10施設一括）",
    recruitment_status: "reviewing",
    application_start_date: "2026-01-15",
    application_deadline: "2026-03-15",
    contract_start_date: "2027-04-01",
    contract_end_date: "2032-03-31",
    summary: "札幌市内10箇所の地区センターの指定管理者を募集。地域のコミュニティ活動支援、施設管理を含む。",
    eligibility: "NPO法人、一般社団法人、株式会社等の法人格を有すること。",
    application_method: "札幌市市民文化局に持参",
    source_name: "札幌市",
  },
  {
    slug: "fukuoka-tourism-facility-2026",
    title: "福岡市観光施設管理運営業務委託",
    municipality_name: "福岡市",
    prefecture: "福岡県",
    facility_category: "tourism",
    facility_name: "福岡市観光情報センター・宿泊交流施設",
    recruitment_status: "open",
    application_start_date: "2026-03-20",
    application_deadline: "2026-04-20",
    contract_start_date: "2026-10-01",
    contract_end_date: "2031-09-30",
    summary: "観光情報の提供、宿泊交流施設の管理運営、観光プロモーション企画の実施。",
    eligibility: "観光事業の企画運営実績を有する法人。",
    application_method: "福岡市観光文化局観光振興課に電子メールにて提出",
    source_name: "福岡市",
  },
  {
    slug: "chiba-waste-facility-2026",
    title: "千葉市清掃工場運転管理業務委託",
    municipality_name: "千葉市",
    prefecture: "千葉県",
    facility_category: "waste",
    facility_name: "千葉市新港清掃工場",
    recruitment_status: "decided",
    application_start_date: "2025-10-01",
    application_deadline: "2025-12-15",
    contract_start_date: "2026-04-01",
    contract_end_date: "2031-03-31",
    summary: "新港清掃工場（処理能力1,350t/日）の運転管理業務。定期修繕計画の策定を含む。",
    eligibility: "ごみ焼却施設の運転管理実績が5年以上ある法人。",
    application_method: "千葉市環境局に持参",
    source_name: "千葉市",
  },
  {
    slug: "shibuya-education-2026",
    title: "渋谷区生涯学習センター指定管理者の募集",
    municipality_name: "渋谷区",
    prefecture: "東京都",
    facility_category: "education",
    facility_name: "渋谷区生涯学習センター",
    recruitment_status: "open",
    application_start_date: "2026-03-05",
    application_deadline: "2026-04-10",
    opening_date: "2026-03-12",
    contract_start_date: "2027-04-01",
    contract_end_date: "2032-03-31",
    summary: "生涯学習講座の企画・運営、施設の貸出管理、地域連携事業の実施。",
    eligibility: "教育事業または生涯学習事業の実績を有する法人。",
    application_method: "渋谷区教育委員会に持参",
    source_name: "渋谷区",
  },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM shitei_items").run();
    console.log("shitei_items cleared");
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO shitei_items
      (slug, title, municipality_name, prefecture, facility_category, facility_name,
       recruitment_status, application_start_date, application_deadline,
       opening_date, contract_start_date, contract_end_date, summary,
       eligibility, application_method, detail_url, source_name, source_url,
       attachment_count, notes, is_published, created_at, updated_at)
    VALUES
      (@slug, @title, @municipality_name, @prefecture, @facility_category, @facility_name,
       @recruitment_status, @application_start_date, @application_deadline,
       @opening_date, @contract_start_date, @contract_end_date, @summary,
       @eligibility, @application_method, @detail_url, @source_name, @source_url,
       @attachment_count, @notes, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const item of SEED) {
    const result = insert.run({
      detail_url: null, source_url: null, opening_date: null,
      attachment_count: 0, notes: null,
      ...item,
    });
    if (result.changes > 0) inserted++;
  }
  console.log(`shitei_items: ${inserted}/${SEED.length} inserted (duplicates skipped)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
