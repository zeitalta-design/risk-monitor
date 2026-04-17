/**
 * Pipeline: nyusatsu ドメイン
 *
 * 役割: Collector が取得した生レコードを Formatter で統一スキーマに変換し、
 *       DB（nyusatsu_items）へ書き込む。
 *
 * 現状（Step 2 時点）:
 *   - KKJ の end-to-end パイプライン `processKkjRecords` のみ実装
 *   - central-ministries / p-portal-results は Formatter までは実装済だが
 *     pipeline 配線は Step 2.5 で実装予定（既存 fetcher が fetch+format+save を
 *     内部完結しているため、切り出しにリファクタが必要）
 */
import { getDb } from "@/lib/db";
import { upsertNyusatsuResult } from "@/lib/repositories/nyusatsu";
import { METHOD_LABELS, guessCategoryFromTitle } from "@/lib/nyusatsu-result-fetcher";
import { toSlug, inferCategory } from "@/lib/nyusatsu-fetcher";
import {
  fetchKkjSlice, enumerateDates, fmtDateJst, sleep,
  LG_CODES, SLEEP_MS,
} from "@/lib/nyusatsu-kkj-fetcher";
import kkjFormat from "@/lib/agents/formatter/nyusatsu/kkj";
import ppFormat from "@/lib/agents/formatter/nyusatsu/p-portal-results";
import cmFormat from "@/lib/agents/formatter/nyusatsu/central-ministries";

/**
 * KKJ 生レコード配列を受け取り、format → DB upsert までを実行。
 *
 * FormattedRecord + raw から nyusatsu_items 列を組み立てる。KKJ 固有の
 * 生フィールド（prefectureName, cityName, procedureType 等）は raw から参照する
 * （Resolver 導入後はここで束ねていた責務が Resolver に移る）。
 *
 * @param {Array} rawRecords   parseKkjXml の出力配列
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {Function} [opts.logger]
 * @returns {{ formatted: number, inserted: number, updated: number, skipped: number }}
 */
