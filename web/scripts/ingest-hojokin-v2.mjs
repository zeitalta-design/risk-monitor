/**
 * 補助金 取込スクリプト v2 — J-Grants API 多キーワード戦略
 *
 * 従来の IT/DX 20語依存を脱却し、以下の戦略に変更:
 *   1. カテゴリ語: ものづくり, 設備投資, 省エネ, 研究開発, 販路開拓, 人材育成, 創業, IT, DX
 *   2. 対象者語: 中小企業, 小規模事業者, スタートアップ, ベンチャー
 *   3. 汎用語: 事業（デフォルトキーワード、最大件数取得）
 *   4. 施策語: 補助事業, 助成金, グリーン, カーボン, デジタル化, 海外展開
 *
 * APIルール:
 *   - keyword: 2文字以上255文字以下（空白のみ不可）
 *   - sort: created_date / acceptance_start_datetime / acceptance_end_datetime
 *   - order: ASC / DESC
 *   - acceptance: 0(全て) / 1(受付中のみ)
 *
 * 実行: node scripts/ingest-hojokin-v2.mjs [--dry-run] [--acceptance 0|1]
 *       [--keywords 事業,設備,DX]  (カンマ区切りで指定)
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/sports-event.db");
const DRY_RUN = process.argv.includes("--dry-run");

const acceptanceArg = (() => {
  const idx = process.argv.indexOf("--acceptance");
  return idx >= 0 ? process.argv[idx + 1] : "0"; // 0=全て, 1=受付中のみ
})();

const keywordsArg = (() => {
  const idx = process.argv.indexOf("--keywords");
  if (idx >= 0) return process.argv[idx + 1].split(",").map((k) => k.trim()).filter(Boolean);
  return null; // null = デフォルトセット使用
})();

const db = new Database(DB_PATH);

// ─── DB upsert ─────────────────────────────────────────────

const upsertStmt = db.prepare(`
  INSERT INTO hojokin_items
    (slug, title, category, target_type, max_amount, subsidy_rate,
     deadline, status, provider_name, summary, is_published,
     created_at, updated_at)
  VALUES
    (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
     @deadline, @status, @provider_name, @summary, @is_published,
     datetime('now'), datetime('now'))
  ON CONFLICT(slug) DO UPDATE SET
    title        = excluded.title,
    deadline     = excluded.deadline,
    status       = excluded.status,
    max_amount   = excluded.max_amount,
    subsidy_rate = excluded.subsidy_rate,
    summary      = excluded.summary,
    updated_at   = datetime('now')
`);

// ─── キーワード戦略 ─────────────────────────────────────────

/**
 * 新しいキーワード戦略（IT/DX 20語依存から脱却）
 *
 * 設計方針:
 *  - 汎用語を主軸（事業 → 2829件と最多）
 *  - カテゴリ別語でカバレッジ補完
 *  - 重複取込はslugで自動dedup
 *  - 1キーワードで20〜200件程度を期待
 */
