/**
 * 都道府県別行政処分スクレイパー基盤
 *
 * 各都道府県の公式サイトから行政処分情報を取得する。
 * サイト構造が異なるため、県ごとにパーサーを定義。
 * 未対応の県はスキップし、対応済み一覧を返す。
 *
 * Vercelサーバーレス環境考慮: 1回あたり最大5県に制限。
 */

import { getDb } from "@/lib/db";

const PAGE_DELAY_MS = 2000;
const MAX_PREFECTURES_PER_RUN = 10;

// ─── 県別パーサー定義 ─────────────────────
// 各県のHTMLテーブル構造に対応したパーサー
// 対応済みの県のみ登録。追加時はここにパーサーを追加する。

const PREFECTURE_PARSERS = {
  hokkaido: {
    prefecture: "北海道",
    url: "https://www.pref.hokkaido.lg.jp/kn/ksd/fudousan/syobun.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseGenericTable,
  },
  tokyo: {
    prefecture: "東京都",
    url: "https://www.juutakuseisaku.metro.tokyo.lg.jp/fudosan/takken/gs-syobun",
    industry: "real_estate",
    sector: "takken",
    parse: parseGenericTable,
  },
  osaka: {
    prefecture: "大阪府",
    url: "https://www.pref.osaka.lg.jp/o130200/kenshin/kantoku/index.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseWithSubpages,
  },
  saitama: {
    prefecture: "埼玉県",
    url: "https://www.pref.saitama.lg.jp/a1106/takkensoudan-main/kantokusyobun-kekkaitiranhyou.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseGenericTable,
  },
  kanagawa: {
    prefecture: "神奈川県",
    url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531871/p870145.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseWithSubpages,
  },
  aichi: {
    prefecture: "愛知県",
    url: "https://www.pref.aichi.jp/soshiki/toshi-somu/takken-kantoku.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseGenericTable,
  },
  fukuoka_takken: {
    prefecture: "福岡県",
    url: "https://www.pref.fukuoka.lg.jp/contents/takkensyobun.html",
    industry: "real_estate",
    sector: "takken",
    parse: parseGenericTable,
  },

  // --- 宅建業 confirmed 25県 ---
  miyagi_takken: { prefecture: "宮城県", url: "https://www.pref.miyagi.jp/soshiki/kentaku/takken-syobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  fukushima_takken: { prefecture: "福島県", url: "https://www.pref.fukushima.lg.jp/sec/41065b/takken-top.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  ibaraki_takken: { prefecture: "茨城県", url: "https://www.pref.ibaraki.jp/doboku/kenshi/kansatsu/kansatsumennkyohp/takkenn/syobunmenu260612syusei.html", industry: "real_estate", sector: "takken", parse: parseWithSubpages },
  tochigi_takken: { prefecture: "栃木県", url: "https://www.pref.tochigi.lg.jp/h11/town/jyuutaku/jyuutaku/1259653272116.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  gunma_takken: { prefecture: "群馬県", url: "https://www.pref.gunma.jp/page/10878.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  chiba_takken: { prefecture: "千葉県", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/takuchi/index.html", industry: "real_estate", sector: "takken", parse: parseSubpagesWithText },
  niigata_takken: { prefecture: "新潟県", url: "https://www.pref.niigata.lg.jp/sec/jutaku/1303250453579.html", industry: "real_estate", sector: "takken", parse: parseSubpagesWithText },
  toyama_takken: { prefecture: "富山県", url: "https://www.pref.toyama.jp/1507/kendodukuri/toshikeikaku/keikaku-tochi/kj00003448/kj00003448-010-01.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  fukui_takken: { prefecture: "福井県", url: "https://www.pref.fukui.lg.jp/doc/kenchikujyuutakuka/takkenn/kantokusyobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nagano_takken: { prefecture: "長野県", url: "https://www.pref.nagano.lg.jp/kenchiku/infra/kensetsu/takken/shobun.html", industry: "real_estate", sector: "takken", parse: parseSubpagesWithText },
  gifu_takken: { prefecture: "岐阜県", url: "https://www.pref.gifu.lg.jp/page/625.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  shizuoka_takken: { prefecture: "静岡県", url: "https://www.pref.shizuoka.jp/kurashikankyo/kenchiku/takuchitatemono/1015904.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  shiga_takken: { prefecture: "滋賀県", url: "https://www.pref.shiga.lg.jp/ippan/kendoseibi/zyuutaku/19133.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  kyoto_takken: { prefecture: "京都府", url: "https://www.pref.kyoto.jp/kenchiku/16000036.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  hyogo_takken: { prefecture: "兵庫県", url: "https://web.pref.hyogo.lg.jp/ks29/wd22_000000013.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nara_takken: { prefecture: "奈良県", url: "https://www.pref.nara.lg.jp/n155/3741.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  wakayama_takken: { prefecture: "和歌山県", url: "https://www.pref.wakayama.lg.jp/prefg/080800/takken/syobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  tottori_takken: { prefecture: "鳥取県", url: "https://www.pref.tottori.lg.jp/228167.htm", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  hiroshima_takken: { prefecture: "広島県", url: "https://www.pref.hiroshima.lg.jp/soshiki/107/kantoku0304.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  tokushima_takken: { prefecture: "徳島県", url: "https://www.pref.tokushima.lg.jp/ippannokata/kurashi/kenchiku/2012042600207", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  kagawa_takken: { prefecture: "香川県", url: "https://www.pref.kagawa.lg.jp/jutaku/takken/syobunkijyuntoppage.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  ehime_takken: { prefecture: "愛媛県", url: "https://www.pref.ehime.jp/page/2119.html", industry: "real_estate", sector: "takken", parse: parseWithPdf },
  kochi_takken: { prefecture: "高知県", url: "https://www.pref.kochi.lg.jp/doc/takken-syobunjyouhou/", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  saga_takken: { prefecture: "佐賀県", url: "https://www.pref.saga.lg.jp/kiji003106819/index.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nagasaki_takken: { prefecture: "長崎県", url: "https://www.pref.nagasaki.lg.jp/doc/page-435819.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },

  // --- 建設業 confirmed 全30県（Web調査で正しいURL確認済み） ---
  hokkaido_kensetsu: { prefecture: "北海道", url: "https://www.pref.hokkaido.lg.jp/kn/ksk/kenjohp/sinsa/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  saitama_kensetsu: { prefecture: "埼玉県", url: "https://www.pref.saitama.lg.jp/a1002/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tokyo_kensetsu: { prefecture: "東京都", url: "https://www.toshiseibi.metro.tokyo.lg.jp/kenchiku_kaihatsu/kenchiku_shidou/gyosya_shido/kensetsu/kensetsu04", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kanagawa_kensetsu: { prefecture: "神奈川県", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531856/p870268.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  aichi_kensetsu: { prefecture: "愛知県", url: "https://www.pref.aichi.jp/soshiki/toshi-somu/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  osaka_kensetsu: { prefecture: "大阪府", url: "https://www.pref.osaka.lg.jp/o130200/kenshin/syobunitiran-top/index.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  fukuoka_kensetsu: { prefecture: "福岡県", url: "https://www.pref.fukuoka.lg.jp/contents/kennsetukanntokushobunn.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  miyagi_kensetsu: { prefecture: "宮城県", url: "https://www.pref.miyagi.jp/soshiki/jigyokanri/syobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  fukushima_kensetsu: { prefecture: "福島県", url: "https://www.pref.fukushima.lg.jp/sec/41025c/kyokasyobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  chiba_kensetsu: { prefecture: "千葉県", url: "https://www.pref.chiba.lg.jp/kenfudou/haigyou-kennsetugyo.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  niigata_kensetsu: { prefecture: "新潟県", url: "https://www.pref.niigata.lg.jp/sec/dobokukanri/1191256251816.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  nagano_kensetsu: { prefecture: "長野県", url: "https://www.pref.nagano.lg.jp/kensetsu/infra/kensetsu/kyoka/shobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  gifu_kensetsu: { prefecture: "岐阜県", url: "https://www.pref.gifu.lg.jp/page/24156.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  shizuoka_kensetsu: { prefecture: "静岡県", url: "https://www.pref.shizuoka.jp/machizukuri/kokyokoji/kensetsu/1003479/1028885.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  mie_kensetsu: { prefecture: "三重県", url: "https://www.pref.mie.lg.jp/GYOHSEI/000070977.htm", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  shiga_kensetsu: { prefecture: "滋賀県", url: "https://www.pref.shiga.lg.jp/ippan/shigotosangyou/kensetsu/300353.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kyoto_kensetsu: { prefecture: "京都府", url: "https://www.pref.kyoto.jp/kensetugyo/kensetugyoukyoka/kantokuzyobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  hyogo_kensetsu: { prefecture: "兵庫県", url: "https://web.pref.hyogo.lg.jp/ks02/kantokusyobun2020.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  nara_kensetsu: { prefecture: "奈良県", url: "https://www.pref.nara.lg.jp/n155/11701.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tottori_kensetsu: { prefecture: "鳥取県", url: "https://www.pref.tottori.lg.jp/228168.htm", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  okayama_kensetsu: { prefecture: "岡山県", url: "https://www.pref.okayama.jp/page/detail-46609.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  hiroshima_kensetsu: { prefecture: "広島県", url: "https://www.pref.hiroshima.lg.jp/soshiki/93/1206083718262.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tokushima_kensetsu: { prefecture: "徳島県", url: "https://www.pref.tokushima.lg.jp/jigyoshanokata/kendozukuri/kensetsu/7303004/", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kagawa_kensetsu: { prefecture: "香川県", url: "https://www.pref.kagawa.lg.jp/dobokukanri/nyusatu/koji/kantokusyobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  ehime_kensetsu: { prefecture: "愛媛県", url: "https://www.pref.ehime.jp/page/2120.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kochi_kensetsu: { prefecture: "高知県", url: "https://www.pref.kochi.lg.jp/doc/kantokushobun_list/", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  saga_kensetsu: { prefecture: "佐賀県", url: "https://www.pref.saga.lg.jp/kiji003112004/index.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  oita_kensetsu: { prefecture: "大分県", url: "https://www.pref.oita.jp/site/n-kennsetsugyou/n-kantokushobunntokushobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kagoshima_kensetsu: { prefecture: "鹿児島県", url: "http://www.pref.kagoshima.jp/ah01/infra/tochi-kensetu/kensetu/sidoukantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  okinawa_kensetsu: { prefecture: "沖縄県", url: "https://www.pref.okinawa.jp/machizukuri/kenchiku/1023167/1013358/1028170.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
};

/** 対応済み都道府県の一覧 */
export function getSupportedPrefectures() {
  return Object.entries(PREFECTURE_PARSERS)
    .filter(([, v]) => v.url && v.parse)
    .map(([key, v]) => ({ key, prefecture: v.prefecture, sector: v.sector }));
}

// ─── 汎用テーブルパーサー ─────────────────────

/**
 * HTMLテーブルから行政処分情報を抽出する汎用パーサー。
 * 多くの都道府県がtable要素で処分一覧を公開しているため共通化。
 */
function parseGenericTable(html, config) {
  const items = [];

  // テーブル行を抽出
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatch) return items;

  for (const table of tableMatch) {
    const rows = table.split(/<tr[^>]*>/i).slice(1);

    for (const row of rows) {
      const cells = row.split(/<td[^>]*>/i).slice(1).map((c) =>
        c.replace(/<[^>]+>/g, "").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim()
      );

      if (cells.length < 3) continue;

      // ヘッダー行をスキップ
      const firstCell = cells[0].toLowerCase();
      if (firstCell.includes("処分日") || firstCell.includes("年月日") || firstCell.includes("事業者")) continue;

      // 日付を探す
      let actionDate = null;
      let companyName = null;
      let actionTypeRaw = null;

      for (const cell of cells) {
        // 日付パターン
        if (!actionDate) {
          const dateMatch = cell.match(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
          if (dateMatch) {
            actionDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
            continue;
          }
          const jpDateMatch = cell.match(/(令和|平成)\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)/);
          if (jpDateMatch) {
            const era = jpDateMatch[1];
            const year = parseInt(jpDateMatch[2]) + (era === "令和" ? 2018 : era === "平成" ? 1988 : 0);
            actionDate = `${year}-${jpDateMatch[3].padStart(2, "0")}-${jpDateMatch[4].padStart(2, "0")}`;
            continue;
          }
        }

        // 処分種別パターン
        if (!actionTypeRaw && (cell.includes("取消") || cell.includes("停止") || cell.includes("指示") || cell.includes("勧告"))) {
          actionTypeRaw = cell;
          continue;
        }

        // 事業者名（2文字以上、日付や処分種別以外）
        if (!companyName && cell.length >= 2 && !cell.match(/^\d/) && !cell.includes("取消") && !cell.includes("停止")) {
          companyName = cell;
        }
      }

      if (companyName && companyName.length >= 2) {
        items.push({
          company_name: companyName.slice(0, 100),
          action_type_raw: actionTypeRaw || "その他",
          action_type: normalizeActionType(actionTypeRaw),
          action_date: actionDate,
          authority: config.prefecture,
          prefecture: config.prefecture,
        });
      }
    }
  }

  return items;
}

/**
 * リンク追従型パーサー
 * トップページからサブページURLを抽出し、各サブページのHTMLテーブルをパースする。
 * 大阪府（月別リンク）、神奈川県（年度別リンク）、茨城県等に対応。
 */
async function parseWithSubpages(html, config) {
  const baseUrl = new URL(config.url);
  const items = [];

  // サブページへのリンクを抽出（処分・syobun・kantoku・監督を含むリンク）
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*(?:処分|syobun|kantoku|監督|令和|平成)[^<]*<\/a>/gi;
  const links = new Set();
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith("/")) {
      href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
    } else if (!href.startsWith("http")) {
      const dir = config.url.substring(0, config.url.lastIndexOf("/") + 1);
      href = dir + href;
    }
    // PDF除外、同一ドメインのみ
    if (!href.endsWith(".pdf") && href.includes(baseUrl.host)) {
      links.add(href);
    }
  }

  // 最大5サブページまで取得（Vercel制限考慮）
  const subpageUrls = [...links].slice(0, 5);

  for (const url of subpageUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "RiskMonitor/1.0 (administrative-data-collection)" },
      });
      if (!res.ok) continue;
      const subHtml = await res.text();
      const subItems = parseGenericTable(subHtml, config);
      items.push(...subItems);
      // リクエスト間隔
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      // サブページ取得失敗は無視
    }
  }

  return items;
}

