#!/usr/bin/env node
/**
 * 食品リコール監視 seed — 仮データを food_recall_items テーブルに投入
 * Usage: node scripts/seed-food-recall.js [--clear]
 */

const SEED = [
  { slug: "dairy-milk-microbe-2026-03", product_name: "〇〇牛乳 1000ml", manufacturer: "〇〇乳業株式会社", category: "dairy", recall_type: "voluntary", reason: "microbe", risk_level: "class2", affected_area: "関東地方", lot_number: "LOT2026-0301", recall_date: "2026-03-20", status: "active", consumer_action: "該当商品をお持ちの方は、飲用せずに販売店にご返品ください。", summary: "微生物検査において一般生菌数が規格値を超過していることが判明したため、自主回収を実施。" },
  { slug: "choco-bar-allergen-2026-03", product_name: "△△チョコレートバー 12本入", manufacturer: "△△製菓株式会社", category: "confectionery", recall_type: "recall", reason: "allergen", risk_level: "class1", affected_area: "全国", lot_number: "CH-2026-A1〜A5", recall_date: "2026-03-18", status: "active", consumer_action: "アレルギー（小麦）をお持ちの方は絶対に食べないでください。送料着払いにて返品を受け付けます。", summary: "原材料に小麦を使用しているにもかかわらず、アレルギー表示が欠落していたため緊急リコール。" },
  { slug: "frozen-gyoza-metal-2026-03", product_name: "□□冷凍餃子 20個入", manufacturer: "□□食品工業株式会社", category: "frozen", recall_type: "voluntary", reason: "foreign_matter", risk_level: "class2", affected_area: "全国", lot_number: "GZ-2026-0315", recall_date: "2026-03-15", status: "active", consumer_action: "食べずにお近くの店舗に返品してください。", summary: "製造ラインの部品が破損し、金属片が混入した可能性があるため自主回収。" },
  { slug: "green-tea-quality-2026-03", product_name: "◇◇緑茶 500ml ペットボトル", manufacturer: "◇◇飲料株式会社", category: "beverage", recall_type: "voluntary", reason: "quality", risk_level: "class3", affected_area: "近畿地方", lot_number: "GT-2026-0310A", recall_date: "2026-03-12", status: "completed", consumer_action: "変色が確認された場合は飲用せず、お客様相談窓口までご連絡ください。", summary: "一部ロットにおいて、保管条件の逸脱により変色が確認されたため自主回収。健康被害の報告なし。" },
  { slug: "protein-bar-labeling-2026-03", product_name: "☆☆プロテインバー ストロベリー味", manufacturer: "☆☆ヘルスケア株式会社", category: "supplement", recall_type: "voluntary", reason: "labeling", risk_level: "class3", affected_area: "全国", lot_number: "PB-2026-0201〜0228", recall_date: "2026-03-10", status: "active", consumer_action: "栄養成分表示に誤りがありました。正しい表示は弊社ウェブサイトをご確認ください。", summary: "栄養成分表示において、たんぱく質含有量の数値に誤りがあったため自主回収。" },
  { slug: "miso-mold-2026-03", product_name: "◎◎味噌 赤だし 750g", manufacturer: "◎◎醸造株式会社", category: "seasoning", recall_type: "voluntary", reason: "microbe", risk_level: "class2", affected_area: "中部地方", lot_number: "MS-2026-0220", recall_date: "2026-03-08", status: "investigating", consumer_action: "該当ロットの使用を中止し、最寄りの販売店にご返品ください。", summary: "自社検査で基準値を超えるカビ毒が検出されたため自主回収。原因調査中。" },
  { slug: "cut-veg-pesticide-2026-03", product_name: "★★カット野菜ミックス 200g", manufacturer: "★★フレッシュ株式会社", category: "fresh", recall_type: "alert", reason: "chemical", risk_level: "class2", affected_area: "関東・東北地方", lot_number: "VG-2026-0305A", recall_date: "2026-03-05", status: "completed", consumer_action: "対象商品をお持ちの方はお召し上がりにならないでください。返金対応いたします。", summary: "使用原料から基準値を超える残留農薬が検出されたため、注意喚起・回収を実施。回収完了済み。" },
  { slug: "mixed-nuts-allergen-2026-03", product_name: "●●ミックスナッツ 大袋 500g", manufacturer: "●●商事株式会社", category: "processed", recall_type: "voluntary", reason: "allergen", risk_level: "class1", affected_area: "全国", lot_number: "MN-2026-FEB", recall_date: "2026-03-01", status: "active", consumer_action: "カシューナッツアレルギーの方は絶対に食べないでください。無料回収: 0120-XXX-XXX", summary: "「カシューナッツ不使用」と表示していたが、製造ラインの切替不備によりカシューナッツが混入した可能性。" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM food_recall_items").run();
    console.log("food_recall_items cleared");
  }
  const insert = db.prepare(`
    INSERT OR IGNORE INTO food_recall_items
      (slug, product_name, manufacturer, category, recall_type, reason, risk_level,
       affected_area, lot_number, recall_date, status, consumer_action, summary,
       source_url, manufacturer_url, is_published, created_at, updated_at)
    VALUES
      (@slug, @product_name, @manufacturer, @category, @recall_type, @reason, @risk_level,
       @affected_area, @lot_number, @recall_date, @status, @consumer_action, @summary,
       @source_url, @manufacturer_url, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const item of SEED) {
    const result = insert.run({ source_url: null, manufacturer_url: null, ...item });
    if (result.changes > 0) inserted++;
  }
  console.log(`food_recall_items: ${inserted}/${SEED.length} inserted (duplicates skipped)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
