/**
 * 官公需情報ポータル（KKJ / 中小企業庁）入札公告 fetcher
 *
 * https://www.kkj.go.jp/
 * API 仕様: https://www.kkj.go.jp/doc/ja/api_guide.pdf  (V1.1)
 *
 * 【Phase 1 Step 2.5 以降】
 * このモジュールは「取得 + パースのみ」に特化（DB 書込みは pipeline の責務）。
 * 旧 fetchKkjAnnouncements は削除。呼び出し側は
 *   pipeline の runKkjPipeline（lib/agents/pipeline/nyusatsu.js）を使う。
 * 単発スライス取得は fetchKkjSlice + parseKkjXml を直接使用可。
 *
 * 戦略:
 *   - API は SearchHits 1,000 件上限（ページング無効）
 *   - LG_Code (JIS X0401, 01〜47) + CFT_Issue_Date で細切れに取得
 *   - 47都道府県 × 日付 で確実に 1,000件未満に抑える
 */

export const API_BASE = "https://www.kkj.go.jp/api/";
const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0; +https://github.com/)";
const FETCH_TIMEOUT_MS = 30000;
export const SLEEP_MS = 1000; // API への配慮（公式レート制限は非公開）

/** JIS X0401 都道府県コード（01〜47） */
export const LG_CODES = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0"));

// （旧 fetchKkjAnnouncements は削除。pipeline からは
//  runKkjPipeline (lib/agents/pipeline/nyusatsu.js) を使う）

/** "YYYY-MM-DD" から "YYYY-MM-DD" までの日付配列（両端含む） */
export function enumerateDates(fromStr, toStr) {
  const from = new Date(fromStr + "T00:00:00Z").getTime();
  const to   = new Date(toStr   + "T00:00:00Z").getTime();
  const out = [];
  for (let t = from; t <= to; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * 1 つの (LG_Code, 日付) 組合せで KKJ API を叩き、生レコード配列を返す。
 * DB には書かない（pipeline の責務）。
 *
 * @param {{ lg: string, dateRange: string, logger?: Function }} opts
 *   dateRange は "YYYY-MM-DD" か "YYYY-MM-DD/YYYY-MM-DD"
 * @returns {Promise<Array>} parseKkjXml の結果配列
 */
export async function fetchKkjSlice({ lg, dateRange, logger = () => {} } = {}) {
  if (!lg || !dateRange) throw new Error("fetchKkjSlice: lg と dateRange は必須");
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

// （旧 buildDbRow は削除。pipeline 側の unifiedKkjToItemRow が同等機能を担う）

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

/** JST = UTC+9: epoch に 9時間足してから UTC 表記で日付を取る */
export function fmtDateJst(epochMs) {
  return new Date(epochMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
