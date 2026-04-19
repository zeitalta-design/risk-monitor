/**
 * 国税庁法人番号 Web API で sanpai の corporate_number を補完可能か、
 * 書き込み無しで検証する dry-run。
 *
 * 仕様:
 *   - 対象: corporate_number 未登録 + is_published=1 な sanpai_items
 *   - 都道府県を必須条件にする（JIS X 0401 prefecture code で API に渡す）
 *   - 名称 exact 一致、または normalizeCompanyKey 経由の強い一致のみ採用候補
 *   - 単一候補のみ採用。multi candidate は不採用
 *   - fuzzy / LLM は使わない
 *   - Rate limit: 10 req/s（API 公表 上限）だが安全側で 8 req/s
 *
 * 書き込み: 一切なし（DB に ALTER も INSERT も UPDATE もしない）
 *
 * 環境変数:
 *   NTA_API_APP_ID              - 国税庁 Web-API の application ID（必須）
 *                                 https://www.houjin-bangou.nta.go.jp/webapi/ で無料取得
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN - リモート Turso を見る場合
 *
 * 実行:
 *   node scripts/backfill-sanpai-corp-via-houjin-api.mjs            # 全件
 *   node scripts/backfill-sanpai-corp-via-houjin-api.mjs --sample=30 # 先頭 N 件のみ（試走）
 *   node scripts/backfill-sanpai-corp-via-houjin-api.mjs --limit=200 # 最大 N 件で打ち切り
 */
import path from "node:path";
import fs from "node:fs";

// ─── .env.local ロード ─────────────────────────────────
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const c = fs.readFileSync(envLocalPath, "utf8");
  for (const line of c.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const NTA_APP_ID = process.env.NTA_API_APP_ID;
if (!NTA_APP_ID) {
  console.error("[houjin-api] ERROR: NTA_API_APP_ID が未設定です。");
  console.error("  https://www.houjin-bangou.nta.go.jp/webapi/ で application ID を無料取得し、");
  console.error("  web/.env.local に NTA_API_APP_ID=<id> を追加してください。");
  process.exit(1);
}

// ─── CLI オプション ─────────────────────────────────────
const args = process.argv.slice(2);
const sampleArg = args.find((a) => a.startsWith("--sample="));
const limitArg  = args.find((a) => a.startsWith("--limit="));
const SAMPLE = sampleArg ? parseInt(sampleArg.split("=")[1], 10) : null;
const LIMIT  = limitArg  ? parseInt(limitArg.split("=")[1], 10)  : null;

const { getDb } = await import("../lib/db.js");
const { normalizeCompanyKey } = await import("../lib/agents/resolver/normalize.js");

const db = getDb();

// ─── 都道府県コード（JIS X 0401） ───────────────────────
const PREFECTURE_CODE = {
  "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05",
  "山形県": "06", "福島県": "07", "茨城県": "08", "栃木県": "09", "群馬県": "10",
  "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14", "新潟県": "15",
  "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
  "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25",
  "京都府": "26", "大阪府": "27", "兵庫県": "28", "奈良県": "29", "和歌山県": "30",
  "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34", "山口県": "35",
  "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
  "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45",
  "鹿児島県": "46", "沖縄県": "47",
};

// ─── NTA API 呼び出し ──────────────────────────────────
const API_BASE = "https://api.houjin-bangou.nta.go.jp/4/name";
const RATE_DELAY_MS = 125; // 8 req/s（上限 10 req/s より安全側）
const REQUEST_TIMEOUT_MS = 15000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * /name?id=X&name=Y&address=Z&mode=2&type=02&history=0
 * 返り値: 検索結果レコード配列。CSV UTF-8 を自前でパース。
 */
async function searchByName(name, prefCode) {
  const params = new URLSearchParams({
    id: NTA_APP_ID,
    name: name,
    type: "02",     // CSV UTF-8
    mode: "2",      // 部分一致
    target: "1",    // 商号又は名称
    history: "0",   // 履歴なし
  });
  if (prefCode) params.set("address", prefCode);

  const url = `${API_BASE}?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RiskMonitor/1.0 (sanpai-corp-dryrun)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`NTA HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return parseNtaCsv(text);
}

/**
 * 国税庁 Web-API v4 /name の CSV 仕様:
 *   1行目は件数等のヘッダ行（v4 では "count" 行が先頭）
 *   各レコードは 30 カラム、ダブルクオートで囲まれ、,区切り
 * 必要なカラムのみ抽出。
 */
function parseNtaCsv(text) {
  if (!text || text.trim().length === 0) return [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  // 先頭行は "ヘッダー"（件数カウント 1 カラム行 or バージョン行）。
  // カンマ数が少ないものはスキップ。
  const results = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 15) continue; // カウント行や空行はスキップ
    const [
      /* 1 sequence */, corporate_number, /* 3 process */, /* 4 correct */,
      /* 5 update */, /* 6 change */, name, /* 8 img */, /* 9 kind */,
      prefecture_name, city_name, street_number, /* 13 addr_img */,
      prefecture_code, /* 15 city_code */, /* 16 post */, /* 17 abroad */,
      /* 18 abroad_img */, close_date,
    ] = cols;
    results.push({
      corporate_number,
      name,
      prefecture_name,
      prefecture_code,
      city_name,
      street_number,
      close_date,
    });
  }
  return results;
}