/**
 * テキスト段落型パーサー
 * HTMLテーブルではなく、h3+p や dt+dd で処分情報が記述されているページに対応。
 * 千葉県（h3見出し型）、長野県（dt/dd定義リスト型）、新潟県（h3+p型）等。
 * サブページリンク追従と組み合わせて使用。
 */
function parseTextSections(html, config) {
  const items = [];

  // dt/dd 定義リスト型（長野県等）
  const dlItems = parseDlSections(html, config);
  if (dlItems.length > 0) return dlItems;

  // h3+テキスト型（千葉県・新潟県等）
  const h3Items = parseH3Sections(html, config);
  if (h3Items.length > 0) return h3Items;

  // フォールバック: テーブルパーサーも試す
  return parseGenericTable(html, config);
}

/** dt/dd 定義リスト型パーサー（長野県等） */
function parseDlSections(html, config) {
  const items = [];
  // 処分セクションを分割（＜処分N＞等で区切り）
  const sections = html.split(/＜処分\d+＞|【処分\d+】|<h[23][^>]*>[^<]*処分\s*\d/i);

  for (const section of sections) {
    let companyName = null;
    let actionDate = null;
    let actionTypeRaw = null;

    // dt/dd パターンで抽出
    const dtddPairs = section.match(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi) || [];
    for (const pair of dtddPairs) {
      const dtMatch = pair.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
      const ddMatch = pair.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i);
      if (!dtMatch || !ddMatch) continue;

      const label = dtMatch[1].replace(/<[^>]+>/g, "").trim();
      const value = ddMatch[1].replace(/<[^>]+>/g, "").trim();

      if (label.includes("商号") || label.includes("名称")) companyName = value;
      if (label.includes("処分年月日") || label.includes("処分日")) actionDate = extractDate(value);
      if (label.includes("処分の内容") || label.includes("処分内容")) actionTypeRaw = value;
    }

    if (companyName && companyName.length >= 2) {
      items.push({
        company_name: companyName.slice(0, 100),
        action_type_raw: actionTypeRaw || "その他",
        action_type: normalizeActionType(actionTypeRaw),
        action_date: actionDate,
        authority: config.prefecture,
        prefecture: config.prefecture,
      });
    }
  }
  return items;
}

