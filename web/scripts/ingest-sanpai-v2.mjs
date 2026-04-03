/**
 * 産廃処分 取込スクリプト v2
 *
 * ソース1: 大阪府 産廃許可取消一覧（Excel）— 既存継続
 * ソース2: 神奈川県 産廃許可取消一覧（HTML）— 既存継続
 * ソース3: 東京都 産廃行政処分 プレスリリース（gsk crawl + HTML）— 新規
 *
 * 東京都取得方式:
 *   1. https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/improper_handling/disposal_information
 *      をgsk crawl --render_jsで取得し、年別プレスリリースURLリストを抽出
 *   2. 各プレスリリースURLをgsk crawlで取得し、事業者名・住所・許可番号を抽出
 *   3. sanpai_items に安全upsert
 *
 * 実行: node scripts/ingest-sanpai-v2.mjs [--dry-run] [--source all|osaka|kanagawa|tokyo]
 *       [--tokyo-years 2026,2025]  (デフォルト: 2026,2025)
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/sports-event.db");
const DRY_RUN = process.argv.includes("--dry-run");

const sourceArg = (() => {
  const idx = process.argv.indexOf("--source");
  return idx >= 0 ? process.argv[idx + 1] : "all";
})();

const tokyoYearsArg = (() => {
  const idx = process.argv.indexOf("--tokyo-years");
  if (idx >= 0) return process.argv[idx + 1].split(",").map(Number);
  return [2026, 2025]; // デフォルト: 直近2年
})();

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
    company_name        = excluded.company_name,
    prefecture          = excluded.prefecture,
    city                = excluded.city,
    license_type        = excluded.license_type,
    status              = excluded.status,
    risk_level          = excluded.risk_level,
    latest_penalty_date = excluded.latest_penalty_date,
    source_name         = excluded.source_name,
    source_url          = excluded.source_url,
    detail_url          = excluded.detail_url,
    notes               = excluded.notes,
    updated_at          = datetime('now')
`);

// ─── ユーティリティ ─────────────────────────────────────────

function toSlug(source_prefix, name, extra = "") {
  const base = name
    .replace(/[株式会社有限会社合同会社]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40);
  const suffix = extra ? `-${extra.replace(/[^\w]/g, "").substring(0, 12)}` : "";
  return `${source_prefix}-${base}${suffix}` || `${source_prefix}-item`;
}

function parseJapaneseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  const m2 = s.match(/令和(\d+)年(\d+)月/);
  if (m2) {
    const y = 2018 + parseInt(m2[1]);
    return `${y}-${String(m2[2]).padStart(2, "0")}-01`;
  }
  // YYYY年MM月DD日
  const m3 = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m3) return `${m3[1]}-${m3[2].padStart(2, "0")}-${m3[3].padStart(2, "0")}`;
  return null;
}

function normalizeLicenseType(text) {
  if (!text) return "collection_transport";
  const t = String(text);
  if (t.includes("処分業") || t.includes("処理業")) return "disposal";
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

function upsertSanpaiItem(item) {
  if (DRY_RUN) return { action: "dry-run" };
  try {
    const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(item.slug);
    upsertStmt.run(item);
    return { action: before ? "update" : "insert" };
  } catch (e) {
    return { action: "error", msg: e.message };
  }
}

// ─── ソース1: 大阪府 Excel ─────────────────────────────────

async function ingestOsaka() {
  const SOURCE_URL = "https://www.pref.osaka.lg.jp/o120060/sangyohaiki/sanpai/torikeshishobun.html";
  const EXCEL_URL = "https://www.pref.osaka.lg.jp/documents/595/20260326kyokatorikeshi.xlsx";

  console.log("\n=== 大阪府 産廃許可取消一覧（Excel）===");

  const script = `
import urllib.request, json, openpyxl, io, re, sys

url = "${EXCEL_URL}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read()
except Exception as e:
    sys.stderr.write(f"download error: {e}\\n")
    print(json.dumps([]))
    sys.exit(0)

try:
    wb = openpyxl.load_workbook(io.BytesIO(data))
except Exception as e:
    sys.stderr.write(f"excel parse error: {e}\\n")
    print(json.dumps([]))
    sys.exit(0)

ws = wb.active
results = []
header_row = None
for row in ws.iter_rows(min_row=1, values_only=True):
    texts = [str(c) if c is not None else "" for c in row]
    if any("処分" in t or "年月日" in t for t in texts):
        header_row = texts
        continue
    if header_row is None:
        continue
    if len(row) < 5: continue
    date_val = row[1]
    name_val = row[2]
    addr_val = row[3]
    lic_val  = row[4]
    content_val = row[5] if len(row) > 5 else None
    if not name_val or str(name_val).strip() in ("", "None", "　", " "): continue
    date_str = None
    if hasattr(date_val, 'strftime'):
        date_str = date_val.strftime('%Y-%m-%d')
    elif date_val:
        m = re.search(r'(\\d{4}).*?(\\d{1,2}).*?(\\d{1,2})', str(date_val))
        if m: date_str = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
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
    const r = upsertSanpaiItem(item);
    if (r.action === "insert") inserted++;
    else if (r.action === "update") updated++;
    else if (r.action === "dry-run") inserted++;
    else skipped++;
  }

  console.log(`  ✅ inserted:${inserted} updated:${updated} skipped:${skipped}`);
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
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        content = r.read().decode('utf-8', errors='replace')
except Exception as e:
    import sys
    sys.stderr.write(f"error: {e}\\n")
    print(json.dumps([]))
    import sys; sys.exit(0)

rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)
results = []
for row in rows:
    cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)
    texts = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
    texts = [htmllib.unescape(t.replace('\\n', ' ').replace('\\t', ' ')) for t in texts]
    texts = [re.sub(r'\\s+', ' ', t).strip() for t in texts]
    if len(texts) < 3 or not texts[0] or texts[0] in ('処分日', '年月日'): continue
    if not re.search(r'[令平]和?\\d', texts[0]): continue
    date_raw = texts[0]
    license_info = texts[1] if len(texts) > 1 else ""
    name_info = texts[2] if len(texts) > 2 else ""
    lic_match = re.search(r'[（(](\\d{9,14})[）)]', license_info)
    lic_num = lic_match.group(1) if lic_match else ""
    date_str = None
    m = re.search(r'令和(\\d+)年(\\d+)月(\\d+)日', date_raw)
    if m:
        y = 2018 + int(m.group(1))
        date_str = f"{y}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    parts = [p.strip() for p in re.split(r'[\\n\\r　]', name_info) if p.strip()]
    company = parts[0] if parts else name_info
    address = " ".join(parts[1:]) if len(parts) > 1 else ""
    if not company or len(company) < 2: continue
    results.append({
        "date": date_str, "name": company, "address": address,
        "license_info": license_info, "license_num": lic_num,
    })
print(json.dumps(results, ensure_ascii=False))
`;

  let rows;
  try {
    const out = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 30000 });
    rows = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ 神奈川県取得失敗:", e.message.slice(0, 200));
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
    const r = upsertSanpaiItem(item);
    if (r.action === "insert") inserted++;
    else if (r.action === "update") updated++;
    else if (r.action === "dry-run") inserted++;
    else skipped++;
  }

  console.log(`  ✅ inserted:${inserted} updated:${updated} skipped:${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース3: 東京都 gsk crawl ─────────────────────────────

/**
 * gsk crawl マークダウン出力から事業者情報を抽出するPython
 * - listページ: 年別URLリストを抽出
 * - detailページ: 事業者名・住所・許可番号を抽出
 */