/** ダブルクオート対応の最小 CSV 1行パーサ */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

// ─── 対象ロウ取得 ───────────────────────────────────────
let rows = db.prepare(`
  SELECT id, slug, company_name, prefecture, city, corporate_number, source_name
  FROM sanpai_items
  WHERE is_published = 1 AND (corporate_number IS NULL OR corporate_number = '')
  ORDER BY id
`).all();

const totalTarget = rows.length;
if (SAMPLE) rows = rows.slice(0, SAMPLE);
if (LIMIT)  rows = rows.slice(0, LIMIT);

console.log("=== NTA houjin-bangou API corp-backfill dry-run ===");
console.log(`total target (corp 未登録 sanpai): ${totalTarget}`);
if (SAMPLE || LIMIT) console.log(`  この試走で処理: ${rows.length} 件`);
console.log(`rate: ~${Math.round(1000 / RATE_DELAY_MS)} req/s`);
console.log();

// ─── メインループ ───────────────────────────────────────
const buckets = {
  no_prefecture:      [],   // sanpai.prefecture が空 → 照合できない
  api_hit_zero:       [],   // API 0件
  api_error:          [],   // HTTP エラー
  single_exact:       [],   // 採用候補（名称 exact 一致）
  single_normalized:  [],   // 採用候補（normalized_key 一致）
  prefecture_mismatch:[],   // 候補に県一致が無い
  multi_candidate:    [],   // 候補 2 corp 以上（曖昧）
};

let processed = 0;
let apiHitTotal = 0;
let startAt = Date.now();

for (const row of rows) {
  processed++;
  const name = (row.company_name || "").trim();
  const pref = (row.prefecture || "").trim();
  const prefCode = PREFECTURE_CODE[pref];

  if (!prefCode) { buckets.no_prefecture.push({ row, reason: pref ? `unknown prefecture: ${pref}` : "empty prefecture" }); continue; }
  if (!name || name.length < 2) { buckets.api_error.push({ row, reason: "name too short" }); continue; }

  let hits;
  try {
    hits = await searchByName(name, prefCode);
  } catch (e) {
    buckets.api_error.push({ row, reason: `${e.status || ""} ${e.message}`.slice(0, 120) });
    await sleep(RATE_DELAY_MS);
    continue;
  }
  apiHitTotal += hits.length;

  // 閉鎖法人を除外
  const live = hits.filter((h) => !h.close_date || h.close_date === "");

  // 都道府県名一致だけを残す（API の address 指定は本社住所ベースなので再確認）
  const inPref = live.filter((h) => h.prefecture_name === pref);
  if (live.length > 0 && inPref.length === 0) {
    buckets.prefecture_mismatch.push({ row, hits: live.slice(0, 3) });
    await sleep(RATE_DELAY_MS);
    continue;
  }

  if (live.length === 0) {
    buckets.api_hit_zero.push({ row });
    await sleep(RATE_DELAY_MS);
    continue;
  }

  // 名称 exact / normalized 比較
  const inKey = normalizeCompanyKey(name);
  const exactMatches = [];
  const normMatches  = [];
  for (const h of inPref) {
    if (h.name === name) exactMatches.push(h);
    else if (inKey && normalizeCompanyKey(h.name) === inKey) normMatches.push(h);
  }

  const distinctExact = [...new Set(exactMatches.map((h) => h.corporate_number))];
  const distinctNorm  = [...new Set(normMatches.map((h) => h.corporate_number))];

  if (distinctExact.length === 1) {
    buckets.single_exact.push({ row, hit: exactMatches[0] });
  } else if (distinctExact.length > 1) {
    buckets.multi_candidate.push({ row, kind: "exact", hits: exactMatches.slice(0, 3) });
  } else if (distinctNorm.length === 1) {
    buckets.single_normalized.push({ row, hit: normMatches[0] });
  } else if (distinctNorm.length > 1) {
    buckets.multi_candidate.push({ row, kind: "normalized", hits: normMatches.slice(0, 3) });
  } else {
    // 県一致候補はあるが、名称 exact/normalized が無い
    buckets.api_hit_zero.push({ row, note: `県一致 ${inPref.length}件（名称不一致）` });
  }

  if (processed % 25 === 0) {
    const elapsed = ((Date.now() - startAt) / 1000).toFixed(1);
    console.log(`  progress: ${processed}/${rows.length} (${elapsed}s, adoptable so far: ${buckets.single_exact.length + buckets.single_normalized.length})`);
  }

  await sleep(RATE_DELAY_MS);
}

const elapsed = ((Date.now() - startAt) / 1000).toFixed(1);
console.log();
console.log(`処理完了: ${processed}件 in ${elapsed}s`);
console.log();

// ─── 集計 ────────────────────────────────────────────
const n = rows.length;
function pct(v) { return n > 0 ? ((v / n) * 100).toFixed(1) + "%" : "—"; }