export function processKkjRecords(rawRecords, { dryRun = false, logger = console.log } = {}) {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError("processKkjRecords: rawRecords must be an array");
  }
  const log = (msg) => logger(`[pipeline.nyusatsu.kkj] ${msg}`);
  const db = getDb();

  const selectBySlug = db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?");
  const insertStmt = db.prepare(`
    INSERT INTO nyusatsu_items
      (slug, title, category, issuer_name, target_area, deadline, budget_amount,
       bidding_method, summary, status, is_published, created_at, updated_at,
       qualification, announcement_url, contact_info, delivery_location,
       has_attachment, announcement_date, contract_period,
       lifecycle_status, source_name, source_url)
    VALUES
      (@slug, @title, @category, @issuer_name, @target_area, @deadline, @budget_amount,
       @bidding_method, @summary, @status, 1, datetime('now'), datetime('now'),
       @qualification, @announcement_url, @contact_info, @delivery_location,
       @has_attachment, @announcement_date, @contract_period,
       @lifecycle_status, @source_name, @source_url)
  `);
  const updateStmt = db.prepare(`
    UPDATE nyusatsu_items SET
      title = @title, category = @category, issuer_name = @issuer_name,
      target_area = @target_area, deadline = @deadline,
      bidding_method = @bidding_method, summary = @summary, status = @status,
      announcement_url = @announcement_url, announcement_date = @announcement_date,
      delivery_location = @delivery_location, has_attachment = @has_attachment,
      contract_period = @contract_period, lifecycle_status = @lifecycle_status,
      source_name = @source_name, source_url = @source_url,
      updated_at = datetime('now')
    WHERE slug = @slug
  `);

  const today = new Date().toISOString().slice(0, 10);
  let formatted = 0, inserted = 0, updated = 0, skipped = 0;

  for (const raw of rawRecords) {
    if (!raw || !raw.projectName || String(raw.projectName).length < 3) {
      skipped++; continue;
    }
    // Formatter（純粋関数）
    let unified;
    try {
      unified = kkjFormat(raw);
      formatted++;
    } catch (e) {
      log(`format error: ${e.message}`);
      skipped++; continue;
    }

    // Unified → nyusatsu_items 行へ写像
    const row = unifiedKkjToItemRow(unified, today);
    if (dryRun) { inserted++; continue; }

    try {
      const existing = selectBySlug.get(row.slug);
      if (existing) {
        updateStmt.run(row);
        updated++;
      } else {
        insertStmt.run(row);
        inserted++;
      }
    } catch (e) {
      log(`db error for ${row.slug}: ${e.message}`);
      skipped++;
    }
  }

  log(`done formatted=${formatted} inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { formatted, inserted, updated, skipped };
}

// ─── KKJ Unified → nyusatsu_items 行へ写像 ─────────────────────

function unifiedKkjToItemRow(unified, today) {
  const raw = unified.raw || {};

  const slug = buildKkjSlug(raw);
  const deadline = unified.deadline;
  const status = deadline && deadline < today ? "closed" : "open";
  const lifecycleStatus = status === "closed" ? "closed" : "active";

  const targetArea = [raw.prefectureName, raw.cityName].filter(Boolean).join(" ") || null;

  return {
    slug,
    title: unified.title || "",
    category: mapCategory(raw.category, unified.title),
    issuer_name: unified.organization,
    target_area: targetArea,
    deadline,
    budget_amount: null,
    bidding_method: raw.procedureType || null,
    summary: raw.description
      ? String(raw.description).replace(/\s+/g, " ").trim().slice(0, 300)
      : null,
    status,
    qualification: null,
    announcement_url: unified.detail_url,
    contact_info: null,
    delivery_location: raw.location || null,
    has_attachment: Array.isArray(raw.attachments) && raw.attachments.length > 0 ? 1 : 0,
    announcement_date: unified.published_at,
    contract_period: (() => {
      // raw.periodEndTime が ISO なら日付部を返す
      const m = String(raw.periodEndTime || "").match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    })(),
    lifecycle_status: lifecycleStatus,
    source_name: "官公需情報ポータル（中小企業庁）",
    source_url: "https://www.kkj.go.jp/",
  };
}

function buildKkjSlug(raw) {
  const key = raw.key || hashFallback(String(raw.externalUri || "") + String(raw.projectName || ""));
  return `kkj-${key}`;
}

function mapCategory(rawCategory, title) {
  const map = { "工事": "construction", "物品": "goods", "役務": "service", "サービス": "service" };
  if (rawCategory && map[rawCategory]) return map[rawCategory];
  const t = String(title || "");
  if (/工事|建設|土木|舗装/.test(t)) return "construction";
  if (/業務委託|コンサル|調査|設計|測量/.test(t)) return "consulting";
  if (/システム|ＩＴ|IT|ソフト|アプリ|データ/.test(t)) return "it";
  if (/物品|什器|備品|機器|車両|購入|調達/.test(t)) return "goods";
  if (/清掃|警備|管理|運営|保守|メンテ/.test(t)) return "service";
  return "other";
}

function hashFallback(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ─── 調達ポータル 落札結果 pipeline ─────────────────────

/**
 * 調達ポータル CSV の生レコード配列を受け取り、
 * format → nyusatsu_results upsert までを実行。
 *
 * @param {Array}   rawRecords   parseCsv が返す生レコード配列
 * @param {Object} [opts]
 * @param {string} [opts.sourceUrl]  取得元の URL（source_url に保存）
 * @param {boolean}[opts.dryRun]
 * @param {Function}[opts.logger]
 * @returns {{ formatted: number, inserted: number, updated: number, skipped: number }}
 */
export function processPPortalResults(rawRecords, { sourceUrl = "", dryRun = false, logger = console.log } = {}) {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError("processPPortalResults: rawRecords must be an array");
  }
  const log = (msg) => logger(`[pipeline.nyusatsu.p-portal-results] ${msg}`);
  const db = getDb();

  let formatted = 0, inserted = 0, updated = 0, skipped = 0;

  for (const raw of rawRecords) {
    if (!raw || !raw.title || String(raw.title).length < 3) { skipped++; continue; }

    let unified;
    try {
      unified = ppFormat(raw);
      formatted++;
    } catch (e) {
      log(`format error: ${e.message}`);
      skipped++; continue;
    }

    const row = unifiedPPortalToResultRow(unified, sourceUrl);
    if (dryRun) { inserted++; continue; }

    try {
      const r = upsertNyusatsuResult(row);
      r.action === "insert" ? inserted++ : updated++;
    } catch (err) {
      if (!String(err.message).includes("UNIQUE")) {
        log(`  ! ${raw.title.slice(0, 40)}: ${err.message}`);
      }
      skipped++;
    }
  }

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('nyusatsu_results', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(rawRecords.length, inserted, updated);
    } catch { /* sync_runs が無い環境では無視 */ }
  }

  log(`done formatted=${formatted} inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { formatted, inserted, updated, skipped };
}

