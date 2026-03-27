#!/usr/bin/env node
/**
 * 産廃処分ウォッチ seed — 仮データを sanpai_items + sanpai_penalties テーブルに投入
 * Usage: node scripts/seed-sanpai.js [--clear]
 */

const SEED_ITEMS = [
  {
    slug: "tokyo-abc-sanpai",
    company_name: "ABC産業廃棄物処理株式会社",
    corporate_number: "1234567890123",
    prefecture: "東京都",
    city: "江東区",
    license_type: "collection_transport",
    waste_category: "industrial",
    business_area: "関東地方一円",
    status: "active",
    risk_level: "high",
    penalty_count: 2,
    latest_penalty_date: "2026-02-15",
    source_name: "東京都環境局",
    notes: "過去に事業停止命令を受けた実績あり。改善措置完了後に営業再開。",
  },
  {
    slug: "osaka-xyz-kankyo",
    company_name: "XYZ環境サービス株式会社",
    corporate_number: "9876543210987",
    prefecture: "大阪府",
    city: "堺市",
    license_type: "intermediate",
    waste_category: "industrial",
    business_area: "近畿地方一円",
    status: "suspended",
    risk_level: "critical",
    penalty_count: 3,
    latest_penalty_date: "2026-03-01",
    source_name: "大阪府環境農林水産部",
    notes: "不法投棄が確認され許可取消処分を受けた。現在事業停止中。",
  },
  {
    slug: "aichi-midori-shigen",
    company_name: "みどり資源リサイクル株式会社",
    corporate_number: "5678901234567",
    prefecture: "愛知県",
    city: "名古屋市",
    license_type: "final_disposal",
    waste_category: "industrial",
    business_area: "中部地方一円",
    status: "active",
    risk_level: "medium",
    penalty_count: 1,
    latest_penalty_date: "2025-11-20",
    source_name: "愛知県環境局",
    notes: "処分場の管理基準違反で改善命令を受けたが、是正措置完了済み。",
  },
  {
    slug: "fukuoka-kyushu-haikibutsu",
    company_name: "九州廃棄物管理センター株式会社",
    corporate_number: "1111222233334",
    prefecture: "福岡県",
    city: "北九州市",
    license_type: "special_collection",
    waste_category: "special_industrial",
    business_area: "九州全域",
    status: "active",
    risk_level: "low",
    penalty_count: 1,
    latest_penalty_date: "2025-06-10",
    source_name: "福岡県環境部",
    notes: "特別管理産業廃棄物の収集運搬における書類不備で行政指導を受けた。",
  },
  {
    slug: "hokkaido-kita-kankyo",
    company_name: "北環境開発株式会社",
    corporate_number: "4444555566667",
    prefecture: "北海道",
    city: "札幌市",
    license_type: "collection_transport",
    waste_category: "industrial",
    business_area: "北海道全域",
    status: "active",
    risk_level: "none",
    penalty_count: 0,
    latest_penalty_date: null,
    source_name: "北海道環境生活部",
    notes: "行政処分の記録なし。優良認定事業者。",
  },
  {
    slug: "saitama-kanto-shori",
    company_name: "関東総合処理株式会社",
    corporate_number: "7777888899990",
    prefecture: "埼玉県",
    city: "さいたま市",
    license_type: "intermediate",
    waste_category: "mixed",
    business_area: "埼玉県・東京都・千葉県",
    status: "revoked",
    risk_level: "critical",
    penalty_count: 4,
    latest_penalty_date: "2026-01-20",
    source_name: "埼玉県環境部",
    notes: "度重なる違反行為により許可取消処分。不法投棄・基準超過排水の複数違反。",
  },
];

