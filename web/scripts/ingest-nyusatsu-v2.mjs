/**
 * 入札情報 取込スクリプト v2
 *
 * ソース1: 農林水産省 補助事業参加者公募（既存継続）
 * ソース2: デジタル庁 調達ポータル直リンク（新規）
 *
 * 取得経路:
 *   - 農水省: HTMLテーブルスクレイピング
 *   - デジタル庁: ページから p-portal.go.jp/pps-web-biz/UAA01/OAA0122?anken=... のリンクを収集
 *
 * 実行: node scripts/ingest-nyusatsu-v2.mjs [--dry-run] [--source all|maff|digital]
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
    issuer_name       = excluded.issuer_name,
    summary           = excluded.summary,
    updated_at        = datetime('now')
`);

// ─── ユーティリティ ─────────────────────────────────────────

function toSlug(prefix, title) {
  const base = (prefix + "-" + title
    .replace(/[令和\d年度]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 50)
  ).replace(/-+$/, "") || prefix + "-item";
  return base;
}

function parseJaDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const m2 = s.match(/令和(\d+)年(\d+)月/);
  if (m2) {
    const y = 2018 + parseInt(m2[1]);
    return `${y}-${m2[2].padStart(2, "0")}-01`;
  }
  return null;
}

function inferCategory(title) {
  if (/IT|DX|デジタル|システム|情報|ソフト|セキュリティ|データ|AI|クラウド/.test(title)) return "it";
  if (/建設|工事|土木|整備|施工|測量|設計/.test(title)) return "construction";
  if (/調査|分析|研究|検討|実証|評価|モニタリング|コンサル|支援業務/.test(title)) return "consulting";
  if (/物品|購入|調達|供給|資材|機器|機材|ライセンス|トナー/.test(title)) return "goods";
  return "service";
}

function inferBiddingMethod(content) {
  if (!content) return "proposal";
  if (/一般競争入札|一般競争/.test(content)) return "open";
  if (/指名競争/.test(content)) return "designated";
  if (/随意契約/.test(content)) return "negotiated";
  return "proposal";
}

function upsertItem(item) {
  if (DRY_RUN) return { action: "dry-run" };
  try {
    const before = db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?").get(item.slug);
    upsertStmt.run(item);
    return { action: before ? "update" : "insert" };
  } catch (e) {
    return { action: "error", msg: e.message };
  }
}

// ─── ソース1: 農林水産省 ────────────────────────────────────

async function ingestMaff() {
  console.log("\n=== 農林水産省 補助事業参加者公募 ===");

  const SCRAPER_CODE = `
import urllib.request, json, re, html as htmllib, sys

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"})
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
    m = re.search(r'href=["\\']([^"\\'\\s>]+)', cell)
    if not m: return ""
    h = m.group(1)
    return h if h.startswith("http") else base + h

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
print(json.dumps(results, ensure_ascii=False))
`;

  let rows;
  try {
    const SCRAPER_PY = "/tmp/ingest_nyusatsu_maff.py";
    fs.writeFileSync(SCRAPER_PY, SCRAPER_CODE);
    const out = execSync(`python3 "${SCRAPER_PY}" 2>/dev/null`, { timeout: 30000 });
    rows = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ 農水省取得失敗:", e.message.slice(0, 200));
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  console.log(`  取得: ${rows.length}件`);

  const now = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    if (!row.title || row.title.length < 5) { skipped++; continue; }
    const announceDate = parseJaDate(row.announce_date);
    const deadline = parseJaDate(row.deadline);
    const status = deadline && deadline < now ? "closed" : "open";
    const slug = toSlug("maff", row.title);

    const item = {
      slug,
      title: row.title.slice(0, 200),
      category: inferCategory(row.title),
      issuer_name: "農林水産省",
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

    const r = upsertItem(item);
    if (r.action === "insert") inserted++;
    else if (r.action === "update") updated++;
    else if (r.action === "dry-run") inserted++;
    else skipped++;
  }

  console.log(`  ✅ inserted:${inserted} updated:${updated} skipped:${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース2: デジタル庁 調達ポータル直リンク ─────────────

async function ingestDigital() {
  console.log("\n=== デジタル庁 調達ポータル（p-portal直リンク） ===");

  const SOURCE_URL = "https://www.digital.go.jp/procurement/";

  const SCRAPER_CODE = `
import urllib.request, json, re, html as htmllib, sys

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read(200000).decode('utf-8', errors='replace')
    except Exception as e:
        sys.stderr.write(f"fetch error {url}: {e}\\n")
        return ""

SOURCE = "https://www.digital.go.jp/procurement/"
body = fetch(SOURCE)

# p-portal.go.jp の OAA0122 リンクを全て抽出（&amp; エスケープ対応）
all_a = re.findall(
    r'<a\\s+[^>]*href=["\\\'](https://www\\.p-portal\\.go\\.jp/[^"\\\'>]+)["\\\'][^>]*>(.*?)</a>',
    body, re.S
)

results = []
seen = set()
for raw_url, raw_title in all_a:
    url_clean = htmllib.unescape(raw_url)
    title_clean = re.sub(r'<[^>]+>', '', raw_title)
    title_clean = re.sub(r'\\s+', ' ', htmllib.unescape(title_clean)).strip()
    if not title_clean or len(title_clean) < 5: continue
    if 'OAA0122' not in url_clean: continue
    if url_clean in seen: continue
    seen.add(url_clean)
    m = re.search(r'anken=(\\d+)', url_clean)
    anken = m.group(1) if m else ""
    results.append({
        "source": "digital",
        "issuer": "デジタル庁",
        "title": title_clean,
        "detail_url": url_clean,
        "anken_id": anken,
    })

print(json.dumps(results, ensure_ascii=False))
`;

  let rows;
  try {
    const SCRAPER_PY = "/tmp/ingest_nyusatsu_digital.py";
    fs.writeFileSync(SCRAPER_PY, SCRAPER_CODE);
    const out = execSync(`python3 "${SCRAPER_PY}" 2>/dev/null`, { timeout: 30000 });
    rows = JSON.parse(out.toString());
  } catch (e) {
    console.error("  ❌ デジタル庁取得失敗:", e.message.slice(0, 200));
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  console.log(`  取得: ${rows.length}件`);

  let inserted = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    if (!row.title || row.title.length < 5) { skipped++; continue; }
    const slug = row.anken_id
      ? `digital-${row.anken_id}`
      : toSlug("digital", row.title);

    const item = {
      slug,
      title: row.title.slice(0, 200),
      category: inferCategory(row.title),
      issuer_name: "デジタル庁",
      target_area: "全国",
      deadline: null,
      budget_amount: null,
      bidding_method: "proposal",
      summary: null,
      status: "open",
      qualification: null,
      announcement_url: row.detail_url || "",
      contact_info: null,
      delivery_location: null,
      has_attachment: 0,
      announcement_date: null,
      contract_period: null,
    };

    const r = upsertItem(item);
    if (r.action === "insert") inserted++;
    else if (r.action === "update") updated++;
    else if (r.action === "dry-run") inserted++;
    else skipped++;
  }

  console.log(`  ✅ inserted:${inserted} updated:${updated} skipped:${skipped}`);
  return { inserted, updated, skipped, source_url: SOURCE_URL };
}

// ─── メイン ────────────────────────────────────────────────

console.log(`=== 入札情報 取込スクリプト v2 (dry-run:${DRY_RUN}, source:${sourceArg}) ===`);

const runMaff = sourceArg === "all" || sourceArg === "maff";
const runDigital = sourceArg === "all" || sourceArg === "digital";

let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;
const sourceResults = {};

if (runMaff) {
  const r = await ingestMaff();
  totalInserted += r.inserted;
  totalUpdated += r.updated;
  totalSkipped += r.skipped;
  sourceResults.maff = r;
}

if (runDigital) {
  const r = await ingestDigital();
  totalInserted += r.inserted;
  totalUpdated += r.updated;
  totalSkipped += r.skipped;
  sourceResults.digital = r;
}

console.log("\n=== 合計 ===");
console.log(`inserted:${totalInserted} updated:${totalUpdated} skipped:${totalSkipped}`);

if (!DRY_RUN) {
  const count = db.prepare("SELECT COUNT(*) as c FROM nyusatsu_items").get().c;
  console.log(`nyusatsu_items 総件数: ${count}`);

  const bySrc = db.prepare(
    "SELECT issuer_name, COUNT(*) as c FROM nyusatsu_items GROUP BY issuer_name ORDER BY c DESC"
  ).all();
  console.log("ソース別件数:", bySrc.map((r) => `${r.issuer_name}:${r.c}`).join(", "));
}

db.close();
