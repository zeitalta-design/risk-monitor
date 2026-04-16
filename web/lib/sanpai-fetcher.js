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

  try {
    const r3 = await ingestTokyo({ db, upsertStmt, dryRun, log });
    sources.push({ name: "tokyo", ...r3 });
  } catch (e) {
    log(`tokyo failed: ${e.message}`);
    sources.push({ name: "tokyo", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r4 = await ingestHokkaido({ db, upsertStmt, dryRun, log });
    sources.push({ name: "hokkaido", ...r4 });
  } catch (e) {
    log(`hokkaido failed: ${e.message}`);
    sources.push({ name: "hokkaido", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r5 = await ingestChiba({ db, upsertStmt, dryRun, log });
    sources.push({ name: "chiba", ...r5 });
  } catch (e) {
    log(`chiba failed: ${e.message}`);
    sources.push({ name: "chiba", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r6 = await ingestSaitama({ db, upsertStmt, dryRun, log });
    sources.push({ name: "saitama", ...r6 });
  } catch (e) {
    log(`saitama failed: ${e.message}`);
    sources.push({ name: "saitama", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r7 = await ingestFukuoka({ db, upsertStmt, dryRun, log });
    sources.push({ name: "fukuoka", ...r7 });
  } catch (e) {
    log(`fukuoka failed: ${e.message}`);
    sources.push({ name: "fukuoka", error: e.message, inserted: 0, updated: 0, skipped: 0 });
  }

  try {
    const r8 = await ingestAichi({ db, upsertStmt, dryRun, log });
    sources.push({ name: "aichi", ...r8 });
  } catch (e) {
    log(`aichi failed: ${e.message}`);
    sources.push({ name: "aichi", error: e.message, inserted: 0, updated: 0, skipped: 0 });
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

// ─── ソース3: 東京都 プレスリリース（h3+本文型） ────────────────────────────

async function ingestTokyo({ db, upsertStmt, dryRun, log }) {
  const INDEX_URL = "https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/improper_handling/disposal_information";
  log("東京都 産廃行政処分（プレスリリース）");

  const indexRes = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!indexRes.ok) throw new Error(`Tokyo index HTTP ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  // プレスリリースURLを抽出: /information/press/YYYY/... または /tosei/hodohappyo/press/YYYY/...
  const pressPattern = /href="(https?:\/\/www\.metro\.tokyo\.lg\.jp\/(?:information\/press|tosei\/hodohappyo\/press)\/\d{4}\/[^"]+)"/gi;
  const pressLinks = new Set();
  let m;
  while ((m = pressPattern.exec(indexHtml)) !== null) {
    const url = m[1];
    // 関連性チェック: リンクテキストに「産業廃棄物」「行政処分」があるもの優先
    // 既に重複除去されているため、とりあえずすべて追加
    pressLinks.add(url);
  }
  // 最新のリリース5件まで処理（負荷軽減）
  const targets = [...pressLinks].slice(0, 5);
  log(`  対象プレスリリース: ${targets.length}件`);

  let inserted = 0, updated = 0, skipped = 0;
  const seenCompanies = new Set();

  for (const pressUrl of targets) {
    try {
      const res = await fetch(pressUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // ページタイトル（公表日推定用）から日付を取得
      let pressDate = null;
      const dateMatch = pressUrl.match(/\/(\d{4})\/(\d{2})\/(\d{8})/);
      if (dateMatch) {
        pressDate = `${dateMatch[3].slice(0, 4)}-${dateMatch[3].slice(4, 6)}-${dateMatch[3].slice(6, 8)}`;
      } else {
        const dm2 = pressUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        if (dm2) pressDate = `${dm2[1]}-${dm2[2]}-${dm2[3]}`;
      }

      // h3 セクションを抽出（名称/代表者氏名/住所/許可の種類/処分内容）
      const sections = html.split(/<h3[^>]*>/);
      let current = null;
      const entries = [];
      for (const s of sections.slice(1)) {
        const titleEnd = s.indexOf("</h3>");
        if (titleEnd < 0) continue;
        const label = s.slice(0, titleEnd).replace(/<[^>]+>/g, "").trim();
        let body = s.slice(titleEnd + 5);
        const nextH = body.search(/<h[123][^>]*>/);
        if (nextH >= 0) body = body.slice(0, nextH);
        const value = body
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim();

        if (label === "名称") {
          if (current && current.name) entries.push(current);
          current = { name: value, representative: "", address: "", license_info: "", action: "" };
        } else if (current) {
          if (label === "代表者氏名") current.representative = value;
          else if (label === "住所") current.address = value;
          else if (label === "許可の種類") current.license_info = value;
          else if (label === "処分内容") current.action = value;
        }
      }
      if (current && current.name) entries.push(current);

      for (const e of entries) {
        // 名称の読み仮名（かっこ内）を除去
        const cleanName = String(e.name).replace(/[（(][^）)]*[）)]$/, "").trim();
        if (!cleanName || cleanName.length < 2) { skipped++; continue; }
        if (seenCompanies.has(cleanName)) { skipped++; continue; }
        seenCompanies.add(cleanName);

        const licNumMatch = e.license_info.match(/第?\s*(\d{2}-\d{2}-\d{6})\s*号/);
        const licNum = licNumMatch ? licNumMatch[1] : "";
        const slug = toSlug("tokyo-sanpai", cleanName, licNum);

        const item = {
          slug,
          company_name: cleanName,
          corporate_number: null,
          prefecture: "東京都",
          city: extractCity(e.address),
          license_type: normalizeLicenseType(e.license_info),
          waste_category: "industrial",
          business_area: "東京都",
          status: /取消/.test(e.action) ? "revoked" : /停止/.test(e.action) ? "suspended" : "active",
          risk_level: /取消/.test(e.action) ? "critical" : "high",
          penalty_count: 1,
          latest_penalty_date: pressDate,
          source_name: "東京都産業廃棄物行政処分",
          source_url: INDEX_URL,
          detail_url: pressUrl,
          notes: e.action ? e.action.slice(0, 200) : null,
        };

        if (dryRun) { inserted++; continue; }
        try {
          const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
          upsertStmt.run(item);
          before ? updated++ : inserted++;
        } catch (err) {
          log(`  ! ${cleanName}: ${err.message}`);
          skipped++;
        }
      }

      // プレスリリース間に小さな待機（負荷配慮）
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      log(`  ! ${pressUrl}: ${e.message}`);
    }
  }

  log(`  tokyo: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース4: 北海道 単一HTML (dl/dd 集約) ────────────────────────────

async function ingestHokkaido({ db, upsertStmt, dryRun, log }) {
  const SOURCE_URL = "https://www.pref.hokkaido.lg.jp/ks/jss/sanpai_1/syobun_kouhyou/jyoukyou3.html";
  log("北海道 廃棄物処理法行政処分（単一HTML集約）");

  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Hokkaido HTTP ${res.status}`);
  const html = await res.text();

  // table ブロックを処理。各 table 内の <th>/<td> ペアから entry を構築
  const entries = [];
  const tableBlocks = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  for (const tm of tableBlocks) {
    const block = tm[1];
    const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const entry = {};
    for (const rm of rows) {
      const thm = rm[1].match(/<th[^>]*>([\s\S]*?)<\/th>/i);
      const tdm = rm[1].match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (!thm || !tdm) continue;
      const k = stripTags(thm[1]).replace(/[\s　]+/g, "");
      const v = stripTags(tdm[1]);
      if (k) entry[k] = v;
    }
    if (entry["処分の相手方"] || entry["相手方"]) entries.push(entry);
  }
  log(`  parsed entries: ${entries.length}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const e of entries) {
    const rawTarget = e["処分の相手方"] || e["相手方"] || "";
    const dateText = e["処分した日"] || e["処分日"] || "";
    const baseLaw = e["処分の根拠法令"] || e["根拠法令"] || "";
    const action = e["処分の内容"] || e["内容"] || "";
    const violation = e["違反内容"] || e["違反の概要"] || "";

    // 事業者名と住所を分離: 「会社名（住所）」または「会社名 住所」
    const m = rawTarget.match(/^([^（(]+)[（(]([^）)]+)[）)]/);
    const company = (m ? m[1] : rawTarget.split(/[\s　]+/)[0]).trim();
    const address = (m ? m[2] : "").trim();
    if (!company || company.length < 2) { skipped++; continue; }

    const dateStr = parseJapaneseDate(dateText);
    const status = /取消/.test(action) ? "revoked" : /停止/.test(action) ? "suspended" : "active";
    const riskLevel = /取消/.test(action) ? "critical" : "high";

    const slug = toSlug("hokkaido-sanpai", company, dateStr || "");
    const item = {
      slug,
      company_name: company,
      corporate_number: null,
      prefecture: "北海道",
      city: extractCity(address),
      license_type: normalizeLicenseType(action),
      waste_category: "industrial",
      business_area: "北海道",
      status,
      risk_level: riskLevel,
      penalty_count: 1,
      latest_penalty_date: dateStr,
      source_name: "北海道 廃棄物処理法行政処分公表",
      source_url: SOURCE_URL,
      detail_url: SOURCE_URL,
      notes: [action, violation, baseLaw && `根拠: ${baseLaw}`].filter(Boolean).join(" / ").slice(0, 300),
    };

    if (dryRun) { inserted++; continue; }
    try {
      const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (err) {
      log(`  ! ${company}: ${err.message}`);
      skipped++;
    }
  }
  log(`  hokkaido: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース5: 千葉県 年度index→個別press ────────────────────────────

async function ingestChiba({ db, upsertStmt, dryRun, log }) {
  const INDEX_URL = "https://www.pref.chiba.lg.jp/haishi/gyouseishobun/shobun.html";
  log("千葉県 廃棄物処理法行政処分（press 集約）");

  const indexRes = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!indexRes.ok) throw new Error(`Chiba HTTP ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  // 年度別ページ: houdou{YYYY}.html を抽出
  const yearPages = [...indexHtml.matchAll(/href="([^"]*houdou\d{4}\.html)"/gi)]
    .map((m) => resolveUrl(m[1], INDEX_URL));
  // 個別press: shobun{YYYYMMDD}.html を抽出
  const directPress = [...indexHtml.matchAll(/href="([^"]*\/(?:press|gyouseishobun)\/[^"]*shobun\d{8}\.html)"/gi)]
    .map((m) => resolveUrl(m[1], INDEX_URL));

  // 年度ページ経由でも press URL を集める
  const allPress = new Set(directPress);
  for (const yp of yearPages.slice(0, 6)) { // 直近6年分
    try {
      const yres = await fetch(yp, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!yres.ok) continue;
      const yh = await yres.text();
      [...yh.matchAll(/href="([^"]*shobun\d{8}\.html)"/gi)].forEach((m) => allPress.add(resolveUrl(m[1], yp)));
      await sleep(300);
    } catch { /* ignore */ }
  }
  log(`  press URLs: ${allPress.size}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const url of allPress) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) { skipped++; continue; }
      const h = await r.text();

      // press の URL から日付を抽出
      const dm = url.match(/shobun(\d{4})(\d{2})(\d{2})/);
      const dateStr = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : null;

      // h2/h3 で 事業者ブロックを分割
      const sections = h.split(/<h[23][^>]*>/);
      for (const sec of sections.slice(1)) {
        const titleEnd = sec.indexOf("</h");
        if (titleEnd < 0) continue;
        const title = stripTags(sec.slice(0, titleEnd)).trim();
        if (!title || /目次|お問い合わせ|関連情報|処分基準/.test(title)) continue;
        // 事業者名らしき行のみ採用（カッコ・有・株 を含むもの）
        const nameMatch = title.match(/^([^（(\s]+(?:株式会社|有限会社|合同会社)?[^（(\s]*)/);
        const company = nameMatch ? nameMatch[1].trim() : title.replace(/[（(].*$/, "").trim();
        if (!company || company.length < 2 || company.length > 60) continue;
        if (/平成|令和|処分|内容|理由|備考/.test(company)) continue;

        const body = stripTags(sec.slice(titleEnd));
        const action = (body.match(/処分(?:の)?内容[：:]\s*([^\n]+)/) || [])[1] || "";
        const address = (body.match(/所在地[：:]\s*([^\n]+)/) || [])[1] || "";
        const status = /取消/.test(action) ? "revoked" : /停止/.test(action) ? "suspended" : "active";
        const slug = toSlug("chiba-sanpai", company, dateStr || "");

        const item = {
          slug,
          company_name: company,
          corporate_number: null,
          prefecture: "千葉県",
          city: extractCity(address),
          license_type: normalizeLicenseType(action),
          waste_category: "industrial",
          business_area: "千葉県",
          status,
          risk_level: /取消/.test(action) ? "critical" : "high",
          penalty_count: 1,
          latest_penalty_date: dateStr,
          source_name: "千葉県 廃棄物処理法関係の行政処分",
          source_url: INDEX_URL,
          detail_url: url,
          notes: action ? action.slice(0, 200) : null,
        };

        if (dryRun) { inserted++; continue; }
        try {
          const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
          upsertStmt.run(item);
          before ? updated++ : inserted++;
        } catch (err) {
          log(`  ! ${company}: ${err.message}`);
          skipped++;
        }
      }

      await sleep(400);
    } catch (e) {
      log(`  ! ${url}: ${e.message}`);
    }
  }

  log(`  chiba: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース6: 埼玉県 一覧→個別press ────────────────────────────

async function ingestSaitama({ db, upsertStmt, dryRun, log }) {
  const INDEX_URL = "https://www.pref.saitama.lg.jp/a0506/sanpai-syobun2/syobun.html";
  log("埼玉県 産業廃棄物処理業者等行政処分");

  const indexRes = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!indexRes.ok) throw new Error(`Saitama HTTP ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  // 個別press: /sanpai-syobun2/{YYYYMMDDnn}.html or {YYYYMMDD}.html
  const pressUrls = new Set();
  [...indexHtml.matchAll(/href="([^"]*sanpai-syobun2\/\d{8,10}\.html)"/gi)]
    .forEach((m) => pressUrls.add(resolveUrl(m[1], INDEX_URL)));

  log(`  press URLs: ${pressUrls.size}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const url of pressUrls) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) { skipped++; continue; }
      const h = await r.text();

      // press の URL から日付を抽出
      const dm = url.match(/(\d{4})(\d{2})(\d{2})\d{0,2}\.html/);
      const dateStr = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : null;

      // タイトル例: 「産業廃棄物処理業者の許可の取消しについて（株式会社ユウキ） - 埼玉県」
      const titleM = h.match(/<title>([^<]+)<\/title>/);
      const title = titleM ? titleM[1] : "";
      const body = stripTags(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""));

      // 事業者名抽出: タイトル末尾の括弧内から / 本文から
      const titleParen = title.match(/[（(]([^）)]+)[）)]/);
      const fromTitle = titleParen ? titleParen[1].trim() : null;
      const fromBody = body.match(/(?:事業者名|商号(?:又は名称)?)[：:]\s*([^\s（(\n]+)/);
      const company = (fromTitle || (fromBody ? fromBody[1] : "")).trim();
      if (!company || company.length < 2 || company.length > 60) { skipped++; continue; }

      // タイトルから処分種別を判定
      const titleAction = title.match(/(取消し|許可取消|事業停止|改善命令)/);
      const bodyAction = (body.match(/処分(?:の)?内容[：:]\s*([^\n]{1,80})/) || [])[1] || "";
      const action = bodyAction || (titleAction ? titleAction[1] : "");
      const address = (body.match(/所在地[：:]\s*([^\n]{1,80})/) || [])[1] || "";
      const status = /取消/.test(action) ? "revoked" : /停止/.test(action) ? "suspended" : "active";
      const slug = toSlug("saitama-sanpai", company, dateStr || "");

      const item = {
        slug,
        company_name: company,
        corporate_number: null,
        prefecture: "埼玉県",
        city: extractCity(address),
        license_type: normalizeLicenseType(action),
        waste_category: "industrial",
        business_area: "埼玉県",
        status,
        risk_level: /取消/.test(action) ? "critical" : "high",
        penalty_count: 1,
        latest_penalty_date: dateStr,
        source_name: "埼玉県 産業廃棄物処理業者等行政処分",
        source_url: INDEX_URL,
        detail_url: url,
        notes: (action || title).slice(0, 200),
      };

      if (dryRun) { inserted++; continue; }
      try {
        const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
        upsertStmt.run(item);
        before ? updated++ : inserted++;
      } catch (err) {
        log(`  ! ${company}: ${err.message}`);
        skipped++;
      }

      await sleep(400);
    } catch (e) {
      log(`  ! ${url}: ${e.message}`);
    }
  }

  log(`  saitama: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース7: 福岡県 一覧→個別press ────────────────────────────

async function ingestFukuoka({ db, upsertStmt, dryRun, log }) {
  // 福岡県は集約ページが存在しないため、press-release/{YYMMDD}-kanshi.html を
  // 直近12ヶ月分プローブして発見する戦略
  const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
  const PRESS_BASE = "https://www.pref.fukuoka.lg.jp/press-release/";
  log("福岡県 産業廃棄物処理業者等行政処分（press URL プローブ）");

  // 直近12ヶ月の YYMMDD を生成
  const today = new Date();
  const yymmdds = [];
  for (let d = 0; d < 365; d++) {
    const dt = new Date(today.getTime() - d * 86400000);
    const yy = String(dt.getFullYear()).slice(2);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    yymmdds.push(`${yy}${mm}${dd}`);
  }

  const pressUrls = new Set();

  // 並列で HEAD probe (10件ずつ)
  for (let i = 0; i < yymmdds.length; i += 10) {
    const batch = yymmdds.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (d) => {
      const url = `${PRESS_BASE}${d}-kanshi.html`;
      try {
        const r = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": BROWSER_UA },
          signal: AbortSignal.timeout(5000),
        });
        return r.ok ? url : null;
      } catch {
        return null;
      }
    }));
    results.filter(Boolean).forEach((u) => pressUrls.add(u));
    await sleep(100); // 軽く間を空ける
  }

  log(`  press URLs found: ${pressUrls.size}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const url of pressUrls) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!r.ok) { skipped++; continue; }
      const h = await r.text();

      // URL から年月日推定 (YYMMDD)
      const dm = url.match(/\/(\d{6})-kansh?i\.html/);
      let dateStr = null;
      if (dm) {
        const d = dm[1];
        const yy = parseInt(d.slice(0, 2)) + 2000;
        dateStr = `${yy}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
      }

      const titleM = h.match(/<title>([^<]+)<\/title>/);
      const title = titleM ? titleM[1] : "";
      const body = stripTags(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""));

      // 事業者名: タイトル or 本文「事業者名」「商号」から
      const fromBody = body.match(/(?:事業者名|商号(?:又は名称)?)[：:]\s*([^\s（(]+(?:株式会社|有限会社|合同会社)?[^\s（(]*)/);
      const fromTitle = title.match(/(株式会社[^\s]+|有限会社[^\s]+|合同会社[^\s]+|[一-龯ァ-ヶー]+株式会社)/);
      const company = (fromBody ? fromBody[1] : (fromTitle ? fromTitle[1] : "")).trim();
      if (!company || company.length < 2 || company.length > 60) { skipped++; continue; }

      const action = (body.match(/処分(?:の)?内容[：:]\s*([^\n]{1,100})/) || [])[1] || "";
      const address = (body.match(/(?:所在地|住所)[：:]\s*([^\n]{1,100})/) || [])[1] || "";
      const status = /取消/.test(action) ? "revoked" : /停止/.test(action) ? "suspended" : "active";
      const slug = toSlug("fukuoka-sanpai", company, dateStr || "");

      const item = {
        slug,
        company_name: company,
        corporate_number: null,
        prefecture: "福岡県",
        city: extractCity(address),
        license_type: normalizeLicenseType(action),
        waste_category: "industrial",
        business_area: "福岡県",
        status,
        risk_level: /取消/.test(action) ? "critical" : "high",
        penalty_count: 1,
        latest_penalty_date: dateStr,
        source_name: "福岡県 産業廃棄物処理業者等行政処分",
        source_url: PRESS_BASE,
        detail_url: url,
        notes: action ? action.slice(0, 200) : null,
      };

      if (dryRun) { inserted++; continue; }
      try {
        const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
        upsertStmt.run(item);
        before ? updated++ : inserted++;
      } catch (err) {
        log(`  ! ${company}: ${err.message}`);
        skipped++;
      }

      await sleep(500);
    } catch (e) {
      log(`  ! ${url}: ${e.message}`);
    }
  }

  log(`  fukuoka: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ソース8: 愛知県 press URL プローブ ────────────────────────────

async function ingestAichi({ db, upsertStmt, dryRun, log }) {
  log("愛知県 産業廃棄物処理業者行政処分（press URL プローブ）");

  const PRESS_BASE = "https://www.pref.aichi.jp/press-release/";
  const OLD_BASE = "https://www.pref.aichi.jp/soshiki/junkan-kansi/";

  // YYYY × kansiNN 形式: 直近5年 × 各年30件まで probe
  const currentYear = new Date().getFullYear();
  const candidates = [];
  for (let y = currentYear - 4; y <= currentYear; y++) {
    for (let n = 1; n <= 30; n++) {
      const nn = String(n).padStart(2, "0");
      candidates.push(`${PRESS_BASE}${y}kansi${nn}.html`);
      if (y <= 2022) candidates.push(`${OLD_BASE}${y}kansi${nn}.html`); // 旧URL
    }
  }

  const pressUrls = new Set();
  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (url) => {
      try {
        const r = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(5000),
        });
        return r.ok ? url : null;
      } catch { return null; }
    }));
    results.filter(Boolean).forEach((u) => pressUrls.add(u));
    await sleep(100);
  }
  log(`  press URLs found: ${pressUrls.size}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const url of pressUrls) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) { skipped++; continue; }
      const h = await r.text();

      const titleM = h.match(/<title>([^<]+)<\/title>/);
      const title = titleM ? titleM[1] : "";
      const body = stripTags(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""));

      // 事業者名
      const titleParen = title.match(/[（(]([^）)]+)[）)]/);
      const fromTitle = titleParen ? titleParen[1].trim() : null;
      const fromBody = body.match(/(?:事業者名|商号(?:又は名称)?)[：:]\s*([^\s（(\n]+)/);
      const company = (fromTitle || (fromBody ? fromBody[1] : "")).trim();
      if (!company || company.length < 2 || company.length > 60) { skipped++; continue; }

      // 処分日
      const dateBody = body.match(/(?:処分(?:した)?(?:年月)?日|公表日)[：:]\s*([^\n]{1,40})/);
      const dateStr = parseJapaneseDate(dateBody ? dateBody[1] : "");

      const titleAction = title.match(/(取消し|許可取消|事業停止|改善命令)/);
      const bodyAction = (body.match(/処分(?:の)?内容[：:]\s*([^\n]{1,80})/) || [])[1] || "";
      const action = bodyAction || (titleAction ? titleAction[1] : "");
      const address = (body.match(/(?:所在地|住所)[：:]\s*([^\n]{1,80})/) || [])[1] || "";
      const status = /取消/.test(action) ? "revoked" : /停止/.test(action) ? "suspended" : "active";
      const slug = toSlug("aichi-sanpai", company, dateStr || "");

      const item = {
        slug,
        company_name: company,
        corporate_number: null,
        prefecture: "愛知県",
        city: extractCity(address),
        license_type: normalizeLicenseType(action),
        waste_category: "industrial",
        business_area: "愛知県",
        status,
        risk_level: /取消/.test(action) ? "critical" : "high",
        penalty_count: 1,
        latest_penalty_date: dateStr,
        source_name: "愛知県 産業廃棄物処理業者行政処分",
        source_url: PRESS_BASE,
        detail_url: url,
        notes: (action || title).slice(0, 200),
      };

      if (dryRun) { inserted++; continue; }
      try {
        const before = db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(slug);
        upsertStmt.run(item);
        before ? updated++ : inserted++;
      } catch (err) {
        log(`  ! ${company}: ${err.message}`);
        skipped++;
      }

      await sleep(400);
    } catch (e) {
      log(`  ! ${url}: ${e.message}`);
    }
  }

  log(`  aichi: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── ユーティリティ ────────────────────────────

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(href, base) {
  try {
    if (href.startsWith("http")) return href;
    if (href.startsWith("/")) {
      const u = new URL(base);
      return `${u.protocol}//${u.host}${href}`;
    }
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** "令和7年（2025年）10月17日" / "令和7年10月17日" / "2025年10月17日" を YYYY-MM-DD に */
function parseJapaneseDate(str) {
  if (!str) return null;
  const s = String(str);
  // 西暦
  let m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*日/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = s.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 1988 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

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