const TOKYO_PARSE_LIST_PY = "/tmp/ingest_tokyo_parse_list.py";
const TOKYO_PARSE_DETAIL_PY = "/tmp/ingest_tokyo_parse_detail.py";

const TOKYO_LIST_PARSE_CODE = `
import sys, json, re

markdown = sys.stdin.read()

entries = re.findall(
    r'(\\d{4})年(\\d{1,2})月(\\d{1,2})日[^\\n]*?\\[([^\\]]+)\\]\\((https?://[^)]+)\\)',
    markdown
)

results = []
seen = set()
for year, month, day, title, url in entries:
    if url in seen: continue
    seen.add(url)
    # 件数 summary を取得
    summary_m = re.search(re.escape(url) + r'[^（\\n]*（([^）\\n]+)）', markdown)
    summary = summary_m.group(1) if summary_m else ""
    results.append({
        "date": f"{year}-{month.zfill(2)}-{day.zfill(2)}",
        "title": title.strip(),
        "url": url.strip(),
        "summary": summary.strip(),
        "year": int(year),
    })

print(json.dumps(results, ensure_ascii=False))
`;

const TOKYO_DETAIL_PARSE_CODE = `
import sys, json, re

# stdin: {"markdown": "...", "date": "...", "url": "...", "summary": "..."}
data = json.loads(sys.stdin.read())
markdown = data.get("markdown", "")
entry_date = data.get("date", "")
entry_url = data.get("url", "")
entry_summary = data.get("summary", "")

# セクション分割 (## N で区切る)
sections = re.split(r'\\n##\\s+\\d+\\s*\\n', markdown)

results = []
for sec in sections[1:]:
    name_m   = re.search(r'###\\s*名称\\s+(.+?)(?:\\n###|\\Z)', sec, re.S)
    addr_m   = re.search(r'###\\s*住所\\s+(.+?)(?:\\n###|\\Z)', sec, re.S)
    content_m= re.search(r'###\\s*処分内容\\s+(.+?)(?:\\n###|\\Z)', sec, re.S)
    lic_m    = re.search(r'###\\s*許可の種類\\s+(.+?)(?:\\n###|\\Z)', sec, re.S)
    lic_num_m= re.search(r'(?:第)?(\\d{2}-\\d{2}-\\d{6})号?', sec)

    if not name_m: continue
    name = re.sub(r'（[^）]+）', '', name_m.group(1)).strip()
    name = re.sub(r'\\s+', '', name).strip()
    if not name or len(name) < 2: continue

    addr = addr_m.group(1).strip().split('\\n')[0].strip() if addr_m else ""
    lic_num = lic_num_m.group(1) if lic_num_m else ""
    content = content_m.group(1).strip().split('\\n')[0].strip() if content_m else ""
    lic_type_text = lic_m.group(1).strip().split('\\n')[0] if lic_m else ""

    results.append({
        "name": name,
        "address": addr,
        "license_num": lic_num,
        "license_type_text": lic_type_text[:80],
        "content": content[:100],
        "date": entry_date,
        "detail_url": entry_url,
        "summary": entry_summary,
    })

print(json.dumps(results, ensure_ascii=False))
`;