/** h3+テキスト型パーサー（千葉県・新潟県等） */
function parseH3Sections(html, config) {
  const items = [];
  // ページ全体から処分情報を抽出
  let companyName = null;
  let actionDate = null;
  let actionTypeRaw = null;

  // h3の見出しとそれに続くテキストをペアで抽出
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>\s*(?:<[^h][^>]*>)*([\s\S]*?)(?=<h[23]|$)/gi;
  let match;
  while ((match = h3Pattern.exec(html)) !== null) {
    const heading = match[1].replace(/<[^>]+>/g, "").trim();
    const content = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if ((heading.includes("商号") || heading.includes("名称")) && content.length >= 2) {
      companyName = content.split(/\s/)[0].slice(0, 100);
    }
    if (heading.includes("処分年月日") || heading.includes("処分日")) {
      actionDate = extractDate(content);
    }
    if (heading.includes("処分の内容") || heading.includes("処分内容") || heading.includes("処分の種類")) {
      actionTypeRaw = content.slice(0, 100);
    }
  }

  // 概要タイトルからも事業者名を取得（千葉県「監督処分の概要（XXX）」パターン）
  if (!companyName) {
    const titleMatch = html.match(/監督処分の概要[（(]([^）)]+)[）)]/);
    if (titleMatch) companyName = titleMatch[1].slice(0, 100);
  }

  if (companyName && companyName.length >= 2) {
    items.push({
      company_name: companyName,
      action_type_raw: actionTypeRaw || "その他",
      action_type: normalizeActionType(actionTypeRaw),
      action_date: actionDate,
      authority: config.prefecture,
      prefecture: config.prefecture,
    });
  }
  return items;
}

