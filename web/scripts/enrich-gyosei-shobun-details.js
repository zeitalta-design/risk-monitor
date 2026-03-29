#!/usr/bin/env node
/**
 * 行政処分DB — summary/detail 品質強化スクリプト
 *
 * MLIT詳細ページから「処分の原因となった事実」「根拠法令」「処分の内容（詳細）」を
 * 取得し、既存レコードの summary / detail / legal_basis を更新する。
 *
 * 既存の月次cron（--no-detail）とは分離した手動実行用。
 *
 * Usage:
 *   node scripts/enrich-gyosei-shobun-details.js --dry-run --limit=5
 *   node scripts/enrich-gyosei-shobun-details.js --limit=20
 *   node scripts/enrich-gyosei-shobun-details.js --only-thin
 *   node scripts/enrich-gyosei-shobun-details.js --ids=23,24,25
 */

const https = require("https");
const { URL } = require("url");

// ─── 設定 ───
const DETAIL_DELAY_MS = 1200;
const MAX_ERRORS = 10;

// ─── CLI引数 ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_THIN = args.includes("--only-thin");
const LIMIT = getArgInt("--limit");
const IDS = getArgStr("--ids");

function getArgInt(prefix) {
  const m = args.find((a) => a.startsWith(prefix + "="));
  return m ? parseInt(m.split("=")[1]) : null;
}
function getArgStr(prefix) {
  const m = args.find((a) => a.startsWith(prefix + "="));
  return m ? m.split("=")[1] : null;
}

// ─── HTTP GET ───
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { "User-Agent": "TaikaiNavi-GyoseiShobun/1.0 (detail enrichment)" },
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function stripTags(html) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// ─── MLIT詳細ページパーサー ───
// 構造: <dt class="title">ラベル</dt><dd class="text">値</dd>
function parseDetailPage(html) {
  const result = { cause: null, legalBasis: null, penaltyDetail: null };

  // dt/dd ペアを全抽出
  const pairRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let match;
  while ((match = pairRegex.exec(html)) !== null) {
    const label = stripTags(match[1]).trim();
    const value = stripTags(match[2]).replace(/\s+/g, " ").trim();
    if (!value) continue;

    if (label.includes("処分の原因となった事実")) {
      result.cause = value;
    } else if (label.includes("根拠法令")) {
      result.legalBasis = value;
    } else if (label.includes("処分の内容") && (label.includes("詳細") || !result.penaltyDetail)) {
      result.penaltyDetail = value;
    }
  }

  return result;
}

// ─── summary生成 ───
function generateSummary(item, detail) {
  const parts = [];

  // 1文目: 基本情報
  const actionLabel = {
    license_revocation: "許可取消処分",
    business_suspension: "営業停止処分",
    improvement_order: "改善命令",
    warning: "指示処分",
    guidance: "指導",
  }[item.action_type] || "行政処分";

  parts.push(`${item.organization_name_raw}に対する${actionLabel}。`);

  // 2文目: 原因（あれば短縮して追加）
  if (detail.cause) {
    let cause = detail.cause;
    // 長い場合は最初の文を取る
    const firstSentence = cause.match(/^(.+?[。．])/);
    if (firstSentence && firstSentence[1].length < 120) {
      cause = firstSentence[1];
    } else if (cause.length > 120) {
      cause = cause.substring(0, 117) + "…";
    }
    parts.push(cause);
  }

  // 3文目: 根拠法令（あれば）
  if (detail.legalBasis && !parts.join("").includes(detail.legalBasis)) {
    parts.push(`根拠: ${detail.legalBasis}。`);
  }

  return parts.join(" ").substring(0, 300);
}

// ─── メイン処理 ───
async function main() {
  const Database = require("better-sqlite3");
  const { join } = require("path");
  const db = new Database(join(__dirname, "..", "data", "sports-event.db"));

  console.log("=== 行政処分DB — summary/detail 品質強化 ===");
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  // 対象レコード取得
  let whereClause = "WHERE source_url LIKE '%no=%'"; // 詳細URLがあるもの
  const params = {};

  if (IDS) {
    const idList = IDS.split(",").map(Number).filter(Boolean);
    whereClause += ` AND id IN (${idList.join(",")})`;
  }
  if (ONLY_THIN) {
    whereClause += " AND (detail IS NULL OR detail = '')";
  }

  let query = `SELECT * FROM administrative_actions ${whereClause} ORDER BY id`;
  if (LIMIT) query += ` LIMIT ${LIMIT}`;

  const targets = db.prepare(query).all();
  console.log(`対象: ${targets.length}件`);
  if (targets.length === 0) { console.log("対象なし"); db.close(); return; }

  const updateStmt = db.prepare(`
    UPDATE administrative_actions SET
      summary = @summary, detail = @detail, legal_basis = @legal_basis,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  let enriched = 0, skipped = 0, errors = 0;

  for (const item of targets) {
    if (errors >= MAX_ERRORS) {
      console.log(`\n⚠️ エラー上限(${MAX_ERRORS})に到達。停止。`);
      break;
    }

    try {
      const html = await httpGet(item.source_url);
      const detail = parseDetailPage(html);

      if (!detail.cause && !detail.penaltyDetail && !detail.legalBasis) {
        console.log(`  #${item.id} ${item.organization_name_raw}: 詳細取得不可（スキップ）`);
        skipped++;
        await sleep(DETAIL_DELAY_MS);
        continue;
      }

      const newSummary = generateSummary(item, detail);
      const newDetail = [detail.cause, detail.penaltyDetail].filter(Boolean).join("\n\n");
      const newLegalBasis = detail.legalBasis || item.legal_basis;

      if (DRY_RUN) {
        console.log(`\n  #${item.id} ${item.organization_name_raw}`);
        console.log(`    BEFORE summary: ${(item.summary || "").substring(0, 60)}`);
        console.log(`    AFTER  summary: ${newSummary.substring(0, 80)}`);
        console.log(`    legal_basis: ${newLegalBasis || "(null)"}`);
        console.log(`    detail length: ${newDetail.length}文字`);
      } else {
        updateStmt.run({
          id: item.id,
          summary: newSummary,
          detail: newDetail || null,
          legal_basis: newLegalBasis || null,
        });
        console.log(`  ✅ #${item.id} ${item.organization_name_raw} (summary: ${newSummary.length}字, detail: ${newDetail.length}字)`);
      }

      enriched++;
    } catch (e) {
      console.error(`  ❌ #${item.id}: ${e.message}`);
      errors++;
    }

    await sleep(DETAIL_DELAY_MS);
  }

  console.log(`\n=== 結果 ===`);
  console.log(`enriched: ${enriched}, skipped: ${skipped}, errors: ${errors}`);

  if (!DRY_RUN) {
    const total = db.prepare("SELECT COUNT(*) as c FROM administrative_actions WHERE detail IS NOT NULL AND detail != ''").get().c;
    console.log(`detail入力済み: ${total}件`);
  }

  db.close();
  console.log("=== 完了 ===");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
