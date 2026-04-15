/**
 * 産廃（sanpai）取得ロジック
 *
 * ソース1: 大阪府 産廃許可取消一覧（Excel）
 *   https://www.pref.osaka.lg.jp/o120060/sangyohaiki/sanpai/torikeshishobun.html
 * ソース2: 神奈川県 産廃許可取消一覧（HTML テーブル）
 *   https://www.pref.kanagawa.jp/docs/p3k/cnt/f91/index.html
 *
 * 旧 scripts/ingest-sanpai.mjs の Python/better-sqlite3 依存を排除し、
 * Node.js/libsql 単独で動作するよう刷新。
 */
import { getDb } from "@/lib/db";
import * as XLSX from "xlsx";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;

export async function fetchAndUpsertSanpai({ dryRun = false, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[sanpai-fetcher] ${msg}`);
  const db = getDb();

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

  const sources = [];
  try {
    const r1 = await ingestOsaka({ db, upsertStmt, dryRun, log });
    sources.push({ name: "osaka", ...r1 });
  } catch (e) {
    log(`osaka failed: ${e.message}`);
    sources.push({ name: "osaka", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r2 = await ingestKanagawa({ db, upsertStmt, dryRun, log });
    sources.push({ name: "kanagawa", ...r2 });
  } catch (e) {
    log(`kanagawa failed: ${e.message}`);
    sources.push({ name: "kanagawa", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  const totalInserted = sources.reduce((s, r) => s + (r.inserted || 0), 0);
  const totalUpdated = sources.reduce((s, r) => s + (r.updated || 0), 0);
  const totalSkipped = sources.reduce((s, r) => s + (r.skipped || 0), 0);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('sanpai', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalInserted + totalUpdated, totalInserted, totalUpdated);
    } catch {
      /* ignore */
    }
  }

  return { ok: true, sources, totalInserted, totalUpdated, totalSkipped, elapsed };
}

// ─── ソース1: 大阪府 Excel ────────────────────────────

async function ingestOsaka({ db, upsertStmt, dryRun, log }) {
  const INDEX_URL = "https://www.pref.osaka.lg.jp/o120060/sangyohaiki/sanpai/torikeshishobun.html";
  log("大阪府 産廃許可取消一覧（Excel）");

  // インデックスページから最新の xlsx リンクを抽出（日付付きファイル名のため）
  const indexRes = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!indexRes.ok) throw new Error(`Osaka index HTTP ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  const xlsxMatch = indexHtml.match(/href="([^"]+\.xlsx)"[^>]*>[^<]*(?:取消|許可)/i)
    || indexHtml.match(/href="([^"]+torikeshi[^"]*\.xlsx)"/i)
    || indexHtml.match(/href="([^"]+\.xlsx)"/i);
  if (!xlsxMatch) throw new Error("xlsx リンクが見つかりません");

  let excelUrl = xlsxMatch[1];
  if (excelUrl.startsWith("/")) {
    excelUrl = `https://www.pref.osaka.lg.jp${excelUrl}`;
  } else if (!excelUrl.startsWith("http")) {
    excelUrl = new URL(excelUrl, INDEX_URL).href;
  }
  log(`  Excel URL: ${excelUrl}`);

  const excelRes = await fetch(excelUrl, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!excelRes.ok) throw new Error(`Excel HTTP ${excelRes.status}`);
  const excelBuf = Buffer.from(await excelRes.arrayBuffer());

  const workbook = XLSX.read(excelBuf, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // ヘッダー行を特定
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const cells = aoa[i].map((c) => String(c || "").trim());
    if (cells.some((c) => c.includes("取消処分の年月日") || c.includes("処分日") || c === "年月日")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("ヘッダー行が見つかりません");

  const rows = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.length < 5) continue;
    const dateVal = row[1];
    const nameVal = row[2];
    const addrVal = row[3];
    const licVal = row[4];
    const contentVal = row.length > 5 ? row[5] : null;

    if (!nameVal || String(nameVal).trim() === "") continue;

    let dateStr = null;
    if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) {
      dateStr = dateVal.toISOString().slice(0, 10);
    } else if (dateVal) {
      const m = String(dateVal).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (m) dateStr = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    rows.push({
      date: dateStr,
      name: String(nameVal).trim().replace(/\n/g, " "),
      address: addrVal ? String(addrVal).trim() : "",
      license_num: licVal ? String(licVal).trim() : "",
      content: contentVal ? String(contentVal).trim() : "",
    });
  }
  log(`  取得行数: ${rows.length}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    if (!r.name || r.name.length < 2) { skipped++; continue; }
    const pref = extractPrefecture(r.address) || "大阪府";
    const city = extractCity(r.address);
    const slug = toSlug("osaka-sanpai", r.name, r.license_num);
    const item = {
      slug,
      company_name: r.name,
      corporate_number: null,
      prefecture: pref,
      city: city || null,
      license_type: normalizeLicenseType(r.content),
      waste_category: "industrial",
      business_area: "大阪府",
      status: "revoked",
      risk_level: "critical",
      penalty_count: 1,
      latest_penalty_date: r.date || null,
      source_name: "大阪府産廃許可取消一覧",
      source_url: INDEX_URL,
      detail_url: INDEX_URL,
      notes: r.content ? r.content.slice(0, 200) : null,
    };
    if (dryRun) { inserted++; continue; }
    try {
      const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (e) {
      log(`  ! ${r.name}: ${e.message}`);
      skipped++;
    }
  }
  log(`  osaka: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース2: 神奈川県 HTML ────────────────────────────

async function ingestKanagawa({ db, upsertStmt, dryRun, log }) {
  const SOURCE_URL = "https://www.pref.kanagawa.jp/docs/p3k/cnt/f91/index.html";
  log("神奈川県 産廃許可取消一覧（HTML）");

  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kanagawa HTTP ${res.status}`);
  const html = await res.text();

  const rows = [];
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cellMatches = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    const texts = cellMatches.map((m) => {
      return m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
    });
    if (texts.length < 3) continue;
    if (!texts[0] || texts[0] === "処分日" || texts[0] === "年月日") continue;
    // 令和/平成で始まる日付行のみ
    if (!/[令平][和]?\d/.test(texts[0])) continue;

    const dateRaw = texts[0];
    const licenseInfo = texts[1] || "";
    const nameInfo = texts[2] || "";

    const licMatch = licenseInfo.match(/[（(](\d{9,14})[）)]/);
    const licNum = licMatch ? licMatch[1] : "";

    let dateStr = null;
    const m = dateRaw.match(/令和(\d+)年(\d+)月(\d+)日/);
    if (m) {
      const y = 2018 + parseInt(m[1]);
      dateStr = `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    const parts = nameInfo.split(/[\n\r　]/).map((s) => s.trim()).filter(Boolean);
    const company = parts[0] || nameInfo;
    const address = parts.length > 1 ? parts.slice(1).join(" ") : "";
    if (!company || company.length < 2) continue;

    rows.push({
      date: dateStr,
      name: company,
      address,
      license_info: licenseInfo,
      license_num: licNum,
    });
  }
  log(`  取得行数: ${rows.length}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const pref = extractPrefecture(r.address) || "神奈川県";
    const city = extractCity(r.address);
    const slug = toSlug("kanagawa-sanpai", r.name, r.license_num);
    const item = {
      slug,
      company_name: r.name,
      corporate_number: null,
      prefecture: pref,
      city: city || null,
      license_type: normalizeLicenseType(r.license_info),
      waste_category: "industrial",
      business_area: "神奈川県",
      status: "revoked",
      risk_level: "critical",
      penalty_count: 1,
      latest_penalty_date: r.date || null,
      source_name: "神奈川県産廃許可取消一覧",
      source_url: SOURCE_URL,
      detail_url: SOURCE_URL,
      notes: r.license_info ? r.license_info.slice(0, 200) : null,
    };
    if (dryRun) { inserted++; continue; }
    try {
      const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (e) {
      log(`  ! ${r.name}: ${e.message}`);
      skipped++;
    }
  }
  log(`  kanagawa: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ユーティリティ ────────────────────────────

function toSlug(prefix, name, extra = "") {
  const base = String(name)
    .replace(/株式会社|有限会社|合同会社/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40);
  const suffix = extra ? `-${String(extra).replace(/[^\w]/g, "").substring(0, 12)}` : "";
  return `${prefix}-${base}${suffix}` || `${prefix}-item`;
}

function normalizeLicenseType(text) {
  const t = String(text || "");
  if (t.includes("最終処分")) return "final_disposal";
  if (t.includes("中間処理") || t.includes("中間処分")) return "intermediate_disposal";
  if (t.includes("収集運搬")) return "collection_transport";
  return "collection_transport";
}

function extractPrefecture(address) {
  if (!address) return null;
  const m = String(address).match(/^(東京都|北海道|(?:大阪|京都)府|\S+?県)/);
  return m ? m[1] : null;
}

function extractCity(address) {
  if (!address) return null;
  const m = String(address).match(/^(?:東京都|北海道|(?:\S+?)府|(?:\S+?)県)(.+?(?:市|区|町|村))/);
  return m ? m[1].trim() : null;
}
