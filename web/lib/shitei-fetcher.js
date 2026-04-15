/**
 * 指定管理者（shitei）取得ロジック — パイロット実装
 *
 * 指定管理者制度は一元化されたAPIが存在せず、各自治体が個別の
 * HTMLページで公表している。本ファイルは全国展開の前段として、
 * 東京都の2部局からの取得をパイロット実装したもの。
 *
 * ソース（パイロット）:
 *   - tokyo_seikatsu: 東京都 生活文化スポーツ局 指定管理者候補者選定結果
 *     （単一ページ / h2+h3 構造）
 *   - tokyo_park:     東京都 建設局 都立公園等の指定管理者
 *     （トップ→サブページ追従 / h2+h3 構造）
 *
 * 将来拡張:
 *   - 東京都 産業労働局 / スポーツTOKYO インフォメーション
 *   - 神奈川県・大阪府・横浜市・大阪市 等
 */
import { getDb } from "@/lib/db";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 20000;

export async function fetchAndUpsertShitei({ dryRun = false, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[shitei-fetcher] ${msg}`);
  const db = getDb();

  const upsertStmt = db.prepare(`
    INSERT INTO shitei_items
      (slug, title, municipality_name, prefecture, facility_category, facility_name,
       recruitment_status, contract_start_date, contract_end_date, summary,
       detail_url, source_name, source_url,
       is_published, created_at, updated_at)
    VALUES
      (@slug, @title, @municipality_name, @prefecture, @facility_category, @facility_name,
       @recruitment_status, @contract_start_date, @contract_end_date, @summary,
       @detail_url, @source_name, @source_url,
       1, datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title               = excluded.title,
      facility_name       = excluded.facility_name,
      recruitment_status  = excluded.recruitment_status,
      contract_start_date = excluded.contract_start_date,
      contract_end_date   = excluded.contract_end_date,
      summary             = excluded.summary,
      detail_url          = excluded.detail_url,
      updated_at          = datetime('now')
  `);

  const sources = [];

  for (const src of [
    { name: "tokyo_seikatsu", label: "東京都 生活文化スポーツ局", fn: ingestTokyoSeikatsu },
    { name: "tokyo_park",     label: "東京都 都立公園",         fn: ingestTokyoPark },
  ]) {
    try {
      const r = await src.fn({ db, upsertStmt, dryRun, log });
      sources.push({ name: src.name, label: src.label, ...r });
    } catch (e) {
      log(`${src.name} failed: ${e.message}`);
      sources.push({ name: src.name, label: src.label, error: e.message, inserted: 0, updated: 0, skipped: 0 });
    }
  }

  const totalInserted = sources.reduce((s, r) => s + (r.inserted || 0), 0);
  const totalUpdated  = sources.reduce((s, r) => s + (r.updated  || 0), 0);
  const totalSkipped  = sources.reduce((s, r) => s + (r.skipped  || 0), 0);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('shitei', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalInserted + totalUpdated, totalInserted, totalUpdated);
    } catch { /* ignore */ }
  }

  return { ok: true, sources, totalInserted, totalUpdated, totalSkipped, elapsed };
}

// ─── ソース1: 東京都 生活文化スポーツ局 ─────────────────────────

async function ingestTokyoSeikatsu({ db, upsertStmt, dryRun, log }) {
  const url = "https://www.seikatubunka.metro.tokyo.lg.jp/bunka/bunka_shisetsu/0000001437.html";
  log("東京都 生活文化スポーツ局 指定管理者候補者選定結果");

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const entries = extractFacilityEntries(html);
  return upsertEntries({
    entries,
    db,
    upsertStmt,
    dryRun,
    log,
    sourceName: "東京都生活文化スポーツ局",
    sourceUrl: url,
    detailUrl: url,
    prefecture: "東京都",
    municipality: "東京都生活文化スポーツ局",
    facilityCategory: "culture",
    slugPrefix: "tokyo-seikatsu-shitei",
  });
}

// ─── ソース2: 東京都 都立公園 ─────────────────────────

async function ingestTokyoPark({ db, upsertStmt, dryRun, log }) {
  const indexUrl = "https://www.kensetsu.metro.tokyo.lg.jp/park/tokyo_kouen/shitei_koubo";
  log("東京都 都立公園 指定管理者");

  const indexRes = await fetch(indexUrl, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!indexRes.ok) throw new Error(`index HTTP ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  // 「指定管理者の指定について」「指定管理者の選定について」を含むサブページリンク
  const linkPattern = /href="(\/park\/tokyo_kouen\/shitei_koubo\/[^"]+?)"[^>]*>[^<]*指定管理者の(?:指定|選定|公募)[^<]*<\/a>/gi;
  const links = new Set();
  let m;
  while ((m = linkPattern.exec(indexHtml)) !== null) {
    const href = m[1];
    const url = href.startsWith("http") ? href : `https://www.kensetsu.metro.tokyo.lg.jp${href}`;
    links.add(url);
  }
  // 最新5件
  const targets = [...links].slice(0, 5);
  log(`  対象サブページ: ${targets.length}件`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const subUrl of targets) {
    try {
      const sres = await fetch(subUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!sres.ok) continue;
      const shtml = await sres.text();

      const entries = extractFacilityEntries(shtml);
      const r = upsertEntries({
        entries,
        db,
        upsertStmt,
        dryRun,
        log,
        sourceName: "東京都建設局 都立公園",
        sourceUrl: indexUrl,
        detailUrl: subUrl,
        prefecture: "東京都",
        municipality: "東京都建設局",
        facilityCategory: "park",
        slugPrefix: "tokyo-park-shitei",
      });
      inserted += r.inserted;
      updated += r.updated;
      skipped += r.skipped;

      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      log(`  ! ${subUrl}: ${e.message}`);
    }
  }

  log(`  tokyo_park: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

// ─── 共通: h2+h3 型ページから施設エントリを抽出 ─────────────────────────

function extractFacilityEntries(html) {
  const entries = [];

  // ブロック検出戦略:
  //   - 実質的 h2 ブロック（ナビ「お問い合わせ」等を除く）が複数あれば h2 分割
  //   - それ以外は h1 本文を単一エントリとみなす
  const h2List = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => clean(m[1]))
    .filter((t) => t && !/お知らせ|お問い合わせ|関連|リンク|メニュー|について知りたい|ナビ|メニュー/.test(t));

  if (h2List.length >= 2) {
    // h2 ブロック分割
    const h2Blocks = html.split(/<h2[^>]*>/);
    for (const block of h2Blocks.slice(1)) {
      const end = block.indexOf("</h2>");
      if (end < 0) continue;
      const h2Title = clean(block.slice(0, end));
      if (/お知らせ|お問い合わせ|関連|リンク|メニュー|について知りたい/.test(h2Title)) continue;
      if (h2Title.length < 4) continue;

      let body = block.slice(end + 5);
      const nextH2 = body.search(/<h2[^>]*>/);
      if (nextH2 >= 0) body = body.slice(0, nextH2);

      const entry = buildEntryFromH3Block(body, h2Title);
      if (entry.facility_name || entry.operator_name) entries.push(entry);
    }
  } else {
    // 単一 h1 エントリとして処理
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Title = h1Match ? clean(h1Match[1]) : "指定管理者";
    const bodyStart = h1Match ? html.indexOf(h1Match[0]) + h1Match[0].length : 0;
    const nav = html.slice(bodyStart).search(/<h2[^>]*>(?:[\s\S]{0,50}?)(?:お問い合わせ|関連|リンク)/);
    const body = nav >= 0 ? html.slice(bodyStart, bodyStart + nav) : html.slice(bodyStart);

    const entry = buildEntryFromH3Block(body, h1Title);
    if (entry.facility_name || entry.operator_name) entries.push(entry);
  }

  return entries;
}

/** h3 でラベル/値を抽出して entry オブジェクトを組み立てる */
function buildEntryFromH3Block(body, titleForGroup) {
  const entry = { facility_group_title: titleForGroup };
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>\s*([\s\S]{0,4000}?)(?=<h[1-3]|$)/gi;
  let m;
  while ((m = h3Pattern.exec(body)) !== null) {
    const label = clean(m[1]);
    const value = clean(m[2]);
    if (!label || !value) continue;

    if (/対象施設|施設名/.test(label)) {
      entry.facility_name = value.slice(0, 500);
    } else if (/指定期間|期間/.test(label)) {
      const range = parseDateRange(value);
      if (range) {
        entry.contract_start_date = range.start;
        entry.contract_end_date = range.end;
      }
      entry.period_raw = value.slice(0, 120);
    } else if (
      /指定管理者.*?(名称|候補者)/.test(label) ||
      /候補者.*?(名称|及び)/.test(label) ||
      /^指定管理者$/.test(label)
    ) {
      entry.operator_name = value.slice(0, 300);
      // 値内に期間情報が含まれる場合はそこからも抽出
      if (!entry.contract_start_date) {
        const r = parseDateRange(value);
        if (r) {
          entry.contract_start_date = r.start;
          entry.contract_end_date = r.end;
        }
      }
    } else if (/選定の経緯|選定理由/.test(label)) {
      entry.selection_note = value.slice(0, 300);
    }
  }
  return entry;
}

// ─── 共通: エントリ配列を shitei_items に upsert ─────────────────────────

function upsertEntries({
  entries, db, upsertStmt, dryRun, log,
  sourceName, sourceUrl, detailUrl, prefecture, municipality, facilityCategory, slugPrefix,
}) {
  let inserted = 0, updated = 0, skipped = 0;
  for (const e of entries) {
    const title = e.facility_group_title || e.facility_name || "";
    if (!title || title.length < 3) { skipped++; continue; }

    const slug = toSlug(slugPrefix, title);
    const status = e.contract_end_date && new Date(e.contract_end_date) > new Date() ? "selected" : "ended";

    const summaryParts = [];
    if (e.operator_name) summaryParts.push(`指定管理者: ${e.operator_name}`);
    if (e.period_raw) summaryParts.push(`期間: ${e.period_raw}`);
    if (e.selection_note) summaryParts.push(e.selection_note);

    const item = {
      slug,
      title: title.slice(0, 200),
      municipality_name: municipality,
      prefecture,
      facility_category: facilityCategory,
      facility_name: e.facility_name || null,
      recruitment_status: status,
      contract_start_date: e.contract_start_date || null,
      contract_end_date: e.contract_end_date || null,
      summary: summaryParts.join(" / ").slice(0, 500) || null,
      detail_url: detailUrl,
      source_name: sourceName,
      source_url: sourceUrl,
    };

    if (dryRun) { inserted++; continue; }
    try {
      const before = db.prepare("SELECT id FROM shitei_items WHERE slug = ?").get(slug);
      upsertStmt.run(item);
      before ? updated++ : inserted++;
    } catch (err) {
      log && log(`    ! ${title}: ${err.message}`);
      skipped++;
    }
  }
  return { inserted, updated, skipped };
}

// ─── ユーティリティ ─────────────────────────

function clean(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function toSlug(prefix, title) {
  return (prefix + "-" + String(title)
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  ).substring(0, 80) || `${prefix}-item`;
}

function parseDateRange(text) {
  const s = String(text || "");
  const dates = [];
  const pattern = /令和(\d+)年(\d+)月(\d+)日/g;
  let m;
  while ((m = pattern.exec(s)) !== null) {
    const y = 2018 + parseInt(m[1]);
    dates.push(`${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  if (dates.length >= 2) return { start: dates[0], end: dates[1] };
  if (dates.length === 1) return { start: dates[0], end: null };
  return null;
}
