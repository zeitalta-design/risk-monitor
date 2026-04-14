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
    parse: parseGenericTable,
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
    parse: parseGenericTable,
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
  ibaraki_takken: { prefecture: "茨城県", url: "https://www.pref.ibaraki.jp/doboku/kenshi/kansatsu/kansatsumennkyohp/takkenn/syobunmenu260612syusei.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  tochigi_takken: { prefecture: "栃木県", url: "https://www.pref.tochigi.lg.jp/h11/town/jyuutaku/jyuutaku/1259653272116.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  gunma_takken: { prefecture: "群馬県", url: "https://www.pref.gunma.jp/page/10878.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  chiba_takken: { prefecture: "千葉県", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/takuchi/index.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  niigata_takken: { prefecture: "新潟県", url: "https://www.pref.niigata.lg.jp/sec/jutaku/1303250453579.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  toyama_takken: { prefecture: "富山県", url: "https://www.pref.toyama.jp/1507/kendodukuri/toshikeikaku/keikaku-tochi/kj00003448/kj00003448-010-01.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  fukui_takken: { prefecture: "福井県", url: "https://www.pref.fukui.lg.jp/doc/kenchikujyuutakuka/takkenn/kantokusyobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nagano_takken: { prefecture: "長野県", url: "https://www.pref.nagano.lg.jp/kenchiku/infra/kensetsu/takken/shobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  gifu_takken: { prefecture: "岐阜県", url: "https://www.pref.gifu.lg.jp/page/625.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  shizuoka_takken: { prefecture: "静岡県", url: "https://www.pref.shizuoka.jp/kurashikankyo/kenchiku/takuchitatemono/1015904.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  shiga_takken: { prefecture: "滋賀県", url: "https://www.pref.shiga.lg.jp/ippan/kendoseibi/zyuutaku/19133.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  kyoto_takken: { prefecture: "京都府", url: "https://www.pref.kyoto.jp/kenchiku/1246242651763.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  hyogo_takken: { prefecture: "兵庫県", url: "https://web.pref.hyogo.lg.jp/ks29/wd22_000000013.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nara_takken: { prefecture: "奈良県", url: "https://www.pref.nara.lg.jp/n155/3741.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  wakayama_takken: { prefecture: "和歌山県", url: "https://www.pref.wakayama.lg.jp/prefg/080800/takken/syobun.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  tottori_takken: { prefecture: "鳥取県", url: "https://www.pref.tottori.lg.jp/228167.htm", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  hiroshima_takken: { prefecture: "広島県", url: "https://www.pref.hiroshima.lg.jp/soshiki/107/kantoku0304.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  tokushima_takken: { prefecture: "徳島県", url: "https://www.pref.tokushima.lg.jp/ippannokata/kurashi/kenchiku/2012042600207", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  kagawa_takken: { prefecture: "香川県", url: "https://www.pref.kagawa.lg.jp/jutaku/takken/syobunkijyuntoppage.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  ehime_takken: { prefecture: "愛媛県", url: "https://www.pref.ehime.jp/page/2119.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  kochi_takken: { prefecture: "高知県", url: "https://www.pref.kochi.lg.jp/doc/takken-syobunjyouhou/", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  saga_takken: { prefecture: "佐賀県", url: "https://www.pref.saga.lg.jp/kiji003106819/index.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },
  nagasaki_takken: { prefecture: "長崎県", url: "https://www.pref.nagasaki.lg.jp/doc/page-435819.html", industry: "real_estate", sector: "takken", parse: parseGenericTable },

  // --- 建設業 confirmed 全30県（既存7県 + 新規23県） ---
  hokkaido_kensetsu: { prefecture: "北海道", url: "https://www.pref.hokkaido.lg.jp/kn/ksk/kenjohp/sinsa/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  saitama_kensetsu: { prefecture: "埼玉県", url: "https://www.pref.saitama.lg.jp/a1002/kensetsu/kensetsu-syobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tokyo_kensetsu: { prefecture: "東京都", url: "https://www.toshiseibi.metro.tokyo.lg.jp/kenchiku/kensetsu/k_shobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kanagawa_kensetsu: { prefecture: "神奈川県", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531871/p870152.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  aichi_kensetsu: { prefecture: "愛知県", url: "https://www.pref.aichi.jp/soshiki/kensetsugyou/0000018478.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  osaka_kensetsu: { prefecture: "大阪府", url: "https://www.pref.osaka.lg.jp/o130070/kenshi/shobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  fukuoka_kensetsu: { prefecture: "福岡県", url: "https://www.pref.fukuoka.lg.jp/contents/kensetsushobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  miyagi_kensetsu: { prefecture: "宮城県", url: "https://www.pref.miyagi.jp/soshiki/jigyokanri/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  fukushima_kensetsu: { prefecture: "福島県", url: "https://www.pref.fukushima.lg.jp/sec/41055a/kensetsu-shobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  chiba_kensetsu: { prefecture: "千葉県", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/kensetsu/index.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  niigata_kensetsu: { prefecture: "新潟県", url: "https://www.pref.niigata.lg.jp/sec/kansa/1356891022988.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  nagano_kensetsu: { prefecture: "長野県", url: "https://www.pref.nagano.lg.jp/kenchiku/infra/kensetsu/kensetsu/shobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  gifu_kensetsu: { prefecture: "岐阜県", url: "https://www.pref.gifu.lg.jp/page/624.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  shizuoka_kensetsu: { prefecture: "静岡県", url: "https://www.pref.shizuoka.jp/sangyoshigoto/kensetsu/kengyokyoka/1003263.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  mie_kensetsu: { prefecture: "三重県", url: "https://www.pref.mie.lg.jp/GYOHSEI/000070977.htm", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  shiga_kensetsu: { prefecture: "滋賀県", url: "https://www.pref.shiga.lg.jp/ippan/kendoseibi/kensetsu/19134.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kyoto_kensetsu: { prefecture: "京都府", url: "https://www.pref.kyoto.jp/kensetsushido/1267074218735.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  hyogo_kensetsu: { prefecture: "兵庫県", url: "https://web.pref.hyogo.lg.jp/ks09/wd22_000000032.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  nara_kensetsu: { prefecture: "奈良県", url: "https://www.pref.nara.lg.jp/n155/3742.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tottori_kensetsu: { prefecture: "鳥取県", url: "https://www.pref.tottori.lg.jp/228168.htm", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  okayama_kensetsu: { prefecture: "岡山県", url: "https://www.pref.okayama.jp/page/detail-70301.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  hiroshima_kensetsu: { prefecture: "広島県", url: "https://www.pref.hiroshima.lg.jp/soshiki/99/kantoku.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  tokushima_kensetsu: { prefecture: "徳島県", url: "https://www.pref.tokushima.lg.jp/ippannokata/kendozukuri/kenchiku/2012042600289", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kagawa_kensetsu: { prefecture: "香川県", url: "https://www.pref.kagawa.lg.jp/toshikeikaku/kensetsu/syobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  ehime_kensetsu: { prefecture: "愛媛県", url: "https://www.pref.ehime.jp/page/2120.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kochi_kensetsu: { prefecture: "高知県", url: "https://www.pref.kochi.lg.jp/doc/kensetsu-syobunjyouhou/", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  saga_kensetsu: { prefecture: "佐賀県", url: "https://www.pref.saga.lg.jp/kiji003106820/index.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  oita_kensetsu: { prefecture: "大分県", url: "https://www.pref.oita.jp/soshiki/18500/kensetsusyobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  kagoshima_kensetsu: { prefecture: "鹿児島県", url: "https://www.pref.kagoshima.jp/ah12/infra/kentiku/shidou/kensetsu/syobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
  okinawa_kensetsu: { prefecture: "沖縄県", url: "https://www.pref.okinawa.jp/site/doboku/shido/gyomu/kennsetsusyobun.html", industry: "construction", sector: "kensetsu", parse: parseGenericTable },
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
      const items = config.parse(html, config);
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
