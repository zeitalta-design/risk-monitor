/**
 * Pipeline: hojokin ドメイン
 *
 * 役割: Collector が取得した生レコードを Formatter で統一スキーマに変換し、
 *       DB（hojokin_items）へ書き込む。
 *
 * 入札ラインと同形に揃えてあり、他ドメインへのコピー可読性を優先。
 *
 * 現状:
 *   - J-Grants の end-to-end パイプライン `processJgrantsRecords` を実装
 *   - API loop を伴う全取得は `runJgrantsPipeline` にまとめる
 *     （旧 `fetchAndUpsertHojokin` の orchestration を踏襲）
 */
import { getDb } from "@/lib/db";
import jgrantsFormat, {
  inferCategory,
  inferTargetType,
  inferStatus,
} from "@/lib/agents/formatter/hojokin/jgrants";

const JGRANTS_BASE = "https://api.jgrants-portal.go.jp/exp/v1/public/subsidies";

/** 旧 hojokin-fetcher.js の KEYWORDS と同一（責務移設） */
const JGRANTS_KEYWORDS = [
  { keyword: "事業", label: "汎用" },
  { keyword: "補助", label: "汎用" },
  { keyword: "ものづくり", label: "カテゴリ" },
  { keyword: "設備投資", label: "カテゴリ" },
  { keyword: "省エネ", label: "カテゴリ" },
  { keyword: "研究開発", label: "カテゴリ" },
  { keyword: "販路開拓", label: "カテゴリ" },
  { keyword: "人材育成", label: "カテゴリ" },
  { keyword: "創業", label: "カテゴリ" },
  { keyword: "IT導入", label: "カテゴリ" },
  { keyword: "中小企業", label: "対象" },
  { keyword: "小規模事業者", label: "対象" },
  { keyword: "グリーン", label: "施策" },
  { keyword: "事業再構築", label: "施策" },
  { keyword: "生産性向上", label: "施策" },
];

export function getJgrantsKeywords() {
  return JGRANTS_KEYWORDS;
}

/**
 * J-Grants 生レコード配列を受け取り、format → DB upsert までを実行。
 *
 * @param {Array} rawRecords   J-Grants API の result[] をそのまま渡してよい
 * @param {Object} [opts]
 * @param {boolean}[opts.dryRun]
 * @param {Function}[opts.logger]
 * @param {Set<string>}[opts.seen]  既に処理済みの slug（同一ラン内の重複排除用）
 * @returns {{ formatted: number, inserted: number, updated: number, skipped: number }}
 */
export function processJgrantsRecords(rawRecords, { dryRun = false, logger = console.log, seen } = {}) {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError("processJgrantsRecords: rawRecords must be an array");
  }
  const log = (msg) => logger(`[pipeline.hojokin.jgrants] ${msg}`);
  const db = getDb();

  const selectBySlug = db.prepare("SELECT id FROM hojokin_items WHERE slug = ?");
  const upsertStmt = db.prepare(`
    INSERT INTO hojokin_items
      (slug, title, category, target_type, max_amount, subsidy_rate,
       deadline, status, provider_name, summary, source_name, source_url, detail_url,
       is_published, review_status, created_at, updated_at)
    VALUES
      (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
       @deadline, @status, @provider_name, @summary, @source_name, @source_url, @detail_url,
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      deadline = excluded.deadline,
      status = excluded.status,
      max_amount = excluded.max_amount,
      subsidy_rate = excluded.subsidy_rate,
      summary = excluded.summary,
      provider_name = excluded.provider_name,
      updated_at = datetime('now')
  `);

  const dedup = seen instanceof Set ? seen : new Set();
  let formatted = 0, inserted = 0, updated = 0, skipped = 0;

  for (const raw of rawRecords) {
    if (!raw || !raw.id) { skipped++; continue; }
    const slug = `jgrants-${raw.id}`;
    if (dedup.has(slug)) { skipped++; continue; }
    dedup.add(slug);

    let unified;
    try {
      unified = jgrantsFormat(raw);
      formatted++;
    } catch (e) {
      log(`format error for ${slug}: ${e.message}`);
      skipped++; continue;
    }

    const row = unifiedJgrantsToItemRow(unified, slug);
    if (dryRun) { inserted++; continue; }

    try {
      const existing = selectBySlug.get(slug);
      upsertStmt.run(row);
      existing ? updated++ : inserted++;
    } catch (e) {
      log(`db error for ${slug}: ${e.message}`);
      skipped++;
    }
  }

  return { formatted, inserted, updated, skipped };
}

