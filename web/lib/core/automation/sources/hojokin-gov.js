/**
 * hojokin Source Adapter — 補助金・助成金情報の収集
 *
 * 実ソース:
 *   1. ミラサポPlus (mirasapo-plus.go.jp) — 中小企業庁の主要補助金（詳細取得あり）
 *   2. J-Net21 支援制度ナビ (j-net21.smrj.go.jp) — 中小機構の支援制度一覧（52件+）
 *   3. 中小企業庁 公募情報 — TLS問題のため inactive（復旧次第 active に戻す）
 *
 * 各ソースが失敗しても他ソースの取得は継続する。
 * 全ソース失敗時のみ fallback サンプルデータを使用。
 */

import { fetchHtml, stripTags, resolveUrl, extractHrefs } from "../fetch-helper.js";

const MIRASAPO_BASE = "https://mirasapo-plus.go.jp";
const JNET21_BASE = "https://j-net21.smrj.go.jp";

const HOJOKIN_SOURCES = [
  {
    id: "mirasapo",
    name: "ミラサポPlus",
    url: "https://mirasapo-plus.go.jp/subsidy/",
    parser: "mirasapo",
    detailEnabled: true,
  },
  {
    id: "jnet21",
    name: "J-Net21 支援制度ナビ",
    url: "https://j-net21.smrj.go.jp/publicsupport/index.html",
    parser: "jnet21",
    detailEnabled: true,
  },
  // 中小企業庁: TLS renegotiation loop でタイムアウト — サーバー側の問題
  // 復旧次第 active に戻す
  // {
  //   id: "chusho_meti",
  //   name: "中小企業庁 公募情報",
  //   url: "https://www.chusho.meti.go.jp/koukai/koubo/",
  //   parser: "chusho_meti",
  //   detailEnabled: false,
  // },
];

// ─── メイン取得関数 ─────────────────────────

/**
 * 全ソースから補助金情報を取得
 * @param {{ sourceIds?: string[] }} options
 * @returns {{ items: Array, errors: string[], sources: Array }}
 */
export async function fetchHojokinFromSources({ sourceIds = [] } = {}) {
  const targets = sourceIds.length > 0
    ? HOJOKIN_SOURCES.filter((s) => sourceIds.includes(s.id))
    : HOJOKIN_SOURCES;

  const allItems = [];
  const allErrors = [];
  const sourcesUsed = [];

  for (const source of targets) {
    try {
      console.log(`    [${source.id}] 取得中: ${source.url}`);
      const result = await fetchHtml(source.url, { timeout: 25000 });
      if (!result.ok) {
        allErrors.push(`[${source.name}] 取得失敗: ${result.error}`);
        console.log(`    [${source.id}] 失敗: ${result.error}`);
        continue;
      }

      const items = parseHojokinPage(result.html, source);
      console.log(`    [${source.id}] 一覧: ${items.length}件`);

      // 詳細ページ取得（ミラサポPlus のみ）
      if (source.detailEnabled && items.length > 0) {
        const maxDetail = parseInt(process.env.HOJOKIN_MAX_DETAIL_FETCH || "30", 10);
        const detailTargets = items.filter((i) => i.detail_url).slice(0, maxDetail);
        console.log(`    [${source.id}] 詳細取得: ${detailTargets.length}件`);
        for (const item of detailTargets) {
          try {
            await enrichWithDetailPage(item);
            await sleep(500); // ポライトフェッチ
          } catch (err) {
            allErrors.push(`[${source.name}] 詳細取得失敗 ${item.title}: ${err.message}`);
          }
        }
      }

      allItems.push(...items);
      sourcesUsed.push({ id: source.id, name: source.name, count: items.length });
    } catch (err) {
      allErrors.push(`[${source.name}] パース失敗: ${err.message}`);
      console.log(`    [${source.id}] エラー: ${err.message}`);
    }
  }

  return { items: allItems, errors: allErrors, sources: sourcesUsed };
}

// ─── パーサーディスパッチ ─────────────────────

function parseHojokinPage(html, source) {
  switch (source.parser) {
    case "mirasapo":
      return parseMirasapoListPage(html, source);
    case "chusho_meti":
      return parseChushoMetiPage(html, source);
    case "jnet21":
      return parseJnet21Page(html, source);
    default:
      return [];
  }
}