const SEED_PENALTIES = [
  // ABC産業廃棄物処理 (tokyo-abc-sanpai)
  { item_slug: "tokyo-abc-sanpai", penalty_date: "2026-02-15", penalty_type: "business_suspension", authority_name: "東京都", summary: "マニフェスト（管理票）の虚偽記載が発覚。60日間の事業停止命令。", disposition_period: "60日間", source_url: null },
  { item_slug: "tokyo-abc-sanpai", penalty_date: "2025-08-10", penalty_type: "warning", authority_name: "東京都", summary: "運搬車両の表示義務違反に対する警告。", disposition_period: null, source_url: null },

  // XYZ環境サービス (osaka-xyz-kankyo)
  { item_slug: "osaka-xyz-kankyo", penalty_date: "2026-03-01", penalty_type: "license_revocation", authority_name: "大阪府", summary: "産業廃棄物の不法投棄が確認され、許可取消処分。投棄量推定500トン。", disposition_period: "許可取消", source_url: null },
  { item_slug: "osaka-xyz-kankyo", penalty_date: "2025-12-01", penalty_type: "business_suspension", authority_name: "大阪府", summary: "処理基準違反による事業停止命令（90日間）。改善措置未完了のまま期限超過。", disposition_period: "90日間", source_url: null },
  { item_slug: "osaka-xyz-kankyo", penalty_date: "2025-06-15", penalty_type: "improvement_order", authority_name: "大阪府", summary: "中間処理施設の排水基準超過に対する改善命令。", disposition_period: null, source_url: null },

  // みどり資源リサイクル (aichi-midori-shigen)
  { item_slug: "aichi-midori-shigen", penalty_date: "2025-11-20", penalty_type: "improvement_order", authority_name: "愛知県", summary: "最終処分場の浸出液処理設備の管理基準不適合に対する改善命令。是正措置完了済み。", disposition_period: null, source_url: null },

  // 九州廃棄物管理センター (fukuoka-kyushu-haikibutsu)
  { item_slug: "fukuoka-kyushu-haikibutsu", penalty_date: "2025-06-10", penalty_type: "guidance", authority_name: "福岡県", summary: "特別管理産業廃棄物の収集運搬に係る帳簿の記載不備に対する行政指導。", disposition_period: null, source_url: null },

  // 関東総合処理 (saitama-kanto-shori)
  { item_slug: "saitama-kanto-shori", penalty_date: "2026-01-20", penalty_type: "license_revocation", authority_name: "埼玉県", summary: "度重なる違反行為（不法投棄、基準超過排水、マニフェスト虚偽記載）により許可取消。", disposition_period: "許可取消", source_url: null },
  { item_slug: "saitama-kanto-shori", penalty_date: "2025-09-01", penalty_type: "business_suspension", authority_name: "埼玉県", summary: "不法投棄の疑いによる事業停止命令（180日間）。", disposition_period: "180日間", source_url: null },
  { item_slug: "saitama-kanto-shori", penalty_date: "2025-04-15", penalty_type: "improvement_order", authority_name: "埼玉県", summary: "処理施設からの排水が基準値を超過。改善命令発出。", disposition_period: null, source_url: null },
  { item_slug: "saitama-kanto-shori", penalty_date: "2024-11-01", penalty_type: "warning", authority_name: "埼玉県", summary: "廃棄物処理に係る書類の保管義務違反に対する警告。", disposition_period: null, source_url: null },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM sanpai_penalties").run();
    db.prepare("DELETE FROM sanpai_items").run();
    console.log("sanpai_items + sanpai_penalties cleared");
  }

  // Insert items
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO sanpai_items
      (slug, company_name, corporate_number, prefecture, city,
       license_type, waste_category, business_area, status,
       risk_level, penalty_count, latest_penalty_date,
       source_name, source_url, detail_url, notes,
       is_published, created_at, updated_at)
    VALUES
      (@slug, @company_name, @corporate_number, @prefecture, @city,
       @license_type, @waste_category, @business_area, @status,
       @risk_level, @penalty_count, @latest_penalty_date,
       @source_name, @source_url, @detail_url, @notes,
       1, datetime('now'), datetime('now'))
  `);

  let itemsInserted = 0;
  for (const item of SEED_ITEMS) {
    const result = insertItem.run({
      source_url: null, detail_url: null,
      ...item,
    });
    if (result.changes > 0) itemsInserted++;
  }
  console.log(`sanpai_items: ${itemsInserted}/${SEED_ITEMS.length} inserted (duplicates skipped)`);

  // Insert penalties
  const insertPenalty = db.prepare(`
    INSERT INTO sanpai_penalties
      (sanpai_item_id, penalty_date, penalty_type, authority_name, summary, disposition_period, source_url, created_at, updated_at)
    VALUES
      (@sanpai_item_id, @penalty_date, @penalty_type, @authority_name, @summary, @disposition_period, @source_url, datetime('now'), datetime('now'))
  `);

  // Only insert penalties if items were newly inserted (avoid duplicates on re-run)
  let penaltiesInserted = 0;
  if (itemsInserted > 0) {
    for (const penalty of SEED_PENALTIES) {
      const item = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(penalty.item_slug);
      if (!item) { console.log(`  SKIP penalty: item ${penalty.item_slug} not found`); continue; }
      insertPenalty.run({
        sanpai_item_id: item.id,
        penalty_date: penalty.penalty_date,
        penalty_type: penalty.penalty_type,
        authority_name: penalty.authority_name,
        summary: penalty.summary,
        disposition_period: penalty.disposition_period,
        source_url: penalty.source_url,
      });
      penaltiesInserted++;
    }
  } else {
    // Check if penalties already exist
    const existingPenalties = db.prepare("SELECT COUNT(*) as c FROM sanpai_penalties").get().c;
    if (existingPenalties === 0) {
      for (const penalty of SEED_PENALTIES) {
        const item = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(penalty.item_slug);
        if (!item) continue;
        insertPenalty.run({
          sanpai_item_id: item.id,
          penalty_date: penalty.penalty_date,
          penalty_type: penalty.penalty_type,
          authority_name: penalty.authority_name,
          summary: penalty.summary,
          disposition_period: penalty.disposition_period,
          source_url: penalty.source_url,
        });
        penaltiesInserted++;
      }
    }
  }
  console.log(`sanpai_penalties: ${penaltiesInserted} inserted`);
}

main().catch((err) => { console.error(err); process.exit(1); });