const DEFAULT_KEYWORD_STRATEGY = [
  // 汎用・大量取得語
  { keyword: "事業", sort: "created_date", order: "DESC", label: "汎用-事業" },
  { keyword: "補助", sort: "acceptance_end_datetime", order: "DESC", label: "汎用-補助（締切順）" },

  // カテゴリ語
  { keyword: "ものづくり", sort: "created_date", order: "DESC", label: "カテゴリ-ものづくり" },
  { keyword: "設備投資", sort: "created_date", order: "DESC", label: "カテゴリ-設備投資" },
  { keyword: "省エネ", sort: "created_date", order: "DESC", label: "カテゴリ-省エネ" },
  { keyword: "研究開発", sort: "created_date", order: "DESC", label: "カテゴリ-研究開発" },
  { keyword: "販路開拓", sort: "created_date", order: "DESC", label: "カテゴリ-販路開拓" },
  { keyword: "人材育成", sort: "created_date", order: "DESC", label: "カテゴリ-人材育成" },
  { keyword: "創業", sort: "created_date", order: "DESC", label: "カテゴリ-創業" },
  { keyword: "IT導入", sort: "created_date", order: "DESC", label: "カテゴリ-IT導入" },
  { keyword: "デジタル化", sort: "created_date", order: "DESC", label: "カテゴリ-デジタル化" },
  { keyword: "DX推進", sort: "created_date", order: "DESC", label: "カテゴリ-DX推進" },

  // 対象者語
  { keyword: "中小企業", sort: "created_date", order: "DESC", label: "対象-中小企業" },
  { keyword: "小規模事業者", sort: "created_date", order: "DESC", label: "対象-小規模事業者" },
  { keyword: "スタートアップ", sort: "created_date", order: "DESC", label: "対象-スタートアップ" },
  { keyword: "ベンチャー", sort: "created_date", order: "DESC", label: "対象-ベンチャー" },

  // 施策語
  { keyword: "グリーン", sort: "created_date", order: "DESC", label: "施策-グリーン" },
  { keyword: "カーボン", sort: "created_date", order: "DESC", label: "施策-カーボン" },
  { keyword: "海外展開", sort: "created_date", order: "DESC", label: "施策-海外展開" },
  { keyword: "事業再構築", sort: "created_date", order: "DESC", label: "施策-事業再構築" },
  { keyword: "生産性向上", sort: "created_date", order: "DESC", label: "施策-生産性向上" },
];

// ─── ユーティリティ ─────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve({ data: JSON.parse(data), status: res.statusCode });
        } catch (e) {
          // JSONが途中で切れた場合
          const items = [];
          const idRegex = /"id"\s*:\s*"([^"]+)"/g;
          const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
          // 簡易パース - result配列の各オブジェクトを抽出
          const objRegex = /\{[^{}]+\}/g;
          let m;
          while ((m = objRegex.exec(data)) !== null) {
            try {
              const obj = JSON.parse(m[0]);
              if (obj.id && obj.title) items.push(obj);
            } catch {}
          }
          resolve({ data: { result: items, metadata: { resultset: { count: "?" } } }, status: res.statusCode });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fetchJgrants(keyword, sort = "created_date", order = "DESC", acceptance = "0") {
  const params = new URLSearchParams({ keyword, sort, order, acceptance }).toString();
  const url = `https://api.jgrants-portal.go.jp/exp/v1/public/subsidies?${params}`;
  try {
    const { data, status } = await fetchJson(url);
    if (status !== 200) return { items: [], total: 0, error: `HTTP ${status}` };
    const items = data.result || [];
    const total = data.metadata?.resultset?.count || items.length;
    return { items, total, error: null };
  } catch (e) {
    return { items: [], total: 0, error: e.message };
  }
}