/**
 * J-Grants API を全キーワードで順次呼び出し、取得分を pipeline に流す。
 * 旧 `fetchAndUpsertHojokin` の外側ループを責務分離したもの。
 *
 * @param {Object} [opts]
 * @param {number} [opts.maxKeywords=15]
 * @param {number} [opts.fetchTimeoutMs=8000]
 * @param {number} [opts.delayMs=500]
 * @param {boolean}[opts.dryRun=false]
 * @param {Function}[opts.logger]
 * @returns {Promise<{ ok: true, totalFetched: number, unique: number,
 *   created: number, updated: number, skipped: number,
 *   elapsed: string, errors?: string[], dryRun: boolean }>}
 */
export async function runJgrantsPipeline({
  maxKeywords = 15,
  fetchTimeoutMs = 8000,
  delayMs = 500,
  dryRun = false,
  logger = console.log,
} = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[pipeline.hojokin.jgrants] ${msg}`);

  let totalFetched = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seen = new Set();
  const errors = [];

  const targets = JGRANTS_KEYWORDS.slice(0, maxKeywords);
  log(`keywords=${targets.length} timeout=${fetchTimeoutMs}ms delay=${delayMs}ms dryRun=${dryRun}`);

  for (const kw of targets) {
    try {
      const params = new URLSearchParams({
        keyword: kw.keyword,
        sort: "created_date",
        order: "DESC",
        acceptance: "0",
      });
      const res = await fetch(`${JGRANTS_BASE}?${params}`, {
        headers: { "User-Agent": "RiskMonitor/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });

      if (!res.ok) {
        errors.push(`${kw.keyword}: HTTP ${res.status}`);
        continue;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        errors.push(`${kw.keyword}: JSON parse error`);
        continue;
      }

      const items = Array.isArray(data.result) ? data.result : [];
      totalFetched += items.length;

      const s = processJgrantsRecords(items, { dryRun, logger, seen });
      created += s.inserted;
      updated += s.updated;
      skipped += s.skipped;

      await sleep(delayMs);
    } catch (e) {
      errors.push(`${kw.keyword}: ${e.message}`);
    }
  }

  if (!dryRun) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('hojokin', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalFetched, created, updated);
    } catch { /* sync_runs が無い環境では無視 */ }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`done totalFetched=${totalFetched} unique=${seen.size} created=${created} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  return {
    ok: true,
    totalFetched,
    unique: seen.size,
    created,
    updated,
    skipped,
    elapsed,
    errors: errors.length > 0 ? errors : undefined,
    dryRun,
  };
}

// ─── Unified → hojokin_items 行へ写像 ─────────────────────

function unifiedJgrantsToItemRow(unified, slug) {
  const raw = unified.raw || {};
  return {
    slug,
    title: (unified.title || "").slice(0, 200),
    category: inferCategory(raw),
    target_type: inferTargetType(raw),
    max_amount: raw.subsidy_max_limit ?? null,
    subsidy_rate: raw.subsidy_rate || null,
    deadline: unified.deadline,
    status: inferStatus(raw),
    provider_name: (unified.organization || "").slice(0, 100),
    summary: (raw.outline || raw.use_purpose || "").slice(0, 500),
    source_name: "J-Grants",
    source_url: "https://www.jgrants-portal.go.jp/",
    detail_url: unified.detail_url,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
