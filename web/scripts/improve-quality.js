#!/usr/bin/env node
/**
 * 4ドメイン品質改善スクリプト
 *
 * Usage:
 *   node scripts/improve-quality.js food-recall   # food-recall の品質改善
 *   node scripts/improve-quality.js sanpai         # sanpai の品質改善
 *   node scripts/improve-quality.js kyoninka       # kyoninka の品質改善
 *   node scripts/improve-quality.js shitei         # shitei の品質改善
 *   node scripts/improve-quality.js all            # 全ドメイン
 *   node scripts/improve-quality.js status         # 品質スコア表示
 */

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || "status";

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (target === "status") { showQuality(db); return; }
  if (target === "all") {
    improveFoodRecall(db);
    improveSanpai(db);
    improveKyoninka(db);
    improveShitei(db);
    showQuality(db);
    return;
  }
  if (target === "food-recall") { improveFoodRecall(db); return; }
  if (target === "sanpai") { improveSanpai(db); return; }
  if (target === "kyoninka") { improveKyoninka(db); return; }
  if (target === "shitei") { improveShitei(db); return; }

  console.log("Usage: improve-quality.js <food-recall|sanpai|kyoninka|shitei|all|status>");
}

// ─── food-recall ─────────────────────

function improveFoodRecall(db) {
  console.log("\n=== food-recall 品質改善 ===\n");

  // 1. AI抽出結果から summary を改善（reason_detail があれば使用）
  const aiExts = db.prepare("SELECT * FROM ai_extractions WHERE domain_id = 'food-recall'").all();
  let summaryImproved = 0;

  for (const ext of aiExts) {
    if (!ext.entity_id) continue;
    const data = JSON.parse(ext.extracted_json || "{}");
    const item = db.prepare("SELECT * FROM food_recall_items WHERE id = ?").get(ext.entity_id);
    if (!item) continue;

    // summary 改善: reason_detail を使った具体的な要約
    if (data.reason_detail && (!item.summary || item.summary.includes("リコール・自主回収情報"))) {
      const reason = data.reason_detail.replace(/\\/g, "").replace(/\n/g, " ").trim().substring(0, 150);
      const newSummary = `${item.manufacturer || ""}「${item.product_name}」— ${reason}`;
      db.prepare("UPDATE food_recall_items SET summary = ? WHERE id = ?").run(newSummary, item.id);
      summaryImproved++;
    }

    // consumer_action / lot_number / contact_info の空補完
    for (const field of ["consumer_action", "lot_number"]) {
      if (data[field] && (!item[field] || item[field] === "—")) {
        const val = data[field].replace(/\\/g, "").replace(/\n/g, " ").trim().substring(0, 500);
        if (val.length > 3) {
          db.prepare(`UPDATE food_recall_items SET ${field} = ? WHERE id = ?`).run(val, item.id);
        }
      }
    }
  }
  console.log(`  summary改善: ${summaryImproved}件`);

  // 2. risk_level = unknown → recall_type に基づく推定
  const unknownRisk = db.prepare("SELECT * FROM food_recall_items WHERE risk_level = 'unknown'").all();
  let riskImproved = 0;
  for (const item of unknownRisk) {
    let newRisk = "unknown";
    if (item.recall_type === "recall") newRisk = "class1"; // 回収命令 = 重篤
    else if (item.reason === "allergen" || item.reason === "microbe") newRisk = "class2";
    else if (item.reason === "foreign_matter" || item.reason === "chemical") newRisk = "class2";
    else if (item.reason === "labeling" || item.reason === "quality") newRisk = "class3";
    if (newRisk !== "unknown") {
      db.prepare("UPDATE food_recall_items SET risk_level = ? WHERE id = ?").run(newRisk, item.id);
      riskImproved++;
    }
  }
  console.log(`  risk_level改善: ${riskImproved}件`);

  // 3. category = other → product_name から推定
  const otherCat = db.prepare("SELECT * FROM food_recall_items WHERE category = 'other'").all();
  let catImproved = 0;
  for (const item of otherCat) {
    const name = (item.product_name || "").toLowerCase();
    let newCat = "other";
    if (name.match(/チョコ|菓子|クッキー|ケーキ|スナック|飴|ガム/)) newCat = "confectionery";
    else if (name.match(/飲料|ジュース|茶|コーヒー|水|ビール|酒/)) newCat = "beverage";
    else if (name.match(/乳|牛乳|ヨーグルト|チーズ|バター/)) newCat = "dairy";
    else if (name.match(/冷凍|アイス/)) newCat = "frozen";
    else if (name.match(/味噌|醤油|ソース|調味|塩|砂糖|酢/)) newCat = "seasoning";
    else if (name.match(/サプリ|プロテイン|健康|ビタミン|紅麹|ナットウ/)) newCat = "supplement";
    else if (name.match(/野菜|果物|魚|肉|卵|生鮮|鮮/)) newCat = "fresh";
    else if (name.match(/缶|レトルト|加工|ハム|ソーセージ|弁当|おにぎり|めし|カレー|ドッグ/)) newCat = "processed";
    // 非食品は other のまま
    else if (name.match(/電池|充電|バッテリー|化粧|クレンジング|ペンシル|チューブ|点眼/)) newCat = "other";
    if (newCat !== "other") {
      db.prepare("UPDATE food_recall_items SET category = ? WHERE id = ?").run(newCat, item.id);
      catImproved++;
    }
  }
  console.log(`  category改善: ${catImproved}件`);
}