// ─── ミラサポPlus パーサー ───────────────────

/**
 * ミラサポPlus 補助金一覧ページをパース
 * URL: https://mirasapo-plus.go.jp/subsidy/
 * 構造: /subsidy/xxx/ へのリンクを持つカード形式
 */
function parseMirasapoListPage(html, source) {
  const items = [];
  const seen = new Set();

  // /subsidy/xxx/ 形式のリンクを抽出
  const linkRegex = /<a[^>]*href=["'](\/subsidy\/([a-z0-9_-]+)\/?)[\"'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const slugPart = match[2];
    const linkText = stripTags(match[3]).trim();

    // guide や一覧自体のリンクはスキップ
    if (slugPart === "guide" || slugPart === "subsidy" || !slugPart) continue;
    if (linkText.length < 3) continue;
    if (seen.has(slugPart)) continue;
    seen.add(slugPart);

    const detailUrl = resolveUrl(MIRASAPO_BASE, path);
    const title = linkText.substring(0, 100);

    items.push({
      slug: `mirasapo-${slugPart}`,
      title,
      source_name: source.name,
      source_url: source.url,
      detail_url: detailUrl,
      category: guessCategory(title),
      status: "open",
      provider_name: "中小企業庁",
      target_type: "corp",
    });
  }

  return items;
}

/**
 * ミラサポPlus 詳細ページから補足情報を取得
 */
async function enrichWithDetailPage(item) {
  if (!item.detail_url) return;

  const result = await fetchHtml(item.detail_url, { timeout: 25000 });
  if (!result.ok) return;

  const html = result.html;
  const text = stripTags(html);

  // 補助上限額
  const amount = parseAmountFromText(text, item.title);
  if (amount) item.max_amount = amount;

  // 補助率
  const rate = parseSubsidyRate(text, item.title);
  if (rate) item.subsidy_rate = rate;

  // 締切
  const deadline = parseDeadlineFromText(text);
  if (deadline) item.deadline = deadline;

  // 概要（ページ内のメインコンテンツから抽出）
  const summary = extractSummary(text, item.title);
  if (summary) item.summary = summary;

  // 募集状態
  const detectedStatus = detectClosedStatus(text);
  if (detectedStatus) item.status = detectedStatus;

  // 対象者
  const target = parseTargetType(text);
  if (target) item.target_type = target;

  // 提供元（未設定の場合のみ）
  if (!item.provider_name) {
    const provider = guessProvider(text);
    if (provider) item.provider_name = provider;
  }
}

// ─── 中小企業庁パーサー ─────────────────────

/**
 * 中小企業庁 公募情報ページをパース
 * 構造: リンクリスト形式で補助金公募を掲載
 */
function parseChushoMetiPage(html, source) {
  const items = [];
  const seen = new Set();

  // リンクから補助金関連の公募を抽出
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = stripTags(match[2]).trim();

    if (linkText.length < 5) continue;
    // 補助金・助成金関連のキーワードフィルタ
    if (!linkText.match(/補助|助成|支援|給付|交付|公募/)) continue;
    // ナビゲーションリンクをスキップ
    if (linkText.match(/一覧|トップ|ホーム|サイトマップ/)) continue;

    const detailUrl = resolveUrl(source.url, href);
    const titleKey = linkText.substring(0, 60);
    if (seen.has(titleKey)) continue;
    seen.add(titleKey);

    const title = linkText.substring(0, 100);

    // テキストから日付を検出
    const deadline = parseDeadlineFromText(linkText);

    items.push({
      slug: generateSlug("chusho", title),
      title,
      source_name: source.name,
      source_url: source.url,
      detail_url: detailUrl,
      category: guessCategory(title),
      status: "open",
      provider_name: "中小企業庁",
      target_type: "corp",
      deadline,
    });
  }

  return items;
}

// ─── J-Net21 パーサー ────────────────────────

/**
 * J-Net21 支援制度ナビをパース
 * URL: https://j-net21.smrj.go.jp/publicsupport/index.html
 * 構造: カテゴリ別 <ul><li><a href="/publicsupport/YYYYMMDD.html"> のリスト（52件+）
 */
