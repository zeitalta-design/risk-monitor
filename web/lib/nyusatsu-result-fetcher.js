/**
 * 調達ポータル 落札実績オープンデータ fetcher
 *
 * https://www.p-portal.go.jp/pps-web-biz/UAB02/OAB0201
 *
 * 旧 GEPS が統合された調達ポータルから、落札結果 CSV を取得し
 * nyusatsu_results テーブルに upsert する。
 *
 * CSV は UTF-8 BOM 付き、ヘッダーなし、8列:
 *   0: 調達案件番号
 *   1: 案件名称
 *   2: 開札日 (YYYY-MM-DD)
 *   3: 落札金額 (小数点付き文字列)
 *   4: 調達方式区分コード
 *   5: 発注機関コード
 *   6: 落札者名称
 *   7: 落札者法人番号
 *
 * データ種別:
 *   - 全件 (年度別): successful_bid_record_info_all_{YYYY}.zip
 *   - 日次差分: successful_bid_record_info_diff_{YYYYMMDD}.zip
 *
 * 使い方:
 *   日次 cron → diff ファイル取得 → 差分 upsert
 *   初回 or 補完 → all ファイル取得 → 全件 upsert
 */

import { getDb } from "@/lib/db";
import { upsertNyusatsuResult } from "@/lib/repositories/nyusatsu";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const DL_BASE = "https://api.p-portal.go.jp/pps-web-biz/UAB03/OAB0301?fileversion=v001&filename=";
const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const TIMEOUT_MS = 60000;

// 調達方式コード → 日本語ラベル（推定マッピング）
const METHOD_LABELS = {
  P1: "一般競争入札（最低価格）",
  P2: "一般競争入札（総合評価）",
  P3: "一般競争入札（その他）",
  L1: "企画競争（プロポーザル）",
  S1: "随意契約",
  S5: "随意契約（少額）",
  D1: "公募",
  W1: "その他",
};

/**
 * 調達ポータルから落札結果を取得して DB に upsert する
 *
 * @param {object} opts
 * @param {"diff"|"all"} [opts.mode="diff"] diff=日次差分 / all=全件（年度指定）
 * @param {string} [opts.date] diff モード: YYYYMMDD（省略時は昨日）
 * @param {number} [opts.year] all モード: 西暦年（省略時は今年度）
 * @param {boolean} [opts.dryRun=false]
 * @param {function} [opts.logger]
 */
export async function fetchPPortalResults({
  mode = "diff",
  date,
  year,
  dryRun = false,
  logger = console.log,
} = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[pportal-fetcher] ${msg}`);

  // ファイル名決定
  let filename;
  if (mode === "all") {
    const y = year || new Date().getFullYear();
    filename = `successful_bid_record_info_all_${y}.zip`;
  } else {
    if (!date) {
      const yesterday = new Date(Date.now() - 86400000);
      date = yesterday.toISOString().slice(0, 10).replace(/-/g, "");
    }
    filename = `successful_bid_record_info_diff_${date}.zip`;
  }

  const url = `${DL_BASE}${filename}`;
  log(`${mode === "all" ? "全件" : "日次差分"}: ${filename}`);
  log(`📍 ${url}`);

  // ダウンロード
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${filename}`);
  const buf = Buffer.from(await res.arrayBuffer());
  log(`  ダウンロード完了: ${(buf.length / 1024).toFixed(1)}KB`);

  // ZIP 解凍（xlsx ライブラリの cfb/zip 機能を利用）
  const csvText = extractCsvFromZip(buf);
  if (!csvText) throw new Error("ZIP 内に CSV が見つかりません");

  // CSV パース
  const rows = parseCsv(csvText);
  log(`  パース完了: ${rows.length}件`);

  // DB upsert
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    if (!row.title || row.title.length < 3) { skipped++; continue; }

    const slug = `pportal-${row.procurementId}`;
    const result = {
      slug,
      nyusatsu_item_id: null, // 公告との紐付けは後続処理
      title: row.title,
      issuer_name: row.issuerCode, // TODO: コード→名称変換
      winner_name: row.winnerName,
      winner_corporate_number: row.corporateNumber || null,
      award_amount: row.awardAmount,
      award_date: row.awardDate,
      num_bidders: null, // CSV には含まれない
      award_rate: null,  // 予定価格が不明のため計算不可
      budget_amount: null,
      category: guessCategoryFromTitle(row.title),
      target_area: null,
      bidding_method: METHOD_LABELS[row.methodCode] || row.methodCode,
      result_url: `https://www.p-portal.go.jp/pps-web-biz/UAA01/OAA0101`,
      source_name: "調達ポータル（落札実績オープンデータ）",
      source_url: url,
      summary: null,
      is_published: 1,
    };

    if (dryRun) { inserted++; continue; }
    try {
      const r = upsertNyusatsuResult(result);
      r.action === "insert" ? inserted++ : updated++;
    } catch (err) {
      if (!err.message.includes("UNIQUE")) {
        log(`  ! ${row.title.slice(0, 40)}: ${err.message}`);
      }
      skipped++;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: inserted=${inserted} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('nyusatsu_results', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(rows.length, inserted, updated);
    } catch { /* ignore */ }
  }

  return { ok: true, filename, totalRows: rows.length, inserted, updated, skipped, elapsed };
}

// ─── ZIP → CSV 抽出 ─────────────────────

function extractCsvFromZip(zipBuffer) {
  const dir = join(tmpdir(), `pportal_${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const zipPath = join(dir, "data.zip");
  writeFileSync(zipPath, zipBuffer);

  try {
    // Ubuntu (GitHub Actions): unzip, Windows: PowerShell
    try {
      execSync(`unzip -o "${zipPath}" -d "${dir}"`, { timeout: 10000, stdio: "pipe" });
    } catch {
      execSync(`powershell Expand-Archive -Force -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(dir)}`, { timeout: 10000, stdio: "pipe" });
    }

    const csvFile = readdirSync(dir).find((f) => f.endsWith(".csv"));
    if (!csvFile) return null;

    let text = readFileSync(join(dir, csvFile), "utf8");
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    return text;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── CSV パース ─────────────────────

function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const results = [];

  for (const line of lines) {
    // クォート付き CSV パース
    const fields = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);

    if (fields.length < 7) continue;

    results.push({
      procurementId: fields[0]?.trim(),
      title: fields[1]?.trim(),
      awardDate: fields[2]?.trim(),
      awardAmount: parseFloat(fields[3]) || null,
      methodCode: fields[4]?.trim(),
      issuerCode: fields[5]?.trim(),
      winnerName: fields[6]?.trim(),
      corporateNumber: fields[7]?.trim() || null,
    });
  }

  return results;
}

// ─── カテゴリ推定 ─────────────────────

function guessCategoryFromTitle(title) {
  const t = String(title);
  if (/工事|建設|土木|橋梁|道路|トンネル|舗装/.test(t)) return "construction";
  if (/業務委託|コンサル|調査|設計|測量|計画/.test(t)) return "consulting";
  if (/システム|ＩＴ|IT|ソフト|アプリ|データ|DX/.test(t)) return "it";
  if (/物品|什器|備品|機器|車両|購入|調達/.test(t)) return "goods";
  if (/清掃|警備|管理|運営|保守|メンテ/.test(t)) return "service";
  return "other";
}
