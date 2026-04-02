/**
 * J-Grants補助金データ取込スクリプト
 * 使い方: node scripts/ingest-jgrants.mjs
 */

import Database from "better-sqlite3";

const BASE_URL = "https://api.jgrants-portal.go.jp/exp/v1/public";
const KEYWORDS = [
  "IT", "DX", "IoT", "AI", "補助金", "デジタル", "省エネ", "創業", "雇用",
  "ものづくり", "農業", "観光", "医療", "福祉", "建設", "製造", "輸出",
  "安全", "地域", "テレワーク"
];
const RATE_LIMIT_MS = 500;

// ─── ユーティリティ ──────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDeadline(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const match2 = s.match(/(\d{4})[\/](\d{1,2})[\/](\d{1,2})/);
  if (match2) return `${match2[1]}-${match2[2].padStart(2,"0")}-${match2[3].padStart(2,"0")}`;
  return null;
}

// ─── カテゴリ正規化 ──────────────────────────────────────

const CATEGORY_KEYWORDS = [
  { keys: ["IT", "DX", "デジタル", "情報通信", "テレワーク", "IoT", "AI", "ICT", "システム"], cat: "it" },
  { keys: ["設備", "ものづくり", "製造", "生産", "機械", "省エネ", "エネルギー"], cat: "equipment" },
  { keys: ["創業", "スタートアップ", "起業", "ベンチャー"], cat: "startup" },
  { keys: ["雇用", "人材", "採用", "労働", "働き方", "人手不足"], cat: "employment" },
  { keys: ["研究開発", "研究", "R&D", "開発", "イノベーション"], cat: "rd" },
  { keys: ["輸出", "海外", "貿易", "グローバル", "国際"], cat: "export" },
];

function normalizeCategory(industry, usePurpose) {
  const text = [industry, usePurpose].filter(Boolean).join(" ");
  if (!text) return "other";
  for (const { keys, cat } of CATEGORY_KEYWORDS) {
    for (const key of keys) {
      if (text.includes(key)) return cat;
    }
  }
  return "other";
}

// ─── J-Grants API ────────────────────────────────────────

async function fetchSubsidiesByKeyword(keyword) {
  // sort+order パラメータが必須（なしだと400）
  const url = `${BASE_URL}/subsidies?keyword=${encodeURIComponent(keyword)}&acceptance=1&sort=acceptance_start_datetime&order=DESC`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 compatible; HojokinBot/1.0" }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`  ⚠️  keyword="${keyword}" → HTTP ${res.status} ${body.substring(0,100)}`);
      return [];
    }
    const json = await res.json();
    const items = json.result || [];
    console.log(`  📥 keyword="${keyword}" → ${items.length}件`);
    return items;
  } catch (e) {
    console.warn(`  ⚠️  keyword="${keyword}" → エラー: ${e.message}`);
    return [];
  }
}

async function fetchSubsidyDetail(id) {
  const url = `${BASE_URL}/subsidies/id/${id}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 compatible; HojokinBot/1.0" }
    });
    if (!res.ok) {
      console.warn(`  ⚠️  detail id=${id} → HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return json.result?.[0] || null;
  } catch (e) {
    console.warn(`  ⚠️  detail id=${id} → エラー: ${e.message}`);
    return null;
  }
}

// ─── 正規化 ──────────────────────────────────────────────

function normalizeItem(detail) {
  const id = detail.id;
  const slug = `jgrants_${id}`;
  const title = detail.title || detail.name || "";
  if (!title) return null;

  const category = normalizeCategory(detail.industry, detail.use_purpose);

  const targetRaw = detail.target_number_of_employees || "";
  const targetType = "corp"; // J-Grantsは主に法人向け補助金

  const maxAmount = detail.subsidy_max_limit ? (parseInt(detail.subsidy_max_limit) || null) : null;
  const subsidyRate = detail.subsidy_rate ? String(detail.subsidy_rate).trim() : null;

  const deadline = normalizeDeadline(detail.acceptance_end_datetime);
  const status = "open";

  const providerName = detail.institution_name || detail.target_area_search || null;

  let summary = "";
  if (detail.subsidy_catch_phrase) {
    summary = String(detail.subsidy_catch_phrase).trim();
  } else if (detail.detail) {
    summary = stripHtml(detail.detail).substring(0, 200);
  }
  if (!summary && detail.name) {
    summary = String(detail.name).trim();
  }

  const sourceUrl = `https://jgrants-portal.go.jp/subsidy/${id}`;
  const now = new Date().toISOString();

  return {
    slug,
    title,
    category,
    target_type: targetType,
    max_amount: maxAmount,
    subsidy_rate: subsidyRate,
    deadline,
    status,
    provider_name: providerName,
    summary: summary || null,
    is_published: 1,
    source_name: "J-Grants（デジタル庁）",
    source_url: sourceUrl,
    detail_url: sourceUrl,
    created_at: now,
    updated_at: now,
  };
}