function parseJnet21Page(html, source) {
  const items = [];
  const seen = new Set();

  // /publicsupport/ 配下の個別ページリンクを抽出
  const linkRegex = /<a[^>]*href=["'](\/publicsupport\/[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const linkText = stripTags(match[2]).trim();

    // index自体やナビゲーションはスキップ
    if (path === "/publicsupport/index.html") continue;
    if (linkText.length < 5) continue;
    if (linkText.match(/一覧|トップ|ホーム|戻る/)) continue;

    // パスからユニークキー
    const pathKey = path.replace("/publicsupport/", "").replace(".html", "");
    if (seen.has(pathKey)) continue;
    seen.add(pathKey);

    const title = linkText.substring(0, 100);
    const detailUrl = resolveUrl(JNET21_BASE, path);

    items.push({
      slug: `jnet21-${pathKey}`,
      title,
      source_name: source.name,
      source_url: source.url,
      detail_url: detailUrl,
      category: guessCategory(title),
      status: "open",
      provider_name: guessProvider(title),
      target_type: "corp",
    });
  }

  return items;
}

/**
 * タイトルから提供元を推定
 */
function guessProvider(text) {
  if (text.match(/経済産業省|経産省/)) return "経済産業省";
  if (text.match(/中小企業庁/)) return "中小企業庁";
  if (text.match(/厚生労働省|厚労省/)) return "厚生労働省";
  if (text.match(/総務省/)) return "総務省";
  if (text.match(/国土交通省/)) return "国土交通省";
  if (text.match(/農林水産省/)) return "農林水産省";
  if (text.match(/環境省/)) return "環境省";
  if (text.match(/NEDO/)) return "NEDO";
  if (text.match(/JETRO/)) return "JETRO";
  if (text.match(/中小機構|SMRJ/)) return "中小企業基盤整備機構";
  return null;
}

// ─── ユーティリティ ──────────────────────────

/**
 * 制度タイプ判定（タイトルベース優先）
 * 税制・相談系は金額パーサーの誤抽出を防ぐために使う
 * 本文テキスト全体にはあらゆるキーワードが混在するため、
 * タイトル(title)で判定し、titleがない場合のみ本文から判定
 */
function detectSchemeType(text, title) {
  const t = title || "";
  // タイトルベース判定（最優先）
  if (t.match(/融資|貸付|資金$/)) return "loan";
  if (t.match(/税制|税額控除|特別償却|減税|損金算入/)) return "tax";
  if (t.match(/共済/)) return "loan"; // 共済制度は金額取得OK
  if (t.match(/ホットライン|ダイヤル|ポータル|プラットフォーム|こころの耳/)) return "consultation";
  if (t.match(/助成金|助成/)) return "grant";
  if (t.match(/補助金|補助/)) return "subsidy";
  // フォールバック: 本文ベース
  if (text.match(/融資限度額|貸付限度額/)) return "loan";
  if (text.match(/税額控除率|特別償却/)) return "tax";
  return "other";
}

/**
 * テキストから補助上限額を抽出
 * 制度タイプ別に適切なパターンを使用:
 *   補助金/助成金: 上限額、補助金額
 *   融資: 融資限度額、貸付限度額
 *   税制: 取得しない（誤抽出防止）
 *   相談/支援: 取得しない
 */
