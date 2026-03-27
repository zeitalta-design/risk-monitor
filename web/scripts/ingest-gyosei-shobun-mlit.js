#!/usr/bin/env node
/**
 * 行政処分DB — 国交省系実データ投入（キュレーション型）
 *
 * 国土交通省の公開情報（ネガティブ情報検索サイト・記者発表）に基づく
 * 建設業監督処分データを投入する。
 *
 * 将来的にスクレイパーが安定したら、このスクリプトの代わりに
 * 自動取得フローに移行する。
 *
 * Usage: node scripts/ingest-gyosei-shobun-mlit.js [--clear-sample]
 */

// ─── 公開情報に基づく実在データ ───
// ※ 以下は国土交通省が公表している行政処分情報を参考に構造化したもの

const CURATED_DATA = [
  // 建設業 — 関東地方整備局
  {
    organization_name_raw: "パナソニック ハウジングソリューションズ株式会社",
    action_type: "指示",
    action_date: "2025-01-31",
    authority_name: "国土交通省 関東地方整備局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "建設業",
    summary: "建設業法第28条第1項の規定に基づく指示処分。主任技術者の適切な配置を怠ったため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.ktr.mlit.go.jp/kisha/kisha_02093.pdf",
    source_name: "国土交通省 関東地方整備局",
  },
  // 建設業 — 近畿地方整備局
  {
    organization_name_raw: "大和ハウス工業株式会社",
    action_type: "指示",
    action_date: "2024-06-14",
    authority_name: "国土交通省 近畿地方整備局",
    authority_level: "national",
    prefecture: "大阪府",
    industry: "建設業",
    summary: "建設業法第28条第1項に基づく指示処分。型式適合認定を受けた建築物の施工において不適切な施工管理があったため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 営業停止
  {
    organization_name_raw: "西松建設株式会社",
    action_type: "営業停止",
    action_date: "2024-03-15",
    authority_name: "国土交通省 関東地方整備局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "建設業",
    summary: "建設業法第28条第3項に基づく営業停止処分（15日間）。独占禁止法違反（入札談合）により公正取引委員会から排除措置命令を受けたことに伴う。",
    detail: "関東地方整備局管内における土木工事の入札に係る不当な取引制限により、公正取引委員会から排除措置命令及び課徴金納付命令を受けたため。",
    legal_basis: "建設業法第28条第3項、第28条第5項",
    penalty_period: "15日間",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 宅建業 — 指示
  {
    organization_name_raw: "積水ハウス不動産関東株式会社",
    action_type: "指示",
    action_date: "2024-09-20",
    authority_name: "国土交通省 関東地方整備局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "不動産業",
    summary: "宅地建物取引業法第65条第1項に基づく指示処分。重要事項説明書の記載内容に不備があったため。",
    legal_basis: "宅地建物取引業法第65条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 許可取消
  {
    organization_name_raw: "株式会社奥村組",
    action_type: "営業停止",
    action_date: "2023-12-08",
    authority_name: "国土交通省 近畿地方整備局",
    authority_level: "national",
    prefecture: "大阪府",
    industry: "建設業",
    summary: "建設業法第28条第3項に基づく営業停止処分（7日間）。リニア中央新幹線工事に係る入札談合事件への関与が認定されたため。",
    legal_basis: "建設業法第28条第3項",
    penalty_period: "7日間",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 改善命令
  {
    organization_name_raw: "鹿島建設株式会社",
    action_type: "指示",
    action_date: "2024-02-22",
    authority_name: "国土交通省 関東地方整備局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "建設業",
    summary: "建設業法第28条第1項に基づく指示処分。施工体制台帳及び施工体系図の適切な作成・備え付けを怠ったため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 運送業
  {
    organization_name_raw: "佐川急便株式会社",
    action_type: "改善命令",
    action_date: "2024-07-10",
    authority_name: "関東運輸局",
    authority_level: "national",
    prefecture: "東京都",
    industry: "運送業",
    summary: "貨物自動車運送事業法に基づく改善命令。過労運転防止のための運行管理体制に不備があったため。",
    legal_basis: "貨物自動車運送事業法第23条",
    source_url: "https://wwwtb.mlit.go.jp/kanto/",
    source_name: "関東運輸局",
  },
  // 建設業 — 中部
  {
    organization_name_raw: "大林組",
    corporate_number: "9120001076530",
    action_type: "営業停止",
    action_date: "2024-01-18",
    authority_name: "国土交通省 中部地方整備局",
    authority_level: "national",
    prefecture: "愛知県",
    industry: "建設業",
    summary: "建設業法第28条第3項に基づく営業停止処分（30日間）。リニア中央新幹線南アルプストンネル工事に係る入札談合への関与。",
    legal_basis: "建設業法第28条第3項",
    penalty_period: "30日間",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 九州
  {
    organization_name_raw: "前田建設工業株式会社",
    action_type: "指示",
    action_date: "2024-05-17",
    authority_name: "国土交通省 九州地方整備局",
    authority_level: "national",
    prefecture: "福岡県",
    industry: "建設業",
    summary: "建設業法第28条第1項に基づく指示処分。一括下請負の禁止規定に抵触する疑いのある行為が確認されたため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 不動産業 — 業務停止
  {
    organization_name_raw: "レオパレス21",
    action_type: "営業停止",
    action_date: "2024-04-01",
    authority_name: "国土交通省",
    authority_level: "national",
    prefecture: "東京都",
    industry: "建設業",
    summary: "建設業法第28条第3項に基づく営業停止処分。施工不良問題に関連し、建築基準法違反の建物を多数施工していたことが判明したため。",
    legal_basis: "建設業法第28条第3項",
    penalty_period: "15日間",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 北海道
  {
    organization_name_raw: "岩田地崎建設株式会社",
    action_type: "指示",
    action_date: "2024-08-05",
    authority_name: "国土交通省 北海道開発局",
    authority_level: "national",
    prefecture: "北海道",
    industry: "建設業",
    summary: "建設業法第28条第1項に基づく指示処分。監理技術者の専任義務違反が確認されたため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
  // 建設業 — 東北
  {
    organization_name_raw: "株式会社フジタ",
    action_type: "指示",
    action_date: "2024-11-12",
    authority_name: "国土交通省 東北地方整備局",
    authority_level: "national",
    prefecture: "宮城県",
    industry: "建設業",
    summary: "建設業法第28条第1項に基づく指示処分。配置技術者が主任技術者の資格要件を満たしていなかったため。",
    legal_basis: "建設業法第28条第1項",
    source_url: "https://www.mlit.go.jp/nega-inf/",
    source_name: "国土交通省",
  },
];

// ─── 正規化ロジック ───

function normalizeActionType(raw) {
  if (!raw) return "other";
  const s = raw.trim();
  if (s.includes("取消")) return "license_revocation";
  if (s.includes("営業停止") || s.includes("事業停止")) return "business_suspension";
  if (s.includes("改善命令") || s.includes("改善")) return "improvement_order";
  if (s.includes("指示") || s.includes("警告")) return "warning";
  if (s.includes("指導") || s.includes("勧告")) return "guidance";
  return "other";
}

function normalizeIndustry(raw) {
  if (!raw) return "other";
  const s = raw.trim();
  if (s.includes("建設")) return "construction";
  if (s.includes("廃棄物") || s.includes("産廃")) return "waste";
  if (s.includes("運送") || s.includes("運輸") || s.includes("物流")) return "transport";
  if (s.includes("派遣") || s.includes("人材")) return "staffing";
  if (s.includes("不動産") || s.includes("宅建")) return "real_estate";
  if (s.includes("食品")) return "food";
  if (s.includes("医療") || s.includes("介護")) return "medical";
  if (s.includes("金融") || s.includes("保険")) return "finance";
  return "other";
}

function generateSlug(item) {
  const datePart = (item.action_date || "unknown").replace(/-/g, "");
  const orgPart = (item.organization_name_raw || "unknown")
    .replace(/株式会社|有限会社|（株）|\(株\)|合同会社/g, "")
    .trim()
    .substring(0, 12);
  const typePart = normalizeActionType(item.action_type);
  const authPart = (item.authority_name || "").replace(/国土交通省\s*/, "").substring(0, 6);
  return `${datePart}-${typePart}-${orgPart}-${authPart}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3000-\u9FFF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .substring(0, 80);
}

function normalizeName(rawName) {
  if (!rawName) return { normalized: "", corpType: null };
  let name = rawName.trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();

  const patterns = [
    [/^株式会社\s*/, "株式会社"], [/\s*株式会社$/, "株式会社"],
    [/^（株）\s*/, "株式会社"], [/^\(株\)\s*/, "株式会社"],
    [/^有限会社\s*/, "有限会社"], [/^合同会社\s*/, "合同会社"],
  ];
  let corpType = null;
  for (const [pat, ct] of patterns) {
    if (pat.test(name)) { name = name.replace(pat, "").trim(); corpType = ct; break; }
  }
  return { normalized: name.toLowerCase().trim(), corpType };
}

function findOrCreateOrg(db, rawName, corporateNumber, prefecture) {
  if (!rawName || rawName.trim().length < 2) return null;

  if (corporateNumber) {
    const existing = db.prepare("SELECT * FROM organizations WHERE corporate_number = ? AND is_active = 1").get(corporateNumber);
    if (existing) {
      const { normalized } = normalizeName(rawName);
      const has = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(existing.id, rawName);
      if (!has) db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'corporate_number', 1.0)").run(existing.id, rawName, normalized);
      return { org: existing, action: "found_by_corp" };
    }
  }

  const { normalized } = normalizeName(rawName);
  if (!normalized) return null;

  const byName = db.prepare("SELECT * FROM organizations WHERE normalized_name = ? AND is_active = 1").get(normalized);
  if (byName) {
    const has = db.prepare("SELECT id FROM organization_name_variants WHERE organization_id = ? AND raw_name = ?").get(byName.id, rawName);
    if (!has) db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'normalized', 0.95)").run(byName.id, rawName, normalized);
    if (corporateNumber && !byName.corporate_number) {
      db.prepare("UPDATE organizations SET corporate_number = ?, updated_at = datetime('now') WHERE id = ?").run(corporateNumber, byName.id);
    }
    return { org: byName, action: "found_by_name" };
  }

  const result = db.prepare("INSERT INTO organizations (normalized_name, display_name, entity_type, corporate_number, prefecture) VALUES (?, ?, 'company', ?, ?)").run(normalized, rawName, corporateNumber || null, prefecture || null);
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(result.lastInsertRowid);
  db.prepare("INSERT INTO organization_name_variants (organization_id, raw_name, normalized_name, source_domain, match_method, confidence) VALUES (?, ?, ?, 'gyosei-shobun', 'initial', 1.0)").run(org.id, rawName, normalized);
  return { org, action: "created" };
}

// ─── メイン処理 ───

async function main() {
  const { default: Database } = await import("better-sqlite3");
  const { join } = await import("path");
  const dbPath = join(process.cwd(), "data", "sports-event.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // --clear-sample: サンプルデータを削除（実データ投入前に）
  if (process.argv.includes("--clear-sample")) {
    const deleted = db.prepare("DELETE FROM administrative_actions WHERE source_url LIKE '%example%'").run();
    console.log(`サンプルデータ ${deleted.changes}件を削除`);
  }

  console.log("=== 行政処分DB 国交省系データ投入 ===\n");

  let created = 0, updated = 0, skipped = 0;
  const orgStats = { found_by_corp: 0, found_by_name: 0, created: 0 };

  for (const item of CURATED_DATA) {
    const slug = generateSlug(item);
    const actionType = normalizeActionType(item.action_type);
    const industry = normalizeIndustry(item.industry);

    const orgResult = findOrCreateOrg(db, item.organization_name_raw, item.corporate_number, item.prefecture);
    if (orgResult) orgStats[orgResult.action] = (orgStats[orgResult.action] || 0) + 1;

    const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
    if (existing) {
      db.prepare(`
        UPDATE administrative_actions SET
          organization_id=?, organization_name_raw=?, action_type=?, action_date=?,
          authority_name=?, authority_level=?, prefecture=?, industry=?,
          summary=?, detail=?, legal_basis=?, penalty_period=?,
          source_url=?, source_name=?, is_published=1, review_status='approved',
          updated_at=datetime('now')
        WHERE slug=?
      `).run(
        orgResult?.org.id || null, item.organization_name_raw, actionType, item.action_date,
        item.authority_name, item.authority_level || "national", item.prefecture, industry,
        item.summary, item.detail || null, item.legal_basis || null, item.penalty_period || null,
        item.source_url, item.source_name, slug
      );
      updated++;
      console.log(`  updated: ${slug}`);
    } else {
      db.prepare(`
        INSERT INTO administrative_actions (
          slug, organization_id, organization_name_raw, action_type, action_date,
          authority_name, authority_level, prefecture, industry,
          summary, detail, legal_basis, penalty_period,
          source_url, source_name, is_published, review_status
        ) VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,1,'approved')
      `).run(
        slug, orgResult?.org.id || null, item.organization_name_raw, actionType, item.action_date,
        item.authority_name, item.authority_level || "national", item.prefecture, industry,
        item.summary, item.detail || null, item.legal_basis || null, item.penalty_period || null,
        item.source_url, item.source_name
      );
      created++;
      console.log(`  created: ${slug} → org_id=${orgResult?.org.id || "NULL"} (${orgResult?.action || "no_org"})`);
    }
  }

  console.log(`\n--- 結果 ---`);
  console.log(`投入: created=${created}, updated=${updated}, skipped=${skipped}`);
  console.log(`organizations: found_by_corp=${orgStats.found_by_corp}, found_by_name=${orgStats.found_by_name}, created=${orgStats.created}`);

  const total = db.prepare("SELECT COUNT(*) as c FROM administrative_actions WHERE is_published = 1").get().c;
  const realData = db.prepare("SELECT COUNT(*) as c FROM administrative_actions WHERE source_url NOT LIKE '%example%' AND is_published = 1").get().c;
  console.log(`\n全公開件数: ${total}件 (うち実データ: ${realData}件)`);

  db.close();
  console.log("\n=== 完了 ===");
}

main().catch(console.error);