console.log("── dry-run 結果（分母 = 処理件数 " + n + "） ─────────────");
console.log(`  no_prefecture       : ${String(buckets.no_prefecture.length).padStart(4)}  (${pct(buckets.no_prefecture.length)})  ← sanpai 側 prefecture 不明`);
console.log(`  api_error           : ${String(buckets.api_error.length).padStart(4)}  (${pct(buckets.api_error.length)})`);
console.log(`  api_hit_zero        : ${String(buckets.api_hit_zero.length).padStart(4)}  (${pct(buckets.api_hit_zero.length)})  ← 該当なし`);
console.log(`  prefecture_mismatch : ${String(buckets.prefecture_mismatch.length).padStart(4)}  (${pct(buckets.prefecture_mismatch.length)})  ← 県不一致（採用しない）`);
console.log(`  multi_candidate     : ${String(buckets.multi_candidate.length).padStart(4)}  (${pct(buckets.multi_candidate.length)})  ← 曖昧（採用しない）`);
console.log(`  single_exact        : ${String(buckets.single_exact.length).padStart(4)}  (${pct(buckets.single_exact.length)})  ← 採用候補（名称 exact）`);
console.log(`  single_normalized   : ${String(buckets.single_normalized.length).padStart(4)}  (${pct(buckets.single_normalized.length)})  ← 採用候補（normalized）`);
console.log();

const adoptable = buckets.single_exact.length + buckets.single_normalized.length;
console.log(`api hit total (raw)          : ${apiHitTotal}`);
console.log(`採用可能件数（adoptable）    : ${adoptable} (${pct(adoptable)})`);
console.log();

// ─── サンプル ────────────────────────────────────────
function printSample(title, items, max, render) {
  console.log(`── sample: ${title} ─────────────`);
  const take = items.slice(0, max);
  if (take.length === 0) { console.log("  (none)"); return; }
  for (const x of take) console.log("  " + render(x));
  if (items.length > max) console.log(`  ... and ${items.length - max} more`);
  console.log();
}

printSample("single_exact（採用候補）", buckets.single_exact, 10, (x) => {
  return `${(x.row.company_name || "").padEnd(30)} [${x.row.prefecture || "?"}] -> ${x.hit.corporate_number} (${x.hit.name})`;
});

printSample("single_normalized（採用候補）", buckets.single_normalized, 10, (x) => {
  return `${(x.row.company_name || "").padEnd(30)} [${x.row.prefecture || "?"}] -> ${x.hit.corporate_number} (${x.hit.name})`;
});

printSample("prefecture_mismatch（不採用）", buckets.prefecture_mismatch, 5, (x) => {
  const h = x.hits[0];
  return `${(x.row.company_name || "").padEnd(30)} [sanpai:${x.row.prefecture}] -> hit in ${h.prefecture_name}`;
});

printSample("multi_candidate（不採用）", buckets.multi_candidate, 5, (x) => {
  const corps = x.hits.map((h) => `${h.corporate_number}=${h.name}`).slice(0, 2).join(" / ");
  return `${(x.row.company_name || "").padEnd(30)} [${x.row.prefecture}] -> (${x.kind}) ${corps}`;
});

printSample("api_hit_zero（API 0件 or 名称不一致）", buckets.api_hit_zero, 5, (x) => {
  return `${(x.row.company_name || "").padEnd(30)} [${x.row.prefecture || "?"}] ${x.note || ""}`;
});

printSample("api_error", buckets.api_error, 3, (x) => {
  return `${(x.row.company_name || "").padEnd(30)} - ${x.reason}`;
});

// ─── まとめ ─────────────────────────────────────────
const withCorpAlreadyTotal = db.prepare(`
  SELECT COUNT(*) n FROM sanpai_items WHERE is_published = 1 AND corporate_number IS NOT NULL AND corporate_number != ''
`).get().n;
const publishedTotal = db.prepare(`SELECT COUNT(*) n FROM sanpai_items WHERE is_published = 1`).get().n;

console.log("── まとめ ─────────────");
console.log(`現在 sanpai.corp 付与率:       ${withCorpAlreadyTotal} / ${publishedTotal} = ${((withCorpAlreadyTotal / publishedTotal) * 100).toFixed(1)}%`);
if (!SAMPLE && !LIMIT) {
  console.log(`dry-run 適用後の付与率見込み:  ${withCorpAlreadyTotal + adoptable} / ${publishedTotal} = ${(((withCorpAlreadyTotal + adoptable) / publishedTotal) * 100).toFixed(1)}%`);
} else {
  const extrapolated = Math.round(adoptable * (totalTarget / n));
  console.log(`試走 ${n} 件 → 全量 ${totalTarget} 件の推定採用数: ~${extrapolated}`);
  console.log(`適用後の付与率推定: ${(((withCorpAlreadyTotal + extrapolated) / publishedTotal) * 100).toFixed(1)}%`);
}
console.log();
console.log("※ この dry-run は DB を変更していません。");

process.exit(0);