// ─── sanpai ─────────────────────

function improveSanpai(db) {
  console.log("\n=== sanpai 品質改善 ===\n");

  // penalty_count / latest_penalty_date / risk_level の再計算
  const items = db.prepare("SELECT id FROM sanpai_items").all();
  let statsFixed = 0;

  for (const item of items) {
    const penalties = db.prepare("SELECT * FROM sanpai_penalties WHERE sanpai_item_id = ? ORDER BY penalty_date DESC").all(item.id);
    const count = penalties.length;
    const latestDate = penalties[0]?.penalty_date || null;

    let riskLevel = "none";
    if (count > 0) {
      const types = penalties.map(p => p.penalty_type);
      if (types.includes("license_revocation")) riskLevel = "critical";
      else if (types.includes("business_suspension")) riskLevel = "high";
      else if (types.includes("improvement_order")) riskLevel = "medium";
      else riskLevel = "low";
    }

    const current = db.prepare("SELECT penalty_count, latest_penalty_date, risk_level FROM sanpai_items WHERE id = ?").get(item.id);
    if (current.penalty_count !== count || current.latest_penalty_date !== latestDate || current.risk_level !== riskLevel) {
      db.prepare("UPDATE sanpai_items SET penalty_count = ?, latest_penalty_date = ?, risk_level = ? WHERE id = ?")
        .run(count, latestDate, riskLevel, item.id);
      statsFixed++;
    }
  }
  console.log(`  stats再計算: ${statsFixed}件`);

  // penalty summary の改善（空の場合）
  const emptySummary = db.prepare("SELECT * FROM sanpai_penalties WHERE summary IS NULL OR summary = ''").all();
  let summaryFixed = 0;
  for (const p of emptySummary) {
    const summary = `${p.authority_name || "行政庁"}による${getPenaltyLabel(p.penalty_type)}`;
    db.prepare("UPDATE sanpai_penalties SET summary = ? WHERE id = ?").run(summary, p.id);
    summaryFixed++;
  }
  console.log(`  penalty summary補完: ${summaryFixed}件`);
}

// ─── kyoninka ─────────────────────

function improveKyoninka(db) {
  console.log("\n=== kyoninka 品質改善 ===\n");

  // registration_count / primary_license_family の再計算
  const entities = db.prepare("SELECT id FROM kyoninka_entities").all();
  let statsFixed = 0;

  for (const entity of entities) {
    const regs = db.prepare("SELECT * FROM kyoninka_registrations WHERE entity_id = ?").all(entity.id);
    const count = regs.length;

    // primary_license_family: 最も多い family
    const familyCounts = {};
    regs.forEach(r => { familyCounts[r.license_family] = (familyCounts[r.license_family] || 0) + 1; });
    const primaryFamily = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

    const current = db.prepare("SELECT registration_count, primary_license_family FROM kyoninka_entities WHERE id = ?").get(entity.id);
    if (current.registration_count !== count || current.primary_license_family !== primaryFamily) {
      db.prepare("UPDATE kyoninka_entities SET registration_count = ?, primary_license_family = ? WHERE id = ?")
        .run(count, primaryFamily, entity.id);
      statsFixed++;
    }
  }
  console.log(`  stats再計算: ${statsFixed}件`);
}

// ─── shitei ─────────────────────

