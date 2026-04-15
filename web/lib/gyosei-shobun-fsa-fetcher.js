/**
 * 金融庁 行政処分事例集（Excel）取得
 *
 * https://www.fsa.go.jp/status/s_jirei/kouhyou.html から
 * Excel ファイル s_jirei.xlsx をダウンロードして全件パース。
 * administrative_actions に upsert する。
 *
 * 列構造:
 *   年度 / 公表日 / 解除の有無 / 業態1 / 業態2 / 金融機関等名 /
 *   法人番号 / 根拠法令 / 処分の種類 / 処分の内容 / 主たる処分原因 / 主たる契機
 *
 * 累計 2800件超（平成14年度〜最新、四半期更新）
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";
import * as XLSX from "xlsx";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 60000;
const INDEX_URL = "https://www.fsa.go.jp/status/s_jirei/kouhyou.html";

export async function fetchAndUpsertFsaJirei({ dryRun = false, limit = 0, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[fsa-jirei] ${msg}`);
  const db = getDb();

  // インデックスから .xlsx URL を動的取得
  log(`📍 ${INDEX_URL}`);
  const idxRes = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!idxRes.ok) throw new Error(`index HTTP ${idxRes.status}`);
  const idxHtml = await idxRes.text();
  const xlsxMatch = idxHtml.match(/href="([^"]+s_jirei[^"]*\.xlsx)"/i)
    || idxHtml.match(/href="([^"]+\.xlsx)"/i);
  if (!xlsxMatch) throw new Error("xlsx URL not found");
  let xlsxUrl = xlsxMatch[1];
  if (xlsxUrl.startsWith("/")) xlsxUrl = `https://www.fsa.go.jp${xlsxUrl}`;
  else if (!xlsxUrl.startsWith("http")) xlsxUrl = new URL(xlsxUrl, INDEX_URL).href;
  log(`  Excel URL: ${xlsxUrl}`);

  const xlsxRes = await fetch(xlsxUrl, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!xlsxRes.ok) throw new Error(`xlsx HTTP ${xlsxRes.status}`);
  const buf = Buffer.from(await xlsxRes.arrayBuffer());
  log(`  downloaded: ${buf.length} bytes`);

  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  log(`  rows: ${aoa.length}`);

  // ヘッダー行を特定（「金融機関等名」「処分の種類」を含む行）
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cells = aoa[i].map((c) => String(c || ""));
    if (cells.some((c) => c.includes("金融機関等名")) && cells.some((c) => c.includes("処分の種類"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("header row not found");

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, industry,
       summary, source_name, source_url, is_published, review_status,
       created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       '金融庁', 'national', NULL, @industry,
       @summary, '金融庁 行政処分事例集', @source_url, 1, 'approved',
       datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      updated_at            = datetime('now')
  `);

  let processed = 0, created = 0, updated = 0, skipped = 0;
  const targetRows = limit > 0 ? aoa.slice(headerIdx + 1, headerIdx + 1 + limit) : aoa.slice(headerIdx + 1);

  for (const row of targetRows) {
    if (!row || row.length < 6) continue;
    // 列マッピング:
    //   [0]年度 [1]公表日 [2]解除 [3]業態1 [4]業態2 [5]金融機関等名
    //   [6]法人番号 [7]根拠法令 [8]処分の種類 [9]処分の内容
    //   [10]主たる処分原因 [11]主たる契機
    const orgName = String(row[5] || "").trim();
    if (!orgName || orgName.length < 2) continue;
    if (shouldSkipAsCompanyName(orgName)) { skipped++; continue; }

    const actionDate = parseExcelDate(row[1]);
    const industryCategory = inferIndustry(row[3], row[4]);
    const actionType = normalizeActionType(row[8]);
    const summaryParts = [];
    if (row[8]) summaryParts.push(`【${row[8]}】`);
    if (row[9]) summaryParts.push(String(row[9]));
    if (row[10]) summaryParts.push(`原因: ${row[10]}`);
    const summary = summaryParts.join(" ").slice(0, 500);
    const slug = `fsa-${actionDate || "nodate"}-${slugify(orgName)}`;

    processed++;
    if (dryRun) continue;
    try {
      const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
      upsertStmt.run({
        slug,
        org: orgName.slice(0, 100),
        action_type: actionType,
        action_date: actionDate,
        industry: industryCategory,
        summary,
        source_url: xlsxUrl,
      });
      before ? updated++ : created++;
    } catch {
      skipped++;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: processed=${processed} created=${created} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('gyosei-shobun-fsa', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(processed, created, updated);
    } catch { /* ignore */ }
  }

  return { ok: true, processed, created, updated, skipped, elapsed };
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val);
  const m = s.match(/(\d{4}).*?(\d{1,2}).*?(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function inferIndustry(t1, t2) {
  const text = `${t1 || ""} ${t2 || ""}`;
  if (/銀行|預金/.test(text)) return "banking";
  if (/保険/.test(text)) return "insurance";
  if (/証券|金融商品取引/.test(text)) return "securities";
  if (/投資運用|投資助言/.test(text)) return "investment";
  if (/暗号資産|仮想通貨/.test(text)) return "crypto";
  if (/貸金|信販/.test(text)) return "lending";
  return "finance_other";
}

function normalizeActionType(raw) {
  const s = String(raw || "");
  if (s.includes("登録取消") || s.includes("免許取消") || s.includes("認可取消")) return "license_revocation";
  if (s.includes("業務停止")) return "business_suspension";
  if (s.includes("業務改善命令")) return "improvement_order";
  if (s.includes("業務廃止")) return "business_termination";
  if (s.includes("勧告")) return "recommendation";
  if (s.includes("注意")) return "warning";
  return "other";
}

function slugify(s) {
  return String(s)
    .replace(/株式会社|有限会社|合同会社/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40) || "item";
}
