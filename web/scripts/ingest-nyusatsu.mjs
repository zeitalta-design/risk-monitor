/**
 * 入札情報 取込スクリプト
 *
 * ソース1: 農林水産省 入札公告・補助事業公募一覧（144件+）
 * ソース2: 経済産業省 公募・入札情報
 * ソース3: 総務省 入札・公募情報
 *
 * 実行: node scripts/ingest-nyusatsu.mjs [--dry-run]
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/sports-event.db");
const SCRAPER_PY = path.resolve("/tmp/scrape_nyusatsu_all.py");
const DRY_RUN = process.argv.includes("--dry-run");

const db = new Database(DB_PATH);

// ─── DB upsert ─────────────────────────────────────────────
const upsertStmt = db.prepare(`
  INSERT INTO nyusatsu_items
    (slug, title, category, issuer_name, target_area, deadline, budget_amount,
     bidding_method, summary, status, is_published, created_at, updated_at,
     qualification, announcement_url, contact_info, delivery_location,
     has_attachment, announcement_date, contract_period)
  VALUES
    (@slug, @title, @category, @issuer_name, @target_area, @deadline, @budget_amount,
     @bidding_method, @summary, @status, 1, datetime('now'), datetime('now'),
     @qualification, @announcement_url, @contact_info, @delivery_location,
     @has_attachment, @announcement_date, @contract_period)
  ON CONFLICT(slug) DO UPDATE SET
    title             = excluded.title,
    deadline          = excluded.deadline,
    status            = excluded.status,
    announcement_url  = excluded.announcement_url,
    announcement_date = excluded.announcement_date,
    updated_at        = datetime('now')
`);

// ─── ユーティリティ ─────────────────────────────────────────
function toSlug(prefix, title) {
  return (prefix + "-" + title
    .replace(/[令和\d年度]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 50)
  ).replace(/-+$/, "") || prefix + "-item";
}

function parseJaDate(str) {
  if (!str) return null;
  const m = String(str).match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  }
  const m2 = String(str).match(/令和(\d+)年(\d+)月/);
  if (m2) {
    const y = 2018 + parseInt(m2[1]);
    return `${y}-${m2[2].padStart(2,"0")}-01`;
  }
  return null;
}

function inferCategory(title) {
  if (/IT|DX|デジタル|システム|情報|ソフト|セキュリティ|データ/.test(title)) return "it";
  if (/建設|工事|土木|整備|施工/.test(title)) return "construction";
  if (/調査|分析|研究|検討|実証|評価|モニタリング/.test(title)) return "consulting";
  if (/物品|購入|調達|供給|資材/.test(title)) return "goods";
  return "service";
}

// ─── Pythonスクレイパーを書き出して実行 ──────────────────────
const SCRAPER_CODE = `
import urllib.request, json, re, html as htmllib, sys

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        sys.stderr.write(f"fetch error {url}: {e}\\n")
        return ""

def clean(s):
    t = re.sub(r'<[^>]+>', '', s).strip()
    return re.sub(r'\\s+', ' ', htmllib.unescape(t)).strip()

def href(cell, base):
    m = re.search(r'href=["\\']([^"\\'>\\s]+)', cell)
    if not m: return ""
    h = m.group(1)
    return h if h.startswith("http") else base + h

# 農水省: テーブル (公告日|締切日|件名)
def maff():
    base = "https://www.maff.go.jp"
    url  = base + "/j/supply/hozyo/index.html"
    content = fetch(url)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)
    results, seen = [], set()
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)
        if len(cells) < 3: continue
        texts = [clean(c) for c in cells]
        if not re.search(r'令和\\d+年', texts[0]): continue
        title = texts[2]
        if not title or len(title) < 5 or title in seen: continue
        seen.add(title)
        results.append({
            "source": "maff", "issuer": "農林水産省",
            "announce_date": texts[0],
            "deadline": texts[1] if len(texts) > 1 else "",
            "title": title,
            "detail_url": href(cells[2] if len(cells) > 2 else "", base),
        })
    return results

# 経済産業省: 入札公告一覧
def meti():
    base = "https://www.meti.go.jp"
    url  = base + "/information/publicoffer/kobo/index.html"
    content = fetch(url)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)
    results, seen = [], set()
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)
        if len(cells) < 2: continue
        texts = [clean(c) for c in cells]
        date_text = next((t for t in texts if re.search(r'令和\\d+年', t)), "")
        title = next((t for t in texts if len(t) > 10 and not re.search(r'^令和', t)), "")
        if not title or len(title) < 5 or title in seen: continue
        seen.add(title)
        detail = ""
        for c in cells:
            d = href(c, base)
            if d: detail = d; break
        results.append({
            "source": "meti", "issuer": "経済産業省",
            "announce_date": date_text, "deadline": "",
            "title": title, "detail_url": detail,
        })
    return results[:60]

# 総務省
def soumu():
    base = "https://www.soumu.go.jp"
    url  = base + "/menu_kyotsuu/nyusatsu/index.html"
    content = fetch(url)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)
    results, seen = [], set()
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)
        if len(cells) < 2: continue
        texts = [clean(c) for c in cells]
        title = next((t for t in texts if len(t) > 10), "")
        if not title or title in seen: continue
        seen.add(title)
        detail = ""
        for c in cells:
            d = href(c, base)
            if d: detail = d; break
        date_text = next((t for t in texts if re.search(r'令和\\d+年', t)), "")
        results.append({
            "source": "soumu", "issuer": "総務省",
            "announce_date": date_text, "deadline": "",
            "title": title, "detail_url": detail,
        })
    return results[:50]

all_results = maff() + meti() + soumu()
print(json.dumps(all_results, ensure_ascii=False))
`;

fs.writeFileSync(SCRAPER_PY, SCRAPER_CODE);

console.log(`=== 入札情報 取込スクリプト (dry-run: ${DRY_RUN}) ===`);

let rows;
try {
  const out = execSync(`python3 "${SCRAPER_PY}" 2>/dev/null`, { timeout: 60000 });
  rows = JSON.parse(out.toString());
} catch (e) {
  console.error("❌ スクレイピング失敗:", e.message.slice(0, 300));
  process.exit(1);
}

// ソース別集計
const bySrc = {};
for (const r of rows) bySrc[r.source] = (bySrc[r.source] || 0) + 1;
console.log("取得:", Object.entries(bySrc).map(([k,v]) => `${k}:${v}件`).join(", "), `合計${rows.length}件`);

const now = new Date().toISOString().slice(0, 10);
let inserted = 0, updated = 0, skipped = 0;

for (const row of rows) {
  if (!row.title || row.title.length < 5) { skipped++; continue; }
  const announceDate = parseJaDate(row.announce_date);
  const deadline = parseJaDate(row.deadline);
  const status = deadline && deadline < now ? "closed" : "open";
  const slug = toSlug(row.source, row.title);

  const item = {
    slug,
    title: row.title.slice(0, 200),
    category: inferCategory(row.title),
    issuer_name: row.issuer || row.source,
    target_area: "全国",
    deadline: deadline || null,
    budget_amount: null,
    bidding_method: "proposal",
    summary: null,
    status,
    qualification: null,
    announcement_url: row.detail_url || "",
    contact_info: null,
    delivery_location: null,
    has_attachment: row.detail_url ? 1 : 0,
    announcement_date: announceDate || null,
    contract_period: null,
  };

  if (DRY_RUN) {
    if (inserted < 5) console.log(`  🔍 [${row.source}] ${item.title.slice(0, 60)} (${item.deadline || "締切不明"})`);
    inserted++;
    continue;
  }
  try {
    const before = db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?").get(slug);
    upsertStmt.run(item);
    before ? updated++ : inserted++;
  } catch (e) {
    skipped++;
  }
}

console.log(`\n=== 結果 ===`);
console.log(`inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
if (!DRY_RUN) {
  const count = db.prepare("SELECT COUNT(*) as c FROM nyusatsu_items").get().c;
  console.log(`nyusatsu_items 総件数: ${count}`);
}
db.close();