async function gskCrawl(url) {
  /** gsk crawl --render_js でマークダウンを取得 */
  try {
    const out = execSync(`gsk crawl "${url}" --render_js 2>/dev/null`, { timeout: 120000 });
    const raw = out.toString();
    try {
      const parsed = JSON.parse(raw);
      return parsed?.data?.result || raw;
    } catch {
      return raw;
    }
  } catch (e) {
    return null;
  }
}

async function ingestTokyoFromMarkdown(listMarkdown) {
  // listページのマークダウンからURLリストを抽出
  const tmpList = "/tmp/tokyo_list_md.txt";
  fs.writeFileSync(tmpList, listMarkdown);
  fs.writeFileSync(TOKYO_PARSE_LIST_PY, TOKYO_LIST_PARSE_CODE);

  let listEntries;
  try {
    const out = execSync(`cat "${tmpList}" | python3 "${TOKYO_PARSE_LIST_PY}"`, { timeout: 15000 });
    listEntries = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ リスト抽出失敗:", e.message.slice(0, 200));
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const filtered = listEntries.filter((e) => tokyoYearsArg.includes(e.year));
  console.log(`  URLリスト: ${listEntries.length}件 → 対象年フィルタ後: ${filtered.length}件 (years:${tokyoYearsArg.join(",")})`);

  const SOURCE_URL = "https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/improper_handling/disposal_information";
  fs.writeFileSync(TOKYO_PARSE_DETAIL_PY, TOKYO_DETAIL_PARSE_CODE);

  let inserted = 0, updated = 0, skipped = 0;

  for (const entry of filtered) {
    console.log(`  → ${entry.date} ${entry.summary} (${entry.url})`);

    // detailページを gsk crawl で取得
    const detailMarkdown = await gskCrawl(entry.url);
    if (!detailMarkdown || detailMarkdown.length < 50) {
      console.error(`    ❌ 詳細取得失敗: ${entry.url}`);
      skipped++;
      continue;
    }

    // マークダウンから事業者情報を抽出
    const tmpDetail = "/tmp/tokyo_detail_md.txt";
    const inputJson = JSON.stringify({
      markdown: detailMarkdown,
      date: entry.date,
      url: entry.url,
      summary: entry.summary,
    });
    fs.writeFileSync(tmpDetail, inputJson);

    let detailRows;
    try {
      const out = execSync(`cat "${tmpDetail}" | python3 "${TOKYO_PARSE_DETAIL_PY}"`, { timeout: 15000 });
      detailRows = JSON.parse(out.toString());
    } catch (e) {
      console.error(`    ❌ 詳細パース失敗: ${e.message.slice(0, 100)}`);
      skipped++;
      continue;
    }

    console.log(`    抽出: ${detailRows.length}件`);

    if (DRY_RUN) {
      for (const row of detailRows) {
        console.log(`    🔍 [dry-run] ${row.name} (${row.address.slice(0, 30)})`);
      }
      inserted += detailRows.length;
      continue;
    }

    for (const row of detailRows) {
      if (!row.name || row.name.length < 2) { skipped++; continue; }
      const pref = extractPrefecture(row.address) || "東京都";
      const city = extractCity(row.address);
      const licType = normalizeLicenseType(row.license_type_text || entry.summary || "");
      const licNumClean = (row.license_num || "").replace(/[^0-9]/g, "");
      const slug = toSlug("tokyo-sanpai", row.name, licNumClean);

      const item = {
        slug,
        company_name: row.name.slice(0, 100),
        corporate_number: null,
        prefecture: pref,
        city: city || null,
        license_type: licType,
        waste_category: "industrial",
        business_area: "東京都",
        status: "revoked",
        risk_level: "critical",
        penalty_count: 1,
        latest_penalty_date: row.date || entry.date || null,
        source_name: "東京都産廃行政処分情報",
        source_url: SOURCE_URL,
        detail_url: row.detail_url || entry.url || SOURCE_URL,
        notes: (row.content || entry.summary || "").slice(0, 200),
      };

      const r = upsertSanpaiItem(item);
      if (r.action === "insert") inserted++;
      else if (r.action === "update") updated++;
      else skipped++;
    }
  }

  return { inserted, updated, skipped };
}

async function ingestTokyo() {
  console.log("\n=== 東京都 産廃行政処分（gsk crawl + マークダウンパース）===");
  console.log("  gsk crawl でJS描画ページを取得中...");

  const markdownContent = await gskCrawl(
    "https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/improper_handling/disposal_information"
  );

  if (!markdownContent || markdownContent.length < 100) {
    console.error("  ❌ コンテンツ取得失敗");
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  console.log(`  取得: ${markdownContent.length}文字`);
  return await ingestTokyoFromMarkdown(markdownContent);
}

// ─── メイン ────────────────────────────────────────────────

console.log(`=== 産廃処分 取込スクリプト v2 (dry-run:${DRY_RUN}, source:${sourceArg}) ===`);

const runOsaka = sourceArg === "all" || sourceArg === "osaka";
const runKanagawa = sourceArg === "all" || sourceArg === "kanagawa";
const runTokyo = sourceArg === "all" || sourceArg === "tokyo";

let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;

if (runOsaka) {
  const r = await ingestOsaka();
  totalInserted += r.inserted; totalUpdated += r.updated; totalSkipped += r.skipped;
}

if (runKanagawa) {
  const r = await ingestKanagawa();
  totalInserted += r.inserted; totalUpdated += r.updated; totalSkipped += r.skipped;
}

if (runTokyo) {
  const r = await ingestTokyo();
  totalInserted += r.inserted; totalUpdated += r.updated; totalSkipped += r.skipped;
}

console.log("\n=== 合計 ===");
console.log(`inserted:${totalInserted} updated:${totalUpdated} skipped:${totalSkipped}`);

if (!DRY_RUN) {
  const count = db.prepare("SELECT COUNT(*) as c FROM sanpai_items").get().c;
  console.log(`sanpai_items 総件数: ${count}`);

  const bySrc = db.prepare(
    "SELECT source_name, COUNT(*) as c FROM sanpai_items GROUP BY source_name ORDER BY c DESC"
  ).all();
  console.log("ソース別:", bySrc.map((r) => `${r.source_name}:${r.c}`).join(", "));
}

db.close();