function parseAmountFromText(text, title) {
  const scheme = detectSchemeType(text, title);

  // 税制・相談系は金額を取得しない
  if (scheme === "tax" || scheme === "consultation") return null;

  // ステップ1: 補助金/助成金の明示的な上限額
  const subsidyPrefixes = [
    // 億円
    { re: /(?:最大|上限|補助上限[額金]?|補助金額|補助限度額|助成限度額|助成上限[額金]?)[^\d]{0,8}(\d+(?:\.\d+)?)\s*億円/, mul: 100000000 },
    // 万円
    { re: /(?:最大|上限|補助上限[額金]?|補助金額|補助限度額|助成限度額|助成上限[額金]?)[^\d]{0,8}([\d,]+(?:\.\d+)?)\s*万円/, mul: 10000 },
  ];
  for (const p of subsidyPrefixes) {
    const m = text.match(p.re);
    if (m) {
      const val = Math.round(parseFloat(m[1].replace(/,/g, "")) * p.mul);
      if (val > 0 && val <= 10000000000) return val; // 100億円以下のみ（異常値ガード）
    }
  }

  // ステップ2: 融資制度の限度額
  if (scheme === "loan") {
    const loanPatterns = [
      { re: /(?:融資限度額|貸付限度額|融資額|貸付額)[^\d]{0,8}([\d,]+(?:\.\d+)?)\s*万円/, mul: 10000 },
      { re: /(?:融資限度額|貸付限度額|融資額|貸付額)[^\d]{0,8}(\d+(?:\.\d+)?)\s*億円/, mul: 100000000 },
      // "限度額は2,000万円" パターン
      { re: /限度額[はが][^\d]{0,3}([\d,]+)\s*万円/, mul: 10000 },
    ];
    for (const p of loanPatterns) {
      const m = text.match(p.re);
      if (m) {
        const val = Math.round(parseFloat(m[1].replace(/,/g, "")) * p.mul);
        if (val > 0 && val <= 10000000000) return val;
      }
    }
  }

  // ステップ3: 「補助額」「助成額」キーワード近傍の金額
  const contextPatterns = [
    /(?:補助額|助成額|交付額|支給額|共済金)[^\d]{0,10}([\d,]+(?:\.\d+)?)\s*万円/,
    /(?:補助額|助成額|交付額|支給額|共済金)[^\d]{0,10}(\d+(?:\.\d+)?)\s*億円/,
  ];
  for (const re of contextPatterns) {
    const m = text.match(re);
    if (m) {
      const unit = re.source.includes("億円") ? 100000000 : 10000;
      const val = Math.round(parseFloat(m[1].replace(/,/g, "")) * unit);
      if (val > 0 && val <= 10000000000) return val;
    }
  }

  return null;
}

/**
 * テキストから補助率を抽出
 * 制度タイプ別:
 *   補助金/助成金: 補助率、助成率
 *   融資: 利率（"低利融資" として表示）
 *   税制: 税額控除率
 */
function parseSubsidyRate(text, title) {
  const scheme = detectSchemeType(text, title);

  // 補助率/助成率キーワード検索
  const rateKeywords = ["補助率", "助成率", "補助割合"];
  for (const kw of rateKeywords) {
    const rate = extractRateNear(text, kw);
    if (rate) return rate;
  }

  // 融資制度: 利率を取得（「低利融資」等として表示用）
  if (scheme === "loan") {
    const rateIdx = text.search(/(?:利率|金利|年利)[^\d]{0,5}[\d.]/);
    if (rateIdx !== -1) {
      const nearby = text.substring(rateIdx, rateIdx + 50);
      const pctMatch = nearby.match(/([\d.]+)[〜~～%％]([\d.]+)?[%％]/);
      if (pctMatch) {
        return pctMatch[2] ? `${pctMatch[1]}〜${pctMatch[2]}%` : `${pctMatch[1]}%`;
      }
      const simpleMatch = nearby.match(/([\d.]+)\s*[%％]/);
      if (simpleMatch) return `利率${simpleMatch[1]}%`;
    }
    // "低利融資" パターン
    if (text.match(/低利融資|低利/)) return "低利融資";
  }

  // 税制: 税額控除率
  if (scheme === "tax") {
    const taxRate = extractRateNear(text, "税額控除");
    if (taxRate) return `控除${taxRate}`;
    const depRate = extractRateNear(text, "特別償却");
    if (depRate) return `償却${depRate}`;
  }

  // 定額パターン（キーワードなし）
  if (text.match(/定額[支助]/)) return "定額";

  return null;
}

/**
 * キーワード近傍から率を抽出するヘルパー
 */
