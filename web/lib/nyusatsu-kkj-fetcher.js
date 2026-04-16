/**
 * 官公需情報ポータル（KKJ / 中小企業庁）入札公告 fetcher
 *
 * https://www.kkj.go.jp/
 * API 仕様: https://www.kkj.go.jp/doc/ja/api_guide.pdf  (V1.1)
 *
 * 既存 6省庁 fetcher (nyusatsu-fetcher.js) に加え、
 * 自治体含む全国 約30万件の入札公告を日次で取得する Phase C。
 *
 * 戦略:
 *   - API は SearchHits 1,000 件上限（ページング無効）
 *   - LG_Code (JIS X0401, 01〜47) + CFT_Issue_Date で細切れに取得
 *   - 47都道府県 × 日付 で確実に 1,000件未満に抑える
 *
 * 使い方:
 *   日次 cron → 昨日〜今日の2日分を各都道府県で取得
 *   初回 or 補完 → 月〜年単位で range 指定して取得
 */
import { getDb } from "@/lib/db";

const API_BASE = "https://www.kkj.go.jp/api/";
const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0; +https://github.com/)";
const FETCH_TIMEOUT_MS = 30000;
const SLEEP_MS = 1000; // API への配慮（公式レート制限は非公開）

// JIS X0401 都道府県コード（01〜47）
const LG_CODES = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0"));

// KKJ の Category 値 → DB カテゴリへの正規化
const CATEGORY_MAP = {
  "工事": "construction",
  "物品": "goods",
  "役務": "service",
  "サービス": "service",
};

/**
 * 官公需情報ポータルから入札公告を取得して nyusatsu_items に upsert
 *
 * @param {object} opts
 * @param {"daily"|"range"} [opts.mode="daily"]
 * @param {string} [opts.fromDate] YYYY-MM-DD（range モード）
 * @param {string} [opts.toDate]   YYYY-MM-DD（range モード）
 * @param {string[]} [opts.lgCodes] 絞り込み（既定: 全47）
 * @param {boolean} [opts.dryRun]
 * @param {function} [opts.logger]
 */