// ─── DB upsert ───────────────────────────────────────────

function setupDb(db) {
  const upsert = db.prepare(`
    INSERT INTO hojokin_items
      (slug, title, category, target_type, max_amount, subsidy_rate, deadline, status,
       provider_name, summary, is_published, source_name, source_url, detail_url,
       created_at, updated_at)
    VALUES
      (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate, @deadline, @status,
       @provider_name, @summary, @is_published, @source_name, @source_url, @detail_url,
       @created_at, @updated_at)
    ON CONFLICT(slug) DO UPDATE SET
      title        = excluded.title,
      category     = excluded.category,
      target_type  = excluded.target_type,
      max_amount   = excluded.max_amount,
      subsidy_rate = excluded.subsidy_rate,
      deadline     = excluded.deadline,
      status       = excluded.status,
      provider_name = excluded.provider_name,
      summary      = excluded.summary,
      is_published = excluded.is_published,
      source_name  = excluded.source_name,
      source_url   = excluded.source_url,
      detail_url   = excluded.detail_url,
      updated_at   = excluded.updated_at
  `);

  const checkExists = db.prepare(`SELECT id FROM hojokin_items WHERE slug = ?`);

  return { upsert, checkExists };
}

// ─── メイン ──────────────────────────────────────────────

async function main() {
  console.log("🚀 J-Grants補助金データ取込 開始");
  console.log(`📋 対象キーワード: ${KEYWORDS.join(", ")}\n`);

  // Step1: 全キーワードで一覧取得
  console.log("=== Step 1: キーワード別一覧取得 ===");
  const uniqueIds = new Map(); // id -> 基本情報

  for (const keyword of KEYWORDS) {
    const items = await fetchSubsidiesByKeyword(keyword);
    for (const item of items) {
      if (item.id && !uniqueIds.has(item.id)) {
        uniqueIds.set(item.id, item);
      }
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n✅ ユニークID: ${uniqueIds.size}件\n`);

  // Step2: 詳細取得
  console.log("=== Step 2: 詳細データ取得 ===");
  const ids = Array.from(uniqueIds.keys());
  const details = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    process.stdout.write(`  [${i + 1}/${ids.length}] id=${id} ... `);
    const detail = await fetchSubsidyDetail(id);
    if (detail) {
      details.push(detail);
      process.stdout.write("OK\n");
    } else {
      process.stdout.write("SKIP\n");
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n✅ 詳細取得完了: ${details.length}件\n`);

  // Step3: DB投入
  console.log("=== Step 3: DB投入 ===");
  const db = new Database("./data/sports-event.db");
  const { upsert, checkExists } = setupDb(db);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  const insertMany = db.transaction((items) => {
    for (const detail of items) {
      try {
        const normalized = normalizeItem(detail);
        if (!normalized) {
          skipped++;
          continue;
        }

        const existing = checkExists.get(normalized.slug);
        upsert.run(normalized);

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      } catch (e) {
        errors.push(`id=${detail.id}: ${e.message}`);
        skipped++;
      }
    }
  });

  insertMany(details);
  db.close();

  // Step4: レポート
  console.log("\n=== 取込結果レポート ===");
  console.log(`  📥 取得ユニークID  : ${uniqueIds.size}件`);
  console.log(`  📋 詳細取得        : ${details.length}件`);
  console.log(`  ✅ INSERT (新規)   : ${inserted}件`);
  console.log(`  🔄 UPDATE (更新)   : ${updated}件`);
  console.log(`  ⏭️  SKIP           : ${skipped}件`);
  if (errors.length > 0) {
    console.log(`\n  ❌ エラー (${errors.length}件):`);
    errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`\n🎉 完了: DB投入合計 ${inserted + updated}件`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