function extractRateNear(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return null;
  const nearby = text.substring(idx, idx + 60);

  // X/X〜X/X
  const fracRangeMatch = nearby.match(/(\d\/\d)[〜~～](\d\/\d)/);
  if (fracRangeMatch) return `${fracRangeMatch[1]}〜${fracRangeMatch[2]}`;

  // X/X（分母≧分子）
  const fracMatch = nearby.match(/(\d)\/(\d)/);
  if (fracMatch && parseInt(fracMatch[2]) >= parseInt(fracMatch[1])) {
    return `${fracMatch[1]}/${fracMatch[2]}`;
  }

  // X分のX
  const bunMatch = nearby.match(/(\d)分の(\d)/);
  if (bunMatch) return `${bunMatch[2]}/${bunMatch[1]}`;

  // X%
  const pctMatch = nearby.match(/(\d+(?:[〜~～]\d+)?)\s*[%％]/);
  if (pctMatch) return `${pctMatch[1]}%`;

  // 定額
  if (nearby.match(/定額/)) return "定額";

  return null;
}

/**
 * テキストから締切日を抽出 → YYYY-MM-DD
 * 通年/随時受付の場合は null（deadline なしとして扱う）
 */
function parseDeadlineFromText(text) {
  // 通年/随時受付は null
  if (text.match(/随時受付|通年募集|随時募集|常時受付|特に定めなし/)) return null;

  // 令和X年X月X日
  const reMatch = text.match(/(?:締切|期限|公募期間|募集期間|申請期限|応募期限|受付期間)[^年]{0,20}令和(\d+)年(\d+)月(\d+)日/);
  if (reMatch) {
    const year = 2018 + parseInt(reMatch[1]);
    return `${year}-${String(reMatch[2]).padStart(2, "0")}-${String(reMatch[3]).padStart(2, "0")}`;
  }

  // 20XX年X月X日 or 20XX/X/X（キーワード近傍）
  const dateMatch = text.match(/(?:締切|期限|公募期間|募集期間|申請期限|応募期限|受付期間)[^\d]{0,20}(20\d{2})[年/](\d{1,2})[月/](\d{1,2})日?/);
  if (dateMatch) {
    return `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`;
  }

  // "20XX年X月X日まで" パターン（キーワードなし）
  const broadMatch = text.match(/(20\d{2})[年/](\d{1,2})[月/](\d{1,2})日?\s*(?:まで|締切|期限)/);
  if (broadMatch) {
    return `${broadMatch[1]}-${String(broadMatch[2]).padStart(2, "0")}-${String(broadMatch[3]).padStart(2, "0")}`;
  }

  // 令和X年度末 (= 3月31日) パターン
  const fyMatch = text.match(/令和(\d+)年度末/);
  if (fyMatch) {
    const year = 2019 + parseInt(fyMatch[1]);
    return `${year}-03-31`;
  }

  return null;
}

/**
 * テキストから概要を抽出（最初の意味のある文を200文字）
 * J-Net21 対応: 「概要」「制度の概要」セクション優先
 */
function extractSummary(text, title) {
  // 「概要」セクション近傍を優先検索
  const overviewKeywords = ["制度の概要", "概要", "事業の目的", "事業概要", "趣旨"];
  for (const kw of overviewKeywords) {
    const idx = text.indexOf(kw);
    if (idx === -1) continue;
    const after = text.substring(idx + kw.length, idx + kw.length + 500);
    const lines = after.split(/\n/).filter((l) => l.trim().length > 15);
    for (const line of lines) {
      const trimmed = line.trim();
      if (isNoiseLine(trimmed)) continue;
      if (trimmed.length > 15 && trimmed.length < 500) {
        return trimmed.substring(0, 200);
      }
    }
  }

  // フォールバック: タイトルを除去して意味のある文を探す
  const cleaned = text.replace(title, "").trim();
  const lines = cleaned.split(/\n/).filter((l) => l.trim().length > 20);
  for (const line of lines) {
    const trimmed = line.trim();
    if (isNoiseLine(trimmed)) continue;
    if (trimmed.length > 20 && trimmed.length < 500) {
      return trimmed.substring(0, 200);
    }
  }
  return null;
}