/** 日付文字列から YYYY-MM-DD を抽出 */
function extractDate(text) {
  if (!text) return null;
  const western = text.match(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
  if (western) return `${western[1]}-${western[2].padStart(2, "0")}-${western[3].padStart(2, "0")}`;
  const jp = text.match(/(令和|平成)\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)/);
  if (jp) {
    const year = parseInt(jp[2]) + (jp[1] === "令和" ? 2018 : jp[1] === "平成" ? 1988 : 0);
    return `${year}-${jp[3].padStart(2, "0")}-${jp[4].padStart(2, "0")}`;
  }
  return null;
}

/**
 * サブページリンク追従 + テキスト段落パーサーの組み合わせ
 * サブページを取得後、テーブル・テキスト両方のパーサーで解析
 */
async function parseSubpagesWithText(html, config) {
  const baseUrl = new URL(config.url);
  const items = [];

  // 2段階リンク追従: まずインデックスページからサブページを取得
  // パターン1: キーワードマッチ（処分/監督/令和等）
  const linkPattern1 = /<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*(?:処分|syobun|kantoku|監督|令和|平成|概要)[^<]*<\/a>/gi;
  // パターン2: 同一ディレクトリ内のHTMLリンク（事業者名リンク等）
  const currentDir = config.url.substring(0, config.url.lastIndexOf("/") + 1);
  const linkPattern2 = /<a[^>]*href=["']([^"']+\.html?)["'][^>]*>/gi;

  const links = new Set();
  let match;

  while ((match = linkPattern1.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith("/")) href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
    else if (!href.startsWith("http")) href = currentDir + href;
    if (!href.endsWith(".pdf") && href.includes(baseUrl.host) && href !== config.url) links.add(href);
  }

  // パターン2は本文エリア内のリンクのみ（ナビ除外のため、本文内のol/ul/divにあるリンク）
  const mainContent = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<div[^>]*(?:content|main|article)[^>]*>[\s\S]*?<\/div>/i)?.[0] ||
    html;
  while ((match = linkPattern2.exec(mainContent)) !== null) {
    let href = match[1];
    if (href.startsWith("/")) href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
    else if (!href.startsWith("http")) href = currentDir + href;
    // 同一ディレクトリ配下のみ、ナビゲーション除外
    if (!href.endsWith(".pdf") && href.includes(baseUrl.host) && href !== config.url &&
        (href.startsWith(currentDir) || href.includes(baseUrl.pathname.split("/").slice(0, -1).join("/")))) {
      links.add(href);
    }
  }

  const subpageUrls = [...links].slice(0, 10);

  for (const url of subpageUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "RiskMonitor/1.0 (administrative-data-collection)" },
      });
      if (!res.ok) continue;
      const subHtml = await res.text();

      // テーブルパーサーを先に試す
      let subItems = parseGenericTable(subHtml, config);
      // テーブルがなければテキストパーサー
      if (subItems.length === 0) {
        subItems = parseTextSections(subHtml, config);
      }
      items.push(...subItems);
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      // ignore
    }
  }

  return items;
}