function toSlug(item) {
  // J-Grants IDをベースにslugを作成
  if (item.id) return `jgrants-${item.id}`;
  // fallback: タイトルから
  const base = (item.title || "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 50);
  return `jgrants-${base}` || "jgrants-unknown";
}

function inferCategory(item) {
  const text = `${item.title || ""} ${item.use_purpose || ""} ${item.industry || ""}`;
  if (/IT|DX|デジタル|システム|情報|ソフト|セキュリティ/.test(text)) return "it";
  if (/ものづくり|設備|製造|生産|機械|装置/.test(text)) return "equipment";
  if (/研究開発|R&D|技術開発|実証/.test(text)) return "rd";
  if (/雇用|人材|従業員|キャリア/.test(text)) return "employment";
  if (/海外|輸出|グローバル|国際/.test(text)) return "export";
  if (/創業|起業|スタートアップ|ベンチャー/.test(text)) return "startup";
  return "other";
}

function inferTargetType(item) {
  const text = `${item.target_number_of_employees || ""} ${item.title || ""}`;
  if (/スタートアップ|ベンチャー|創業/.test(text)) return "startup";
  if (/NPO|非営利|団体/.test(text)) return "npo";
  if (/個人事業|フリーランス/.test(text)) return "sole";
  return "corp";
}

function inferStatus(item) {
  const now = new Date();
  const end = item.acceptance_end_datetime ? new Date(item.acceptance_end_datetime) : null;
  const start = item.acceptance_start_datetime ? new Date(item.acceptance_start_datetime) : null;
  if (end && end < now) return "closed";
  if (start && start > now) return "upcoming";
  return "open";
}

function formatDate(isoString) {
  if (!isoString) return null;
  return isoString.slice(0, 10); // YYYY-MM-DD
}

function upsertHojokinItem(item) {
  if (DRY_RUN) return { action: "dry-run" };
  try {
    const before = db.prepare("SELECT id FROM hojokin_items WHERE slug = ?").get(item.slug);
    upsertStmt.run(item);
    return { action: before ? "update" : "insert" };
  } catch (e) {
    return { action: "error", msg: e.message };
  }
}

// ─── メイン取込ループ ────────────────────────────────────────

async function ingestKeyword(strategy) {
  const { keyword, sort, order, label } = strategy;
  const { items, total, error } = await fetchJgrants(keyword, sort, order, acceptanceArg);

  if (error) {
    process.stdout.write(` ❌ [${label}] error:${error}\n`);
    return { inserted: 0, updated: 0, skipped: 0, fetched: 0 };
  }

  process.stdout.write(` [${label}] total:${total} fetched:${items.length}\n`);

  let inserted = 0, updated = 0, skipped = 0;

  for (const raw of items) {
    if (!raw.title || raw.title.length < 2) { skipped++; continue; }

    const slug = toSlug(raw);
    const deadline = formatDate(raw.acceptance_end_datetime);
    const status = inferStatus(raw);
    const category = inferCategory(raw);
    const targetType = inferTargetType(raw);

    const item = {
      slug,
      title: raw.title.slice(0, 200),
      category,
      target_type: targetType,
      max_amount: raw.subsidy_max_limit || null,
      subsidy_rate: null,
      deadline,
      status,
      provider_name: (raw.institution_name || raw.target_area_search || "").slice(0, 100) || null,
      summary: (raw.detail || raw.use_purpose || "").slice(0, 500) || null,
      is_published: 1,
    };

    const r = upsertHojokinItem(item);
    if (r.action === "insert") inserted++;
    else if (r.action === "update") updated++;
    else if (r.action === "dry-run") inserted++;
    else skipped++;
  }

  return { inserted, updated, skipped, fetched: items.length };
}

// ─── エントリポイント ─────────────────────────────────────────

console.log(`=== 補助金 取込スクリプト v2 (dry-run:${DRY_RUN}, acceptance:${acceptanceArg}) ===`);

const strategies = keywordsArg
  ? keywordsArg.map((kw) => ({ keyword: kw, sort: "created_date", order: "DESC", label: kw }))
  : DEFAULT_KEYWORD_STRATEGY;

console.log(`キーワード数: ${strategies.length}\n`);

let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, totalFetched = 0;
const seenSlugs = new Set();

for (const strategy of strategies) {
  const r = await ingestKeyword(strategy);
  totalInserted += r.inserted;
  totalUpdated += r.updated;
  totalSkipped += r.skipped;
  totalFetched += r.fetched;

  // レート制限対策
  await new Promise((res) => setTimeout(res, 500));
}

console.log("\n=== 合計 ===");
console.log(`fetched:${totalFetched} inserted:${totalInserted} updated:${totalUpdated} skipped:${totalSkipped}`);

if (!DRY_RUN) {
  const count = db.prepare("SELECT COUNT(*) as c FROM hojokin_items").get().c;
  console.log(`hojokin_items 総件数: ${count}`);

  const byCat = db.prepare(
    "SELECT category, COUNT(*) as c FROM hojokin_items WHERE slug LIKE 'jgrants-%' GROUP BY category ORDER BY c DESC"
  ).all();
  console.log("カテゴリ別(J-Grants):", byCat.map((r) => `${r.category}:${r.c}`).join(", "));
}

db.close();