/** ノイズ行判定 */
function isNoiseLine(text) {
  if (text.match(/^(ホーム|メニュー|検索|ログイン|お問い合わせ|copyright|function|var |const |let |window\.|document\.|gtm|analytics|\(function|経営課題|支援情報|J-Net21|中小機構)/i)) return true;
  // JS/HTML の残骸
  if (text.match(/createElement|dataLayer|googletagmanager|querySelector|addEventListener/)) return true;
  if (text.match(/[{}();=]/) && text.match(/function|push|var|window|document/)) return true;
  if (text.match(/^j=d\.|^dl=l/)) return true;
  if (text.match(/^(前の|次の|ページ|印刷|シェア|共有|Twitter|Facebook|LINE)/)) return true;
  return false;
}

/**
 * 募集終了検知
 */
function detectClosedStatus(text) {
  if (text.match(/募集終了|受付終了|公募終了|受付停止|終了しました|募集は終了/)) return "closed";
  if (text.match(/募集予定|準備中|近日公開|公募開始前/)) return "upcoming";
  if (text.match(/随時受付|通年募集|随時募集/)) return "open";
  return null;
}

/**
 * テキストから対象者タイプを判定
 */
function parseTargetType(text) {
  if (text.match(/個人事業主/)) return "sole";
  if (text.match(/スタートアップ|ベンチャー|創業/)) return "startup";
  if (text.match(/NPO|団体|協会/)) return "npo";
  if (text.match(/中小企業|小規模事業者|法人/)) return "corp";
  return null;
}

/**
 * カテゴリ推定 — hojokin-config.js の有効カテゴリに統一
 * 有効: it, startup, equipment, rd, employment, export, other
 */
function guessCategory(text) {
  if (text.match(/IT|デジタル|DX|情報|ICT|AI|サイバー/)) return "it";
  if (text.match(/ものづくり|設備|機械|省力化|省人化/)) return "equipment";
  if (text.match(/雇用|人材|キャリア|研修|テレワーク/)) return "employment";
  if (text.match(/創業|起業|スタートアップ|開業/)) return "startup";
  if (text.match(/研究|開発|技術|R&D|イノベーション/)) return "rd";
  if (text.match(/海外|輸出|国際|グローバル/)) return "export";
  if (text.match(/環境|省エネ|太陽|EV|GX|カーボン|脱炭素/)) return "equipment";
  if (text.match(/事業承継|M&A|承継/)) return "other";
  if (text.match(/持続化|小規模/)) return "other";
  return "other";
}

/**
 * slug 生成
 */
function generateSlug(prefix, title) {
  const base = title
    .replace(/[（）()【】\[\]「」『』\s]/g, "-")
    .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
  return `${prefix}-${base}`.toLowerCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── サンプルデータ（フォールバック） ─────

export function getSampleHojokinItems() {
  return [
    { slug: "sample-it-hojo-new", title: "【新着】中小企業デジタル化支援補助金", category: "it", target_type: "corp", max_amount: 3000000, subsidy_rate: "2/3", deadline: "2026-07-31", status: "open", provider_name: "経済産業省", summary: "中小企業のデジタル化を支援する新規補助金。", source_name: "サンプル", source_url: null, detail_url: null },
    { slug: "sample-setsubi-hojo-new", title: "【新着】省力化投資補助金（第3次）", category: "equipment", target_type: "corp", max_amount: 15000000, subsidy_rate: "1/2", deadline: "2026-08-31", status: "open", provider_name: "中小企業庁", summary: "人手不足対応のための省力化設備導入を支援。", source_name: "サンプル", source_url: null, detail_url: null },
    { slug: "sample-green-hojo-new", title: "【新着】GX推進設備投資補助金", category: "equipment", target_type: "corp", max_amount: 50000000, subsidy_rate: "1/3", deadline: "2026-09-30", status: "open", provider_name: "経済産業省", summary: "GX（グリーントランスフォーメーション）に資する設備投資を支援。", source_name: "サンプル", source_url: null, detail_url: null },
  ];
}

// ─── 期限切れチェック ────────────────────────

/**
 * 既存データとの差分検知（期限切れチェック含む）
 */
export function checkHojokinExpiry(db) {
  const now = new Date().toISOString().substring(0, 10);
  const expired = db.prepare(
    "SELECT * FROM hojokin_items WHERE status = 'open' AND deadline IS NOT NULL AND deadline < ? AND is_published = 1"
  ).all(now);
  return expired;
}