/**
 * PDFリンク追従パーサー
 * トップページからPDFリンクを抽出し、PDFをダウンロード・テキスト抽出して処分情報をパース。
 * 岐阜・静岡・富山・奈良・徳島・香川・愛媛等のPDF公開県に対応。
 */
async function parseWithPdf(html, config) {
  const baseUrl = new URL(config.url);
  const items = [];

  // PDFリンクを抽出（処分・syobun・ihanを含むPDFリンク）
  const pdfPattern = /<a[^>]*href=["']([^"']*\.pdf)["'][^>]*>[^<]*(?:処分|違反|一覧|行政|監督|ihan)[^<]*<\/a>/gi;
  const pdfLinks = new Set();
  let match;
  while ((match = pdfPattern.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith("/")) {
      href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
    } else if (!href.startsWith("http")) {
      const dir = config.url.substring(0, config.url.lastIndexOf("/") + 1);
      href = dir + href;
    }
    pdfLinks.add(href);
  }

  // 全PDFリンク検索（上記で見つからない場合のフォールバック）
  if (pdfLinks.size === 0) {
    const allPdfPattern = /<a[^>]*href=["']([^"']*\.pdf)["']/gi;
    while ((match = allPdfPattern.exec(html)) !== null) {
      let href = match[1];
      if (href.startsWith("/")) href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
      else if (!href.startsWith("http")) {
        const dir = config.url.substring(0, config.url.lastIndexOf("/") + 1);
        href = dir + href;
      }
      pdfLinks.add(href);
    }
  }

  // 最大3 PDFまで処理
  const pdfUrls = [...pdfLinks].slice(0, 3);

  for (const url of pdfUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "RiskMonitor/1.0 (administrative-data-collection)" },
      });
      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      let pdfParse;
      try {
        pdfParse = (await import("pdf-parse")).default;
      } catch {
        console.log("[prefecture-scraper] pdf-parse not available, skipping PDF");
        continue;
      }
      const pdf = await pdfParse(Buffer.from(buffer));
      const text = pdf.text || "";

      // PDFテキストから処分情報を抽出
      const pdfItems = extractItemsFromPdfText(text, config);
      items.push(...pdfItems);

      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`[prefecture-scraper] PDF parse error: ${url} - ${e.message}`);
    }
  }

  return items;
}