// ─── 中央省庁 6省庁 pipeline ─────────────────────

/**
 * 中央省庁 6省庁の生レコード群を受け取り、
 * format → nyusatsu_items upsert までを実行。
 *
 * @param {Array<{name: string, label: string, items: Array, error?: string}>} perSource
 *                                    collectCentralMinistriesRaw の perSource 配列
 * @param {Object} [opts]
 * @param {boolean}[opts.dryRun]
 * @param {Function}[opts.logger]
 * @returns {{ formatted: number, inserted: number, updated: number, skipped: number,
 *             perSource: Array<{name: string, label: string, fetched: number, error?: string}> }}
 */
export function processCentralMinistries(perSource, { dryRun = false, logger = console.log } = {}) {
  if (!Array.isArray(perSource)) {
    throw new TypeError("processCentralMinistries: perSource must be an array");
  }
  const log = (msg) => logger(`[pipeline.nyusatsu.central-ministries] ${msg}`);
  const db = getDb();

  const selectBySlug = db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?");
  const insertStmt = db.prepare(`
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
  `);
  const updateStmt = db.prepare(`
    UPDATE nyusatsu_items SET
      title = @title, category = @category, issuer_name = @issuer_name,
      target_area = @target_area, deadline = @deadline,
      bidding_method = @bidding_method, summary = @summary, status = @status,
      announcement_url = @announcement_url, announcement_date = @announcement_date,
      updated_at = datetime('now')
    WHERE slug = @slug
  `);

  const today = new Date().toISOString().slice(0, 10);
  let formatted = 0, inserted = 0, updated = 0, skipped = 0;
  const perSourceStats = [];
  let totalRaw = 0;

  for (const src of perSource) {
    const items = Array.isArray(src.items) ? src.items : [];
    totalRaw += items.length;
    if (src.error) {
      perSourceStats.push({ name: src.name, label: src.label, fetched: 0, error: src.error });
      continue;
    }
    perSourceStats.push({ name: src.name, label: src.label, fetched: items.length });

    for (const raw of items) {
      if (!raw || !raw.title || String(raw.title).length < 5) { skipped++; continue; }

      let unified;
      try {
        unified = cmFormat(raw);
        formatted++;
      } catch (e) {
        log(`format error (${src.name}): ${e.message}`);
        skipped++; continue;
      }

      const row = unifiedCentralMinistriesToItemRow(unified, today);
      if (dryRun) { inserted++; continue; }

      try {
        const existing = selectBySlug.get(row.slug);
        if (existing) { updateStmt.run(row); updated++; }
        else          { insertStmt.run(row); inserted++; }
      } catch (e) {
        log(`db error for ${row.slug}: ${e.message}`);
        skipped++;
      }
    }
  }

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('nyusatsu', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalRaw, inserted, updated);
    } catch { /* sync_runs 無い環境では無視 */ }
  }

  log(`done formatted=${formatted} inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { formatted, inserted, updated, skipped, perSource: perSourceStats };
}

function unifiedCentralMinistriesToItemRow(unified, today) {
  const raw = unified.raw || {};
  const deadline = unified.deadline;
  const status = deadline && deadline < today ? "closed" : "open";

  return {
    slug: toSlug(raw.source || "nyusatsu", unified.title || ""),
    title: (unified.title || "").slice(0, 200),
    category: inferCategory(unified.title || ""),
    issuer_name: unified.organization,
    target_area: "全国",
    deadline: deadline || null,
    budget_amount: null,
    bidding_method: "proposal",
    summary: null,
    status,
    qualification: null,
    announcement_url: unified.detail_url || "",
    contact_info: null,
    delivery_location: null,
    has_attachment: unified.detail_url ? 1 : 0,
    announcement_date: unified.published_at || null,
    contract_period: null,
  };
}

// ─── KKJ フルレンジ pipeline (orchestration) ─────────────────────

/**
 * KKJ を 日付 × LG_Code の 2重ループで走らせるパイプライン全体。
 * 各 (day, lg) スライスで fetchKkjSlice → processKkjRecords を呼び出す。
 *
 * @param {Object}  opts
 * @param {"daily"|"range"} [opts.mode="daily"]
 * @param {string}  [opts.fromDate] range 時の開始日
 * @param {string}  [opts.toDate]   range 時の終了日（省略時は from と同日）
 * @param {string[]}[opts.lgCodes]  絞り込み（既定: 全47）
 * @param {boolean} [opts.dryRun]
 * @param {Function}[opts.logger]
 */
export async function runKkjPipeline({
  mode = "daily",
  fromDate,
  toDate,
  lgCodes,
  dryRun = false,
  logger = console.log,
} = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[pipeline.nyusatsu.kkj] ${msg}`);

  // 日付レンジ決定（KKJ の CftIssueDate は JST なので JST で計算）
  let rangeFrom, rangeTo;
  if (mode === "daily") {
    rangeFrom = fmtDateJst(Date.now() - 86400000);
    rangeTo   = fmtDateJst(Date.now());
  } else {
    if (!fromDate) throw new Error("range モードは fromDate 必須");
    rangeFrom = fromDate;
    rangeTo   = toDate || fromDate;
  }
  const dateRange = `${rangeFrom}/${rangeTo}`;
  const days = enumerateDates(rangeFrom, rangeTo);
  const targetLgs = (lgCodes && lgCodes.length) ? lgCodes : LG_CODES;
  log(`mode=${mode} dateRange=${dateRange} days=${days.length} lg=${targetLgs.length}`);
  log(`total API calls planned: ${days.length * targetLgs.length}`);

  let totalFetched = 0, totalFormatted = 0, totalInserted = 0, totalUpdated = 0, totalSkipped = 0;
  const perDay = [];

  for (const day of days) {
    let dayFetched = 0;
    for (const lg of targetLgs) {
      let raw = [];
      try {
        raw = await fetchKkjSlice({ lg, dateRange: day, logger });
        dayFetched += raw.length;
        totalFetched += raw.length;
        if (raw.length >= 1000) {
          log(`⚠ ${day} LG=${lg} が1000件以上: Category で追加分割が必要`);
        }
      } catch (e) {
        log(`${day} LG=${lg} 失敗: ${e.message}`);
      }

      if (raw.length > 0) {
        // スライスごとに processKkjRecords を呼ぶ（progress 可視性優先）
        const s = processKkjRecords(raw, { dryRun, logger });
        totalFormatted += s.formatted;
        totalInserted  += s.inserted;
        totalUpdated   += s.updated;
        totalSkipped   += s.skipped;
      }
      await sleep(SLEEP_MS);
    }
    perDay.push({ day, fetched: dayFetched });
    log(`  ${day}: ${dayFetched}件 (累計 fetched=${totalFetched} inserted=${totalInserted} updated=${totalUpdated})`);
  }

  // sync_runs はパイプライン全体で 1 行
  if (!dryRun) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('nyusatsu_kkj', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalFetched, totalInserted, totalUpdated);
    } catch { /* sync_runs が無いDBなら無視 */ }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: fetched=${totalFetched} inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped} (${elapsed}s)`);

  return {
    ok: true,
    mode,
    dateRange,
    totalFetched,
    formatted: totalFormatted,
    inserted: totalInserted,
    updated: totalUpdated,
    skipped: totalSkipped,
    perDay,
    elapsed,
  };
}

function unifiedPPortalToResultRow(unified, sourceUrl) {
  const raw = unified.raw || {};
  return {
    slug: `pportal-${raw.procurementId}`,
    nyusatsu_item_id: null,
    title: unified.title,
    issuer_name: unified.organization, // issuerCode のまま。Resolver でコード→名称化予定
    winner_name: raw.winnerName || null,
    winner_corporate_number: raw.corporateNumber || null,
    award_amount: raw.awardAmount ?? null,
    award_date: unified.published_at, // = awardDate
    num_bidders: null,
    award_rate: null,
    budget_amount: null,
    category: guessCategoryFromTitle(unified.title),
    target_area: null,
    bidding_method: METHOD_LABELS[raw.methodCode] || raw.methodCode || null,
    result_url: unified.detail_url,
    source_name: "調達ポータル（落札実績オープンデータ）",
    source_url: sourceUrl || unified.detail_url,
    summary: null,
    is_published: 1,
  };
}