export async function fetchKkjAnnouncements({
  mode = "daily",
  fromDate,
  toDate,
  lgCodes,
  dryRun = false,
  logger = console.log,
} = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[kkj-fetcher] ${msg}`);

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
  const days = enumerateDates(rangeFrom, rangeTo); // [YYYY-MM-DD, ...]
  const targetLgs = (lgCodes && lgCodes.length) ? lgCodes : LG_CODES;
  log(`mode=${mode} dateRange=${dateRange} days=${days.length} lg=${targetLgs.length}`);
  log(`total API calls planned: ${days.length * targetLgs.length}`);

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

  let totalFetched = 0, inserted = 0, updated = 0, skipped = 0;
  const today = fmtDateJst(Date.now());
  const perDay = [];

  // 日付 × LG_Code の 2重ループ。各 (day, lg) で SearchHits が 1,000 未満になる想定。
  for (const day of days) {
    let dayFetched = 0;
    for (const lg of targetLgs) {
      try {
        const items = await fetchOneSlice({ lg, dateRange: day, logger: log });
        dayFetched += items.length;
        totalFetched += items.length;
        if (items.length >= 1000) {
          log(`⚠ ${day} LG=${lg} が1000件以上: Category で追加分割が必要`);
        }

        if (!dryRun) {
          for (const row of items) {
            if (!row.projectName || row.projectName.length < 3) { skipped++; continue; }
            const item = buildDbRow(row, today);
            try {
              const existing = selectBySlug.get(item.slug);
              if (existing) {
                updateStmt.run(item);
                updated++;
              } else {
                insertStmt.run(item);
                inserted++;
              }
            } catch (e) {
              log(`  ! ${row.projectName.slice(0, 40)}: ${e.message}`);
              skipped++;
            }
          }
        }
      } catch (e) {
        log(`${day} LG=${lg} 失敗: ${e.message}`);
      }
      await sleep(SLEEP_MS);
    }
    perDay.push({ day, fetched: dayFetched });
    log(`  ${day}: ${dayFetched}件 (累計 fetched=${totalFetched} inserted=${inserted} updated=${updated})`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: fetched=${totalFetched} inserted=${inserted} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('nyusatsu_kkj', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalFetched, inserted, updated);
    } catch { /* sync_runs が無いDBなら無視 */ }
  }

  return {
    ok: true,
    mode,
    dateRange,
    totalFetched,
    inserted,
    updated,
    skipped,
    perDay,
    elapsed,
  };
}

/** "YYYY-MM-DD" から "YYYY-MM-DD" までの日付配列（両端含む） */
function enumerateDates(fromStr, toStr) {
  const from = new Date(fromStr + "T00:00:00Z").getTime();
  const to   = new Date(toStr   + "T00:00:00Z").getTime();
  const out = [];
  for (let t = from; t <= to; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** 1 つの (LG_Code, 日付) 組合せで API コール → 構造化配列を返す */
async function fetchOneSlice({ lg, dateRange, logger }) {
  const url = `${API_BASE}?LG_Code=${lg}&CFT_Issue_Date=${encodeURIComponent(dateRange)}&Count=1000`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/xml, text/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  // エラーレスポンス
  const errMatch = xml.match(/<Error>([^<]+)<\/Error>/);
  if (errMatch) {
    if (errMatch[1] === "no searchword") return []; // 空結果扱い
    throw new Error(`API error: ${errMatch[1]}`);
  }

  const hitsMatch = xml.match(/<SearchHits>(\d+)<\/SearchHits>/);
  const hits = hitsMatch ? parseInt(hitsMatch[1], 10) : 0;
  if (hits === 0) return [];

  return parseKkjXml(xml);
}

/**
 * KKJ API の XML レスポンスをパースして構造化配列を返す
 * 外部ライブラリに依存しない正規表現ベース（フィールドはすべて明確）
 */
export function parseKkjXml(xml) {
  const results = [];
  const regex = /<SearchResult>([\s\S]*?)<\/SearchResult>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const block = m[1];
    results.push({
      key:            extractTag(block, "Key"),
      externalUri:    extractTag(block, "ExternalDocumentURI"),
      projectName:    extractTag(block, "ProjectName"),
      crawlDate:      extractTag(block, "Date"),
      fileType:       extractTag(block, "FileType"),
      fileSize:       extractTag(block, "FileSize"),
      lgCode:         extractTag(block, "LgCode"),
      prefectureName: extractTag(block, "PrefectureName"),
      cityCode:       extractTag(block, "CityCode"),
      cityName:       extractTag(block, "CityName"),
      organizationName: extractTag(block, "OrganizationName"),
      certification:  extractTag(block, "Certification"),
      cftIssueDate:   extractTag(block, "CftIssueDate"),
      periodEndTime:  extractTag(block, "PeriodEndTime"),
      category:       extractTag(block, "Category"),
      procedureType:  extractTag(block, "ProcedureType"),
      location:       extractTag(block, "Location"),
      submissionDeadline: extractTag(block, "TenderSubmissionDeadline"),
      openingEvent:   extractTag(block, "OpeningTendersEvent"),
      itemCode:       extractTag(block, "ItemCode"),
      description:    extractTag(block, "ProjectDescription"),
      attachments:    extractAttachments(block),
    });
  }
  return results;
}

/** API レスポンス行 → nyusatsu_items スキーマに合わせた object */
function buildDbRow(row, today) {
  const announceDate = isoToDate(row.cftIssueDate);
  const deadline = isoToDate(row.submissionDeadline) || isoToDate(row.periodEndTime);
  const contractPeriod = isoToDate(row.periodEndTime);
  const status = deadline && deadline < today ? "closed" : "open";
  const lifecycleStatus = status === "closed" ? "closed" : "active";

  const title = cleanTitle(row.projectName);
  const summary = row.description
    ? row.description.replace(/\s+/g, " ").trim().slice(0, 300)
    : null;

  const targetArea = [row.prefectureName, row.cityName]
    .filter(Boolean)
    .join(" ") || null;

  return {
    slug: `kkj-${row.key || hashFallback(row.externalUri + row.projectName)}`,
    title,
    category: mapCategory(row.category, title),
    issuer_name: row.organizationName || null,
    target_area: targetArea,
    deadline,
    budget_amount: null, // API仕様になし
    bidding_method: row.procedureType || null,
    summary,
    status,
    qualification: null,
    announcement_url: row.externalUri || null,
    contact_info: null,
    delivery_location: row.location || null,
    has_attachment: (row.attachments && row.attachments.length) ? 1 : 0,
    announcement_date: announceDate,
    contract_period: contractPeriod,
    lifecycle_status: lifecycleStatus,
    source_name: "官公需情報ポータル（中小企業庁）",
    source_url: "https://www.kkj.go.jp/",
  };
}

// ─── XML 抽出ヘルパー ─────────────────────

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/${tag}>`);
  const m = block.match(re);
  if (!m) return null;
  const val = (m[1] !== undefined ? m[1] : m[2]) || "";
  return val.trim() || null;
}

function extractAttachments(block) {
  const outer = block.match(/<Attachments>([\s\S]*?)<\/Attachments>/);
  if (!outer) return [];
  const result = [];
  const re = /<Attachment>([\s\S]*?)<\/Attachment>/g;
  let m;
  while ((m = re.exec(outer[1])) !== null) {
    result.push({
      name: extractTag(m[1], "Name"),
      uri:  extractTag(m[1], "Uri"),
    });
  }
  return result;
}

// ─── 変換ヘルパー ─────────────────────

function fmtDateJst(epochMs) {
  // JST = UTC+9: epoch に 9時間足してから UTC 表記で日付を取る
  return new Date(epochMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function isoToDate(iso) {
  if (!iso) return null;
  // "2026-04-20T00:00:00+09:00" → "2026-04-20"
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function cleanTitle(title) {
  if (!title) return null;
  // 末尾の (146.6KB) のようなファイルサイズ表記を除去
  return title.replace(/\s*[\(（]\d+(\.\d+)?\s*[KMGkmg][Bb]\s*[\)）]\s*$/, "").trim();
}

function mapCategory(rawCategory, title) {
  if (rawCategory && CATEGORY_MAP[rawCategory]) return CATEGORY_MAP[rawCategory];
  if (!title) return "other";
  if (/工事|建設|土木|舗装/.test(title)) return "construction";
  if (/業務委託|コンサル|調査|設計|測量/.test(title)) return "consulting";
  if (/システム|ＩＴ|IT|ソフト|アプリ|データ/.test(title)) return "it";
  if (/物品|什器|備品|機器|車両|購入|調達/.test(title)) return "goods";
  if (/清掃|警備|管理|運営|保守|メンテ/.test(title)) return "service";
  return "other";
}

function hashFallback(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