/**
 * PDFテキストから処分情報を抽出
 * 多くの県のPDFは「処分日 / 事業者名 / 処分内容」が行単位で並ぶ構造
 */
function extractItemsFromPdfText(text, config) {
  const items = [];
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;
  let currentCompany = null;
  let currentAction = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 日付行の検出
    const date = extractDate(line);
    if (date) {
      // 前の項目が完成していれば追加
      if (currentCompany) {
        items.push({
          company_name: currentCompany.slice(0, 100),
          action_type_raw: currentAction || "その他",
          action_type: normalizeActionType(currentAction),
          action_date: currentDate,
          authority: config.prefecture,
          prefecture: config.prefecture,
        });
      }
      currentDate = date;
      currentCompany = null;
      currentAction = null;
      continue;
    }

    // 処分種別の検出
    if (line.includes("取消") || line.includes("停止") || line.includes("指示") || line.includes("免許")) {
      if (!currentAction) currentAction = line;
      continue;
    }

    // 事業者名の検出（株式会社、有限会社等を含む行、またはカタカナ・漢字が主な行）
    if (!currentCompany && line.length >= 2 && line.length <= 60) {
      if (line.match(/[株有限合]式会社|事務所|工業|建設|不動産|商事|工務/) ||
          (line.match(/^[\u3040-\u9FFF\s()（）]+$/) && line.length >= 3)) {
        currentCompany = line.replace(/[\s　]+/g, "");
      }
    }
  }

  // 最後の項目
  if (currentCompany) {
    items.push({
      company_name: currentCompany.slice(0, 100),
      action_type_raw: currentAction || "その他",
      action_type: normalizeActionType(currentAction),
      action_date: currentDate,
      authority: config.prefecture,
      prefecture: config.prefecture,
    });
  }

  return items;
}

function normalizeActionType(raw) {
  if (!raw) return "other";
  if (raw.includes("取消")) return "license_revocation";
  if (raw.includes("停止")) return "business_suspension";
  if (raw.includes("改善")) return "improvement_order";
  if (raw.includes("指示") || raw.includes("警告")) return "warning";
  if (raw.includes("勧告") || raw.includes("指導")) return "guidance";
  return "other";
}

