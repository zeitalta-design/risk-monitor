/**
 * 産廃処分 取込スクリプト
 *
 * ソース1: 大阪府産廃許可取消一覧（Excel）
 *   https://www.pref.osaka.lg.jp/o120060/sangyohaiki/sanpai/torikeshishobun.html
 *
 * ソース2: 神奈川県産廃許可取消一覧（HTML テーブル）
 *   https://www.pref.kanagawa.jp/docs/p3k/cnt/f91/index.html
 *
 * 実行: node scripts/ingest-sanpai.mjs [--dry-run]
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/sports-event.db");
const DRY_RUN = process.argv.includes("--dry-run");

const db = new Database(DB_PATH);

// ─── DB upsert ─────────────────────────────────────────────

const upsertStmt = db.prepare(`
  INSERT INTO sanpai_items
    (slug, company_name, corporate_number, prefecture, city, license_type,
     waste_category, business_area, status, risk_level, penalty_count,
     latest_penalty_date, source_name, source_url, detail_url, notes,
     is_published, published_at, created_at, updated_at)
  VALUES
    (@slug, @company_name, @corporate_number, @prefecture, @city, @license_type,
     @waste_category, @business_area, @status, @risk_level, @penalty_count,
     @latest_penalty_date, @source_name, @source_url, @detail_url, @notes,
     1, datetime('now'), datetime('now'), datetime('now'))
  ON CONFLICT(slug) DO UPDATE SET
    company_name       = excluded.company_name,
    prefecture         = excluded.prefecture,
    city               = excluded.city,
    license_type       = excluded.license_type,
    waste_category     = excluded.waste_category,
    business_area      = excluded.business_area,
    status             = excluded.status,
    risk_level         = excluded.risk_level,
    penalty_count      = excluded.penalty_count,
    latest_penalty_date= excluded.latest_penalty_date,
    source_name        = excluded.source_name,
    source_url         = excluded.source_url,
    detail_url         = excluded.detail_url,
    notes              = excluded.notes,
    updated_at         = datetime('now')
`);

// ─── ユーティリティ ─────────────────────────────────────────

function toSlug(source_prefix, name, license_num = "") {
  const base = name
    .replace(/[株式会社有限会社合同会社]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40);
  const suffix = license_num ? `-${license_num.replace(/[^\w]/g, "").substring(0, 12)}` : "";
  return `${source_prefix}-${base}${suffix}`;
}

// 和暦→西暦変換
function parseJapaneseDate(str) {
  if (!str) return null;
  if (str instanceof Date) {
    return str.toISOString().slice(0, 10);
  }
  const s = String(str).trim();
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // 令和N年M月D日
  const m = s.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  // 令和N年M月
  const m2 = s.match(/令和(\d+)年(\d+)月/);
  if (m2) {
    const y = 2018 + parseInt(m2[1]);
    return `${y}-${String(m2[2]).padStart(2, "0")}-01`;
  }
  return null;
}

function normalizeLicenseType(text) {
  if (!text) return "collection_transport";
  const t = String(text);
  if (t.includes("処分業")) return "disposal";
  if (t.includes("特別管理")) return "special_management";
  if (t.includes("収集運搬")) return "collection_transport";
  return "collection_transport";
}

function extractPrefecture(address) {
  if (!address) return null;
  const m = address.match(/^(東京都|北海道|(?:大阪|京都|.+)府|(?:.+)県)/);
  return m ? m[1] : null;
}

function extractCity(address) {
  if (!address) return null;
  const m = address.match(/^(?:東京都|北海道|(?:\S+)府|(?:\S+)県)(.+?(?:市|区|町|村))/);
  return m ? m[1].trim() : null;
}

// ─── ソース1: 大阪府 Excel ─────────────────────────────────

async function ingestOsaka() {
  const SOURCE_URL = "https://www.pref.osaka.lg.jp/o120060/sangyohaiki/sanpai/torikeshishobun.html";
  const EXCEL_URL = "https://www.pref.osaka.lg.jp/documents/595/20260326kyokatorikeshi.xlsx";
  const TMP = "/tmp/osaka_sanpai.xlsx";

  console.log("\n=== 大阪府 産廃許可取消一覧（Excel）===");

  // ダウンロード（Pythonで取得・パース）
  const script = `
import urllib.request, json, openpyxl, io, sys

url = "${EXCEL_URL}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=20) as r:
    data = r.read()

wb = openpyxl.load_workbook(io.BytesIO(data))
ws = wb.active

results = []
header_row = None
for row in ws.iter_rows(min_row=1, values_only=True):
    texts = [str(c) if c is not None else "" for c in row]
    if "取消処分の年月日" in texts or "処分日" in texts or "年月日" in texts:
        header_row = texts
        continue
    if header_row is None:
        continue
    # 日付, 事業者名, 住所, 許可番号, 内容
    # 列インデックス: [None, 取消処分の年月日, 事業者の氏名又は名称, 住所, 許可番号, 当該処分の内容, None]
    if len(row) < 5:
        continue
    date_val = row[1]
    name_val = row[2]
    addr_val = row[3]
    lic_val  = row[4]
    content_val = row[5] if len(row) > 5 else None
    if not name_val or str(name_val).strip() in ("", "None", "　", " "):
        continue
    # 日付変換
    date_str = None
    if hasattr(date_val, 'strftime'):
        date_str = date_val.strftime('%Y-%m-%d')
    elif date_val:
        import re
        m = re.search(r'(\\d{4}).*?(\\d{1,2}).*?(\\d{1,2})', str(date_val))
        if m:
            date_str = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    results.append({
        "date": date_str,
        "name": str(name_val).strip().replace("\\n", " "),
        "address": str(addr_val).strip() if addr_val else "",
        "license_num": str(lic_val).strip() if lic_val else "",
        "content": str(content_val).strip() if content_val else "",
    })

print(json.dumps(results, ensure_ascii=False))
`;

  let rows;
  try {
    const out = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 30000 });
    rows = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ 大阪府Excel取得失敗:", e.message.slice(0, 200));
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  console.log(`  取得行数: ${rows.length}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    if (!row.name || row.name.length < 2) { skipped++; continue; }
    const pref = extractPrefecture(row.address) || "大阪府";
    const city = extractCity(row.address);
    const slug = toSlug("osaka-sanpai", row.name, row.license_num);
    const item = {
      slug,
      company_name: row.name,
      corporate_number: null,
      prefecture: pref,
      city: city || null,
      license_type: normalizeLicenseType(row.content),
      waste_category: "industrial",
      business_area: "大阪府",
      status: "revoked",
      risk_level: "critical",
      penalty_count: 1,
      latest_penalty_date: row.date || null,
      source_name: "大阪府産廃許可取消一覧",
      source_url: SOURCE_URL,
      detail_url: SOURCE_URL,
      notes: row.content ? row.content.slice(0, 200) : null,
    };
    if (DRY_RUN) {
      console.log(`  🔍 [dry-run] ${item.company_name} (${item.latest_penalty_date})`);
      inserted++;
      continue;
    }
    try {
      const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (e) {
      console.error(`  ❌ ${row.name}: ${e.message}`);
      skipped++;
    }
  }
  console.log(`  ✅ inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース2: 神奈川県 HTML ────────────────────────────────

async function ingestKanagawa() {
  const SOURCE_URL = "https://www.pref.kanagawa.jp/docs/p3k/cnt/f91/index.html";
  console.log("\n=== 神奈川県 産廃許可取消一覧（HTML）===");

  const script = `
import urllib.request, json, re, html as htmllib

url = "${SOURCE_URL}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"})
with urllib.request.urlopen(req, timeout=20) as r:
    content = r.read().decode('utf-8', errors='replace')

# テーブル行を抽出
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)
results = []
for row in rows:
    cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)
    texts = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
    texts = [htmllib.unescape(t.replace('\\n', ' ').replace('\\t', ' ')) for t in texts]
    texts = [re.sub(r'\\s+', ' ', t).strip() for t in texts]
    # 処分日 | 許可区分（許可番号） | 処理業者名等
    if len(texts) < 3: continue
    if not texts[0] or texts[0] in ('処分日', '年月日'): continue
    # 令和 or 平成 で始まる日付行
    if not re.search(r'[令平]和?\\d', texts[0]): continue
    date_raw = texts[0]
    license_info = texts[1] if len(texts) > 1 else ""
    name_info = texts[2] if len(texts) > 2 else ""
    # 許可番号抽出
    lic_match = re.search(r'[（(](\\d{9,14})[）)]', license_info)
    lic_num = lic_match.group(1) if lic_match else ""
    # 処分日変換
    date_str = None
    m = re.search(r'令和(\\d+)年(\\d+)月(\\d+)日', date_raw)
    if m:
        y = 2018 + int(m.group(1))
        date_str = f"{y}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    # 住所・社名を分割（改行や空白で）
    parts = [p.strip() for p in re.split(r'[\\n\\r　]', name_info) if p.strip()]
    company = parts[0] if parts else name_info
    address = " ".join(parts[1:]) if len(parts) > 1 else ""
    if not company or len(company) < 2: continue
    results.append({
        "date": date_str,
        "name": company,
        "address": address,
        "license_info": license_info,
        "license_num": lic_num,
    })

print(json.dumps(results, ensure_ascii=False))
`;

  let rows;
  try {
    const out = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 30000 });
    rows = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ 神奈川県HTML取得失敗:", e.message.slice(0, 200));
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  console.log(`  取得行数: ${rows.length}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    if (!row.name || row.name.length < 2) { skipped++; continue; }
    const pref = extractPrefecture(row.address);
    const city = extractCity(row.address);
    const licType = normalizeLicenseType(row.license_info);
    const slug = toSlug("kanagawa-sanpai", row.name, row.license_num);
    const item = {
      slug,
      company_name: row.name,
      corporate_number: null,
      prefecture: pref || "神奈川県",
      city: city || null,
      license_type: licType,
      waste_category: "industrial",
      business_area: "神奈川県",
      status: "revoked",
      risk_level: "critical",
      penalty_count: 1,
      latest_penalty_date: row.date || null,
      source_name: "神奈川県産廃許可取消一覧",
      source_url: SOURCE_URL,
      detail_url: SOURCE_URL,
      notes: row.license_info ? row.license_info.slice(0, 200) : null,
    };
    if (DRY_RUN) {
      console.log(`  🔍 [dry-run] ${item.company_name} (${item.latest_penalty_date})`);
      inserted++;
      continue;
    }
    try {
      const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (e) {
      console.error(`  ❌ ${row.name}: ${e.message}`);
      skipped++;
    }
  }
  console.log(`  ✅ inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
  return { inserted, updated, skipped };
}

// ─── メイン ────────────────────────────────────────────────

console.log(`=== 産廃処分 取込スクリプト (dry-run: ${DRY_RUN}) ===`);
const r1 = await ingestOsaka();
const r2 = await ingestKanagawa();

const total = {
  inserted: r1.inserted + r2.inserted,
  updated:  r1.updated  + r2.updated,
  skipped:  r1.skipped  + r2.skipped,
};

console.log("\n=== 合計 ===");
console.log(`inserted: ${total.inserted}, updated: ${total.updated}, skipped: ${total.skipped}`);

if (!DRY_RUN) {
  const count = db.prepare("SELECT COUNT(*) as c FROM sanpai_items").get().c;
  console.log(`sanpai_items 総件数: ${count}`);
}
db.close();