function improveShitei(db) {
  console.log("\n=== shitei 品質改善 ===\n");

  // recruitment_status の再計算（期限切れを closed に）
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const items = db.prepare("SELECT * FROM shitei_items WHERE recruitment_status = 'open' AND application_deadline IS NOT NULL").all();
  let statusFixed = 0;

  for (const item of items) {
    const deadline = new Date(item.application_deadline);
    deadline.setHours(23, 59, 59, 999);
    if (deadline < now) {
      db.prepare("UPDATE shitei_items SET recruitment_status = 'closed' WHERE id = ?").run(item.id);
      statusFixed++;
    }
  }
  console.log(`  期限切れ→closed: ${statusFixed}件`);

  // facility_category の改善（other → 推定）
  const otherCat = db.prepare("SELECT * FROM shitei_items WHERE facility_category = 'other'").all();
  let catFixed = 0;
  for (const item of otherCat) {
    const title = (item.title || "") + " " + (item.facility_name || "");
    let cat = "other";
    if (title.match(/体育|プール|競技|運動|スポーツ|球場|テニス|武道|アイス|弓道|陸上/)) cat = "sports";
    else if (title.match(/ホール|美術|博物|図書|劇場|文化|芸術|創造/)) cat = "culture";
    else if (title.match(/福祉|介護|障害|高齢|保育|児童|みらい|のぞみ|学園|指導/)) cat = "welfare";
    else if (title.match(/公園|緑地|庭園|メモリアル|墓|霊園|納骨/)) cat = "park";
    else if (title.match(/住宅|駐車|駐輪/)) cat = "housing";
    else if (title.match(/教育|学習|学校|研修/)) cat = "education";
    else if (title.match(/センター|集会|市民|公民|区民/)) cat = "community";
    else if (title.match(/斎場|葬祭|トンネル|道路|港湾|労働者/)) cat = "other"; // 意図的にother
    if (cat !== "other") {
      db.prepare("UPDATE shitei_items SET facility_category = ? WHERE id = ?").run(cat, item.id);
      catFixed++;
    }
  }
  console.log(`  category改善: ${catFixed}件`);
}

function showQuality(db) {
  console.log("\n=== 品質スコア ===\n");

  // food-recall
  const fr = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN summary IS NOT NULL AND summary NOT LIKE '%リコール・自主回収情報%' THEN 1 ELSE 0 END) as good_summary, SUM(CASE WHEN category != 'other' THEN 1 ELSE 0 END) as good_cat, SUM(CASE WHEN risk_level != 'unknown' THEN 1 ELSE 0 END) as good_risk FROM food_recall_items").get();
  console.log(`food-recall: ${fr.total}件`);
  console.log(`  summary品質: ${fr.good_summary}/${fr.total} (${Math.round(fr.good_summary/fr.total*100)}%)`);
  console.log(`  category品質: ${fr.good_cat}/${fr.total} (${Math.round(fr.good_cat/fr.total*100)}%)`);
  console.log(`  risk_level品質: ${fr.good_risk}/${fr.total} (${Math.round(fr.good_risk/fr.total*100)}%)`);

  // sanpai
  const sp = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN penalty_count > 0 THEN 1 ELSE 0 END) as has_penalty FROM sanpai_items").get();
  const spPen = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as has_summary FROM sanpai_penalties").get();
  console.log(`\nsanpai: ${sp.total}件`);
  console.log(`  penalty紐づけ: ${sp.has_penalty}/${sp.total} (${Math.round(sp.has_penalty/sp.total*100)}%)`);
  console.log(`  penalty summary: ${spPen.has_summary}/${spPen.total} (${Math.round(spPen.has_summary/spPen.total*100)}%)`);

  // kyoninka
  const ky = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN registration_count > 0 THEN 1 ELSE 0 END) as has_reg FROM kyoninka_entities").get();
  console.log(`\nkyoninka: ${ky.total}件`);
  console.log(`  registration紐づけ: ${ky.has_reg}/${ky.total} (${Math.round(ky.has_reg/ky.total*100)}%)`);

  // shitei
  const sh = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN facility_category != 'other' THEN 1 ELSE 0 END) as good_cat, SUM(CASE WHEN recruitment_status != 'unknown' THEN 1 ELSE 0 END) as good_status FROM shitei_items WHERE is_published = 1").get();
  console.log(`\nshitei: ${sh.total}件`);
  console.log(`  category品質: ${sh.good_cat}/${sh.total} (${Math.round(sh.good_cat/sh.total*100)}%)`);
  console.log(`  status品質: ${sh.good_status}/${sh.total} (${Math.round(sh.good_status/sh.total*100)}%)`);
}

function getPenaltyLabel(type) {
  const labels = { license_revocation: "許可取消処分", business_suspension: "事業停止命令", improvement_order: "改善命令", warning: "警告", guidance: "行政指導" };
  return labels[type] || type || "行政処分";
}

main().catch((err) => { console.error(err); process.exit(1); });