function generateSlug(item, prefKey) {
  const name = (item.company_name || "").replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "").slice(0, 25);
  const date = (item.action_date || "").replace(/-/g, "");
  return `pref-${prefKey}-${name}-${date}`.toLowerCase().slice(0, 80) || `pref-${prefKey}-${Date.now()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── メイン実行関数 ─────────────────────

/**
 * 都道府県スクレイパーを実行
 * @param {{ prefectures?: string[], maxPrefectures?: number, dryRun?: boolean }} options
 */
export async function runPrefectureFetch({ prefectures, maxPrefectures = MAX_PREFECTURES_PER_RUN, dryRun = false } = {}) {
  const startTime = Date.now();
  const log = [];
  const results = [];

  // 対象県の決定
  let targets;
  if (prefectures && prefectures.length > 0) {
    targets = prefectures
      .map((k) => [k, PREFECTURE_PARSERS[k]])
      .filter(([, v]) => v && v.url && v.parse);
  } else {
    targets = Object.entries(PREFECTURE_PARSERS)
      .filter(([, v]) => v.url && v.parse)
      .slice(0, maxPrefectures);
  }

  log.push(`[prefecture-scraper] Start: ${targets.length} prefectures, dryRun=${dryRun}`);

  for (const [key, config] of targets) {
    log.push(`  📍 ${config.prefecture} (${key})...`);
    try {
      const res = await fetch(config.url, {
        headers: { "User-Agent": "RiskMonitor/1.0 (administrative-data-collection)" },
      });
      if (!res.ok) {
        log.push(`    ❌ HTTP ${res.status}`);
        results.push({ key, prefecture: config.prefecture, status: "error", error: `HTTP ${res.status}`, items: 0 });
        continue;
      }

      const html = await res.text();
      const items = await Promise.resolve(config.parse(html, config));
      log.push(`    → ${items.length} items parsed`);

      if (!dryRun && items.length > 0) {
        const dbResult = upsertPrefectureItems(items, key, config);
        log.push(`    → DB: ${dbResult.created} created, ${dbResult.updated} updated, ${dbResult.skipped} skipped`);
        results.push({ key, prefecture: config.prefecture, status: "ok", ...dbResult, items: items.length });
      } else {
        results.push({ key, prefecture: config.prefecture, status: dryRun ? "dry_run" : "no_items", items: items.length });
      }

      await sleep(PAGE_DELAY_MS);
    } catch (e) {
      log.push(`    ❌ ${e.message}`);
      results.push({ key, prefecture: config.prefecture, status: "error", error: e.message, items: 0 });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalItems = results.reduce((s, r) => s + (r.items || 0), 0);
  const totalCreated = results.reduce((s, r) => s + (r.created || 0), 0);
  log.push(`[prefecture-scraper] Done: ${totalItems} items, ${totalCreated} created (${elapsed}s)`);

  // 同期ログ記録
  if (!dryRun) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO sync_runs (source_key, status, stats_json, started_at, finished_at)
        VALUES ('prefecture-scraper', 'completed', ?, datetime('now'), datetime('now'))
      `).run(JSON.stringify({ results, elapsed }));
    } catch { /* ignore */ }
  }

  return { ok: true, results, elapsed, log };
}

function upsertPrefectureItems(items, prefKey, config) {
  const db = getDb();
  let created = 0, updated = 0, skipped = 0;

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions (
      slug, organization_name_raw, action_type, action_date,
      authority_name, authority_level, prefecture, industry,
      summary, source_name, source_url, is_published, review_status
    ) VALUES (
      @slug, @org, @action_type, @action_date,
      @authority, 'prefectural', @prefecture, @industry,
      @summary, @source_name, @source_url, 1, 'approved'
    )
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw=@org, action_type=@action_type,
      action_date=@action_date, summary=@summary,
      updated_at=datetime('now')
  `);

  for (const item of items) {
    const slug = generateSlug(item, prefKey);
    const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
    try {
      upsertStmt.run({
        slug,
        org: item.company_name,
        action_type: item.action_type,
        action_date: item.action_date,
        authority: config.prefecture,
        prefecture: config.prefecture,
        industry: config.industry,
        summary: `${item.action_type_raw || item.action_type}。${config.prefecture}による処分。`,
        source_name: `${config.prefecture} 行政処分情報`,
        source_url: config.url,
      });
      if (existing) updated++; else created++;
    } catch {
      skipped++;
    }
  }

  return { created, updated, skipped };
}
