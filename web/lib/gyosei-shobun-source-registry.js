/**
 * 行政処分DB — 情報源台帳
 *
 * 行政処分情報の収集元を台帳管理する。
 * v1 はコードベース管理。将来的に DB 化しやすい構造。
 */

import { REGIONS } from "@/lib/constants";

// ─── 全都道府県リスト ─────────────────────

export const ALL_PREFECTURES = REGIONS.flatMap((r) => r.prefectures);

// ─── 分野定義 ─────────────────────

export const SECTORS = {
  takken: { label: "宅地建物取引業", short: "宅建" },
  kensetsu: { label: "建設業", short: "建設" },
};

// ─── ソース種別ラベル ─────────────────────

export const SOURCE_TYPE_LABELS = {
  aggregated_search: "集約検索",
  official_list: "公式一覧",
  official_detail: "公式詳細",
  pdf_notice: "PDF公表",
  press_release_only: "報道発表のみ",
  manual_review: "手動確認",
};

// ─── カバレッジラベル ─────────────────────

export const COVERAGE_LABELS = {
  full: "全件",
  partial: "一部",
  complementary: "補完",
};

// ─── discoveryStatus ─────────────────────

export const DISCOVERY_STATUS_LABELS = {
  confirmed: { label: "確認済", color: "green" },
  candidate: { label: "候補", color: "blue" },
  manual_review: { label: "要確認", color: "amber" },
};

// ─── expectedCoverage ─────────────────────

export const EXPECTED_COVERAGE_LABELS = {
  mlit_primary: "MLIT主",
  pref_primary: "県主",
  hybrid: "併用",
  unknown: "不明",
};

// ─── MLIT系ソース ─────────────────────

const MLIT_SOURCES = [
  {
    id: "mlit_nega_inf_top",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（トップ）",
    url: "https://www.mlit.go.jp/nega-inf/",
    sourceType: "aggregated_search",
    coverageScope: "full",
    discoveryStatus: "confirmed",
    expectedCoverage: "mlit_primary",
    complements: "建設業・宅建業・運送業等の全分野の入口。5年分。月1回更新。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "CGI形式。自動取得対応済み。",
  },
  {
    id: "mlit_nega_inf_kensetsu",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（建設業者）",
    url: "https://www.mlit.go.jp/nega-inf/cgi-bin/searchmenu.cgi?jigyoubunya=kensetugyousya",
    sourceType: "aggregated_search",
    coverageScope: "full",
    discoveryStatus: "confirmed",
    expectedCoverage: "mlit_primary",
    complements: "建設業の主ソース。全国の建設業監督処分を網羅。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "自動取得対応済み（sector=kensetugyousya）。",
  },
  {
    id: "mlit_nega_inf_takken",
    sector: "takken",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（宅建業者）",
    url: "https://www.mlit.go.jp/nega-inf/cgi-bin/searchmenu.cgi?jigyoubunya=takuti",
    sourceType: "aggregated_search",
    coverageScope: "full",
    discoveryStatus: "confirmed",
    expectedCoverage: "mlit_primary",
    complements: "宅建業の主ソース。全国の宅建業監督処分を網羅。一部自治体は県サイト確認が必要。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "自動取得対応済み（sector=takuti）。",
  },
  {
    id: "mlit_kanto_kensetsu",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "関東地方整備局",
    prefecture: null,
    sourceName: "関東地方整備局 建設業監督処分",
    url: "https://www.ktr.mlit.go.jp/kensan/index00000006.html",
    sourceType: "pdf_notice",
    coverageScope: "complementary",
    discoveryStatus: "confirmed",
    expectedCoverage: "mlit_primary",
    complements: "個別PDF記者発表。MLIT集約の補完。",
    publicationWindow: "unknown",
    updateFrequency: "as_needed",
    acquisitionMethod: "pdf",
    active: true,
    notes: "テーブル一覧なし。PDF個別確認必要。",
  },
];

// ─── 都道府県ソース生成ヘルパー ─────────────────────

function prefSource({ pref, sector, id, name, url, sourceType = "official_list", coverageScope = "partial", discoveryStatus = "candidate", expectedCoverage = "hybrid", complements = "", notes = "" }) {
  return {
    id,
    sector,
    authorityLevel: "prefecture",
    authorityName: pref,
    prefecture: pref,
    sourceName: name,
    url,
    sourceType,
    coverageScope,
    discoveryStatus,
    expectedCoverage,
    complements: complements || `${pref}知事処分分。国交省処分はMLITで補完。`,
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: sourceType === "pdf_notice" ? "pdf" : "html",
    active: true,
    notes,
  };
}

// ─── 都道府県 宅建ソース ─────────────────────

const PREFECTURE_TAKKEN_SOURCES = [
  prefSource({ pref: "北海道", sector: "takken", id: "hokkaido_takken", name: "北海道 宅建業者監督処分", url: "https://www.pref.hokkaido.lg.jp/kn/ksd/fudousan/syobun.html", discoveryStatus: "confirmed", notes: "処分日から5年間掲載。" }),
  prefSource({ pref: "青森県", sector: "takken", id: "aomori_takken", name: "青森県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。MLIT補完。" }),
  prefSource({ pref: "岩手県", sector: "takken", id: "iwate_takken", name: "岩手県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。MLIT補完。" }),
  prefSource({ pref: "宮城県", sector: "takken", id: "miyagi_takken", name: "宮城県 宅建業者監督処分", url: "https://www.pref.miyagi.jp/soshiki/kentaku/takken-syobun.html", discoveryStatus: "confirmed", notes: "事業者名クリックで詳細。5年間掲載。" }),
  prefSource({ pref: "秋田県", sector: "takken", id: "akita_takken", name: "秋田県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。MLIT補完。" }),
  prefSource({ pref: "山形県", sector: "takken", id: "yamagata_takken", name: "山形県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。MLIT補完。" }),
  prefSource({ pref: "福島県", sector: "takken", id: "fukushima_takken", name: "福島県 宅建業者監督処分", url: "https://www.pref.fukushima.lg.jp/sec/41065b/takken-top.html", discoveryStatus: "confirmed", notes: "監督処分公表あり（5年間）。処分基準・窓口一覧も掲載。" }),
  prefSource({ pref: "茨城県", sector: "takken", id: "ibaraki_takken", name: "茨城県 宅建業者監督処分", url: "https://www.pref.ibaraki.jp/doboku/kenshi/kansatsu/kansatsumennkyohp/takkenn/syobunmenu260612syusei.html", discoveryStatus: "confirmed", notes: "過去5年間の監督処分一覧。指示・業務停止・免許取消。" }),
  prefSource({ pref: "栃木県", sector: "takken", id: "tochigi_takken", name: "栃木県 宅建業者監督処分", url: "https://www.pref.tochigi.lg.jp/h11/town/jyuutaku/jyuutaku/1259653272116.html", discoveryStatus: "confirmed", notes: "処分基準+処分一覧（5年間掲載）。PDF詳細リンクあり。" }),
  prefSource({ pref: "群馬県", sector: "takken", id: "gunma_takken", name: "群馬県 宅建業者監督処分", url: "https://www.pref.gunma.jp/page/10878.html", discoveryStatus: "confirmed", notes: "処分一覧（R3-R8）。指示・業務停止・免許取消。5年間公開。" }),
  prefSource({ pref: "埼玉県", sector: "takken", id: "saitama_takken", name: "埼玉県 宅建業者監督処分結果一覧", url: "https://www.pref.saitama.lg.jp/a1106/takkensoudan-main/kantokusyobun-kekkaitiranhyou.html", discoveryStatus: "confirmed", notes: "処分日から5年間掲載。一覧形式。" }),
  prefSource({ pref: "千葉県", sector: "takken", id: "chiba_takken", name: "千葉県 宅建業者監督処分", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/takuchi/index.html", discoveryStatus: "confirmed", notes: "指示・業務停止・免許取消。5年間公開。" }),
  prefSource({ pref: "東京都", sector: "takken", id: "tokyo_takken", name: "東京都 宅建業者監督処分", url: "https://www.juutakuseisaku.metro.tokyo.lg.jp/fudosan/takken/gs-syobun", discoveryStatus: "confirmed", notes: "都知事処分の基準・結果。" }),
  prefSource({ pref: "神奈川県", sector: "takken", id: "kanagawa_takken", name: "神奈川県 宅建業者行政処分", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531871/p870145.html", discoveryStatus: "confirmed", notes: "年度別公表。5年間掲載。国・他県処分はMLIT参照の案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "新潟県", sector: "takken", id: "niigata_takken", name: "新潟県 宅建業者監督処分一覧", url: "https://www.pref.niigata.lg.jp/sec/jutaku/1303250453579.html", discoveryStatus: "confirmed", notes: "監督処分一覧ページ。R3-R7の処分事例をリンク掲載。建築住宅課管理。" }),
  prefSource({ pref: "富山県", sector: "takken", id: "toyama_takken", name: "富山県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第4バッチ確認。検索で処分公表ページ未発見。MLIT補完。" }),
  prefSource({ pref: "石川県", sector: "takken", id: "ishikawa_takken", name: "石川県 宅建業者行政処分（基準）", url: "https://www.pref.ishikawa.lg.jp/kenju/shobunkizyun.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準PDFのみ。処分事例なし。県独自の継続的公表ページなし。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "福井県", sector: "takken", id: "fukui_takken", name: "福井県 宅建業者監督処分", url: "https://www.pref.fukui.lg.jp/doc/kenchikujyuutakuka/takkenn/kantokusyobun.html", discoveryStatus: "confirmed", notes: "処分基準+処分事例公表（R5年6月以降）。免許取消等の具体例あり。" }),
  prefSource({ pref: "山梨県", sector: "takken", id: "yamanashi_takken", name: "山梨県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "長野県", sector: "takken", id: "nagano_takken", name: "長野県 宅建業者監督処分", url: "https://www.pref.nagano.lg.jp/kenchiku/infra/kensetsu/takken/shobun.html", discoveryStatus: "confirmed", notes: "監督処分情報を公開。" }),
  prefSource({ pref: "岐阜県", sector: "takken", id: "gifu_takken", name: "岐阜県 宅建業者監督処分", url: "https://www.pref.gifu.lg.jp/page/625.html", discoveryStatus: "manual_review", notes: "第4バッチ確認。宅建業法ポータル。処分一覧の独自Web公表は未確認。建設は confirmed。" }),
  prefSource({ pref: "静岡県", sector: "takken", id: "shizuoka_takken", name: "静岡県 宅建業者監督処分", url: "https://www.pref.shizuoka.jp/kurashikankyo/kenchiku/takuchitatemono/1015904.html", discoveryStatus: "confirmed", notes: "HPで公表。MLITサイトも参照案内あり。" }),
  prefSource({ pref: "愛知県", sector: "takken", id: "aichi_takken", name: "愛知県 宅建業者監督処分", url: "https://www.pref.aichi.jp/soshiki/toshi-somu/takken-kantoku.html", discoveryStatus: "confirmed", notes: "5年間掲載。R5以降はMLITネガティブ情報にも掲載。" }),
  prefSource({ pref: "三重県", sector: "takken", id: "mie_takken", name: "三重県 宅建業者監督処分（基準）", url: "https://www.pref.mie.lg.jp/GYOHSEI/000070979.htm", discoveryStatus: "manual_review", notes: "第4バッチ確認。処分基準PDFのみ。処分一覧ページなし。MLITで補完。建設は confirmed。" }),
  prefSource({ pref: "滋賀県", sector: "takken", id: "shiga_takken", name: "滋賀県 宅建業者行政処分", url: "https://www.pref.shiga.lg.jp/ippan/kendoseibi/zyuutaku/19133.html", discoveryStatus: "confirmed", notes: "処分実施年度の翌年度から5年間公開。" }),
  prefSource({ pref: "京都府", sector: "takken", id: "kyoto_takken", name: "京都府 宅建業者監督処分", url: "https://www.pref.kyoto.jp/kenchiku/1246242651763.html", discoveryStatus: "confirmed", notes: "5年間掲載。MLITネガティブ情報へのリンクあり。" }),
  prefSource({ pref: "大阪府", sector: "takken", id: "osaka_takken", name: "大阪府 宅建業者行政処分", url: "https://www.pref.osaka.lg.jp/o130200/kenshin/kantoku/index.html", discoveryStatus: "confirmed", notes: "免許取消・業務停止・指示。5年間公開。" }),
  prefSource({ pref: "兵庫県", sector: "takken", id: "hyogo_takken", name: "兵庫県 宅建業者監督処分", url: "https://web.pref.hyogo.lg.jp/ks29/wd22_000000013.html", discoveryStatus: "confirmed", notes: "年度別PDF公開。報道発表もあり。" }),
  prefSource({ pref: "奈良県", sector: "takken", id: "nara_takken", name: "奈良県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第4バッチ確認。旧ドメインリダイレクト。新ドメインで処分公表ページ未特定。建設は confirmed。" }),
  prefSource({ pref: "和歌山県", sector: "takken", id: "wakayama_takken", name: "和歌山県 宅建業者行政処分一覧", url: "https://www.pref.wakayama.lg.jp/prefg/080800/takken/syobun.html", discoveryStatus: "confirmed", notes: "行政処分一覧。5年分掲載。免許取消・業務停止・指示。処分日・商号・理由あり。" }),
  prefSource({ pref: "鳥取県", sector: "takken", id: "tottori_takken", name: "鳥取県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "島根県", sector: "takken", id: "shimane_takken", name: "島根県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第5バッチ確認。検索で処分公表ページ未発見。" }),
  prefSource({ pref: "岡山県", sector: "takken", id: "okayama_takken", name: "岡山県 宅建業者監督処分（案内）", url: "https://www.pref.okayama.jp/page/detail-70300.html", discoveryStatus: "candidate", notes: "最終確認済。県独自のWeb公表一覧なし。処分公表はMLIT検索サイト（takuti）と県庁窓口閲覧のみ。confirmed不可：県サイト上に処分実績の掲載がない。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "広島県", sector: "takken", id: "hiroshima_takken", name: "広島県 宅建業者監督処分", url: "https://www.pref.hiroshima.lg.jp/soshiki/107/kantoku0304.html", discoveryStatus: "confirmed", notes: "違反行為に対する監督処分情報。" }),
  prefSource({ pref: "山口県", sector: "takken", id: "yamaguchi_takken", name: "山口県 宅建業者監督処分（基準）", url: "https://www.pref.yamaguchi.lg.jp/soshiki/135/24299.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準PDFのみ。処分事例の掲載なし。MLIT誘導。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "徳島県", sector: "takken", id: "tokushima_takken", name: "徳島県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "香川県", sector: "takken", id: "kagawa_takken", name: "香川県 宅建業者監督処分公表", url: "https://www.pref.kagawa.lg.jp/jutaku/takken/syobunkijyuntoppage.html", discoveryStatus: "confirmed", notes: "処分業者7社掲載。処分日・商号・処分内容・理由。PDF詳細付き。5年間公表。" }),
  prefSource({ pref: "愛媛県", sector: "takken", id: "ehime_takken", name: "愛媛県 宅建業者監督処分（基準）", url: "https://www.pref.ehime.jp/page/2119.html", discoveryStatus: "manual_review", notes: "第5バッチ確認。処分基準ページ。処分一覧の独自Web公表は未確認。" }),
  prefSource({ pref: "高知県", sector: "takken", id: "kochi_takken", name: "高知県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "福岡県", sector: "takken", id: "fukuoka_takken", name: "福岡県 宅建業者監督処分", url: "https://www.pref.fukuoka.lg.jp/contents/takkensyobun.html", discoveryStatus: "confirmed", notes: "知事処分の一覧。" }),
  prefSource({ pref: "佐賀県", sector: "takken", id: "saga_takken", name: "佐賀県 宅建業者監督処分一覧", url: "https://www.pref.saga.lg.jp/kiji003106819/index.html", discoveryStatus: "confirmed", notes: "年度別処分一覧（R6年度）。免許取消等の具体例あり。PDF詳細付き。" }),
  prefSource({ pref: "長崎県", sector: "takken", id: "nagasaki_takken", name: "長崎県 宅建業者監督処分", url: null, discoveryStatus: "candidate", notes: "公表ページの存在は確認（H22以降/5年間）だが現URL404。再確認要。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "熊本県", sector: "takken", id: "kumamoto_takken", name: "熊本県 宅建業者監督処分（基準）", url: "https://www.pref.kumamoto.jp/soshiki/115/4319.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準のみ。処分事例なし。MLIT誘導あり。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "大分県", sector: "takken", id: "oita_takken", name: "大分県 宅建業者監督処分（基準）", url: "https://www.pref.oita.jp/soshiki/18500/kantokusyobun.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準PDFのみ。処分事例なし。MLIT誘導中心。県独自の継続的公表ページなし。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "宮崎県", sector: "takken", id: "miyazaki_takken", name: "宮崎県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "鹿児島県", sector: "takken", id: "kagoshima_takken", name: "鹿児島県 宅建業者監督処分（案内）", url: "http://www.pref.kagoshima.jp/ah12/infra/kentiku/shidou/torihiki/sonota/takkengyoushashobunjouhou.html", discoveryStatus: "candidate", notes: "最終確認済。案内ページのみ。具体的処分事例の掲載なし。全リンクがMLIT検索サイト誘導。県独自Web一覧なし。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "沖縄県", sector: "takken", id: "okinawa_takken", name: "沖縄県 宅建業者監督処分（基準）", url: "https://www.pref.okinawa.jp/site/doboku/shido/gyomu/kanntokushobunnkijyunn.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準PDFのみ。処分事例なし。MLIT誘導あり。confirmed不可。", expectedCoverage: "mlit_primary" }),
];

// ─── 都道府県 建設ソース ─────────────────────

const PREFECTURE_KENSETSU_SOURCES = [
  prefSource({ pref: "北海道", sector: "kensetsu", id: "hokkaido_kensetsu", name: "北海道 建設業者監督処分", url: "https://www.pref.hokkaido.lg.jp/kn/ksk/kenjohp/sinsa/kantoku.html", discoveryStatus: "confirmed", notes: "建設業を営む者に対する監督処分。" }),
  prefSource({ pref: "青森県", sector: "kensetsu", id: "aomori_kensetsu", name: "青森県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。MLIT補完。" }),
  prefSource({ pref: "岩手県", sector: "kensetsu", id: "iwate_kensetsu", name: "岩手県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "宮城県", sector: "kensetsu", id: "miyagi_kensetsu", name: "宮城県 建設業者監督処分", url: "https://www.pref.miyagi.jp/soshiki/jigyokanri/syobun.html", discoveryStatus: "confirmed", notes: "年度別個別処分ページあり。" }),
  prefSource({ pref: "秋田県", sector: "kensetsu", id: "akita_kensetsu", name: "秋田県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "山形県", sector: "kensetsu", id: "yamagata_kensetsu", name: "山形県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "福島県", sector: "kensetsu", id: "fukushima_kensetsu", name: "福島県 建設業者監督処分", url: "https://www.pref.fukushima.lg.jp/sec/41025c/kyokasyobun.html", discoveryStatus: "confirmed", notes: "許可取消・営業停止・指示の一覧。5年間公表。" }),
  prefSource({ pref: "茨城県", sector: "kensetsu", id: "ibaraki_kensetsu", name: "茨城県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第4バッチ確認。建設業処分一覧の県独自Web公表ページ未発見。宅建は confirmed。" }),
  prefSource({ pref: "栃木県", sector: "kensetsu", id: "tochigi_kensetsu", name: "栃木県 建設業者監督処分（基準）", url: "https://www.pref.tochigi.lg.jp/h01/work/kensetsugyou/kyoka/kensetugyou_syobun.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準ページのみ（R5年5月施行）。処分簿・一覧はWeb未掲載。MLIT誘導。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "群馬県", sector: "kensetsu", id: "gunma_kensetsu", name: "群馬県 建設業者監督処分（基準）", url: "https://www.pref.gunma.jp/page/10901.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準ページのみ。建設分野の処分一覧・処分簿はWeb未掲載。MLIT誘導。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "埼玉県", sector: "kensetsu", id: "saitama_kensetsu", name: "埼玉県 建設業者指導監督", url: "https://www.pref.saitama.lg.jp/a1002/kantoku.html", discoveryStatus: "confirmed", notes: "建設業者等の指導監督ページ。" }),
  prefSource({ pref: "千葉県", sector: "kensetsu", id: "chiba_kensetsu", name: "千葉県 建設業者監督処分", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/kensetu/index.html", discoveryStatus: "confirmed", notes: "年度別一覧。県ページに載せていない処分はMLITに掲載との案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "東京都", sector: "kensetsu", id: "tokyo_kensetsu", name: "東京都 建設業者監督処分", url: "https://www.toshiseibi.metro.tokyo.lg.jp/kenchiku_kaihatsu/kenchiku_shidou/gyosya_shido/kensetsu/kensetsu04", discoveryStatus: "confirmed", notes: "不正行為等に対する監督処分基準。" }),
  prefSource({ pref: "神奈川県", sector: "kensetsu", id: "kanagawa_kensetsu", name: "神奈川県 建設業者監督処分", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531856/p870268.html", discoveryStatus: "confirmed", notes: "指示・停止・取消の3種。5年間台帳。" }),
  prefSource({ pref: "新潟県", sector: "kensetsu", id: "niigata_kensetsu", name: "新潟県 建設業者監督処分", url: "https://www.pref.niigata.lg.jp/sec/dobokukanri/1191256251816.html", discoveryStatus: "confirmed", notes: "建設業者への監督処分情報。" }),
  prefSource({ pref: "富山県", sector: "kensetsu", id: "toyama_kensetsu", name: "富山県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第4バッチ確認。検索で処分公表ページ未発見。MLIT補完。" }),
  prefSource({ pref: "石川県", sector: "kensetsu", id: "ishikawa_kensetsu", name: "石川県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "福井県", sector: "kensetsu", id: "fukui_kensetsu", name: "福井県 建設業者監督処分（基準）", url: "https://www.pref.fukui.lg.jp/doc/kanri/kantokusyobun.html", discoveryStatus: "manual_review", notes: "処分基準ページ。処分一覧の独自Web公表は未確認。" }),
  prefSource({ pref: "山梨県", sector: "kensetsu", id: "yamanashi_kensetsu", name: "山梨県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "長野県", sector: "kensetsu", id: "nagano_kensetsu", name: "長野県 建設業者監督処分", url: "https://www.pref.nagano.lg.jp/kensetsu/infra/kensetsu/kyoka/shobun.html", discoveryStatus: "confirmed", notes: "知事が過去5年間に行った処分を公表。" }),
  prefSource({ pref: "岐阜県", sector: "kensetsu", id: "gifu_kensetsu", name: "岐阜県 建設業法に基づく監督処分", url: "https://www.pref.gifu.lg.jp/page/24156.html", discoveryStatus: "confirmed", notes: "処分一覧あり（R3-R7、20件以上）。処分簿5年公開。PDF詳細付き。" }),
  prefSource({ pref: "静岡県", sector: "kensetsu", id: "shizuoka_kensetsu", name: "静岡県 建設業者監督処分", url: "https://www.pref.shizuoka.jp/machizukuri/kokyokoji/kensetsu/1003479/1028885.html", discoveryStatus: "confirmed", notes: "R4以降の処分情報。概要ページもあり。" }),
  prefSource({ pref: "愛知県", sector: "kensetsu", id: "aichi_kensetsu", name: "愛知県 建設業者監督処分", url: "https://www.pref.aichi.jp/soshiki/toshi-somu/kantoku.html", discoveryStatus: "confirmed", notes: "処分基準とMLITネガティブ情報へのリンクあり。" }),
  prefSource({ pref: "三重県", sector: "kensetsu", id: "mie_kensetsu", name: "三重県 建設業者監督処分", url: "https://www.pref.mie.lg.jp/common/06/ci500003707.htm", discoveryStatus: "confirmed", notes: "建設業法親ページから監督処分（営業停止・許可取消・指示）を時系列で公表。継続更新あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "滋賀県", sector: "kensetsu", id: "shiga_kensetsu", name: "滋賀県 建設業者監督処分", url: "https://www.pref.shiga.lg.jp/ippan/shigotosangyou/kensetsu/300353.html", discoveryStatus: "confirmed", notes: "建設業者等に対する監督処分。" }),
  prefSource({ pref: "京都府", sector: "kensetsu", id: "kyoto_kensetsu", name: "京都府 建設業者監督処分", url: "https://www.pref.kyoto.jp/kensetugyo/kensetugyoukyoka/kantokuzyobun.html", discoveryStatus: "confirmed", notes: "MLITネガティブ情報へのリンクあり。" }),
  prefSource({ pref: "大阪府", sector: "kensetsu", id: "osaka_kensetsu", name: "大阪府 建設業処分業者一覧", url: "https://www.pref.osaka.lg.jp/o130200/kenshin/syobunitiran-top/index.html", discoveryStatus: "confirmed", notes: "知事処分の一覧。5年間表示。" }),
  prefSource({ pref: "兵庫県", sector: "kensetsu", id: "hyogo_kensetsu", name: "兵庫県 建設業法に基づく監督処分", url: "https://web.pref.hyogo.lg.jp/ks02/wd02_000000006.html", discoveryStatus: "confirmed", notes: "建設業法に基づく監督処分情報。" }),
  prefSource({ pref: "奈良県", sector: "kensetsu", id: "nara_kensetsu", name: "奈良県 建設業者監督処分", url: "https://www.pref.nara.lg.jp/n133/12115.html", discoveryStatus: "confirmed", notes: "処分一覧あり（R4-R8）。営業停止・許可取消・指示処分をPDF公開。R7年12月改正基準あり。" }),
  prefSource({ pref: "和歌山県", sector: "kensetsu", id: "wakayama_kensetsu", name: "和歌山県 建設業者監督処分（基準）", url: "https://www.pref.wakayama.lg.jp/prefg/081100/kghsyobun/index.html", discoveryStatus: "manual_review", notes: "処分基準ページ。処分一覧の独自Web公表は未確認。" }),
  prefSource({ pref: "鳥取県", sector: "kensetsu", id: "tottori_kensetsu", name: "鳥取県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "島根県", sector: "kensetsu", id: "shimane_kensetsu", name: "島根県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "岡山県", sector: "kensetsu", id: "okayama_kensetsu", name: "岡山県 建設業監督処分一覧", url: "https://www.pref.okayama.jp/page/detail-46609.html", discoveryStatus: "confirmed", notes: "処分一覧+処分簿PDF。過去5年分。監督処分基準も掲載。" }),
  prefSource({ pref: "広島県", sector: "kensetsu", id: "hiroshima_kensetsu", name: "広島県 建設業法に基づく監督処分", url: "https://www.pref.hiroshima.lg.jp/soshiki/93/1206083718262.html", discoveryStatus: "confirmed", notes: "MLITネガティブ情報にも掲載との案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "山口県", sector: "kensetsu", id: "yamaguchi_kensetsu", name: "山口県 建設業者監督処分（基準）", url: "https://www.pref.yamaguchi.lg.jp/site/kensetsugyo/23463.html", discoveryStatus: "candidate", notes: "最終確認済。処分基準PDF（R7年12月改正）のみ。処分一覧はMLIT誘導。県独自一覧なし。confirmed不可。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "徳島県", sector: "kensetsu", id: "tokushima_kensetsu", name: "徳島県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "香川県", sector: "kensetsu", id: "kagawa_kensetsu", name: "香川県 建設業者監督処分情報", url: "https://www.pref.kagawa.lg.jp/dobokukanri/nyusatu/koji/kantokusyobun.html", discoveryStatus: "confirmed", notes: "処分一覧。処分日・業者名・処分内容（許可取消・営業停止）。PDF詳細付き。" }),
  prefSource({ pref: "愛媛県", sector: "kensetsu", id: "ehime_kensetsu", name: "愛媛県 建設業者監督処分", url: "https://www.pref.ehime.jp/page/129828.html", discoveryStatus: "candidate", notes: "個別処分公表あり（R6年12月事案）。ただし一覧ページではなく個別公表形式。confirmed不可。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "高知県", sector: "kensetsu", id: "kochi_kensetsu", name: "高知県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "福岡県", sector: "kensetsu", id: "fukuoka_kensetsu", name: "福岡県 建設業者監督処分", url: "https://www.pref.fukuoka.lg.jp/contents/kennsetukanntokushobunn.html", discoveryStatus: "confirmed", notes: "処分台帳は県庁窓口で閲覧可。停止・取消は官報掲載。", sourceType: "press_release_only" }),
  prefSource({ pref: "佐賀県", sector: "kensetsu", id: "saga_kensetsu", name: "佐賀県 建設業者監督処分一覧", url: "https://www.pref.saga.lg.jp/kiji003112004/index.html", discoveryStatus: "confirmed", notes: "年度別処分一覧（R2-R6の複数年度）。指示・営業停止・許可取消。PDF詳細付き。" }),
  prefSource({ pref: "長崎県", sector: "kensetsu", id: "nagasaki_kensetsu", name: "長崎県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "第5バッチ確認。個別press releaseはあるが一覧ページ未確認。" }),
  prefSource({ pref: "熊本県", sector: "kensetsu", id: "kumamoto_kensetsu", name: "熊本県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "大分県", sector: "kensetsu", id: "oita_kensetsu", name: "大分県 建設業者監督処分", url: "https://www.pref.oita.jp/site/n-kennsetsugyou/n-kantokushobunntokushobun.html", discoveryStatus: "confirmed", notes: "処分一覧PDF（随時追加更新）。建設業指導班。" }),
  prefSource({ pref: "宮崎県", sector: "kensetsu", id: "miyazaki_kensetsu", name: "宮崎県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "県ページ未確認。" }),
  prefSource({ pref: "鹿児島県", sector: "kensetsu", id: "kagoshima_kensetsu", name: "鹿児島県 建設業者監督処分", url: "http://www.pref.kagoshima.jp/ah01/infra/tochi-kensetu/kensetu/sidoukantoku.html", discoveryStatus: "confirmed", notes: "処分一覧PDF（R5-R7の3年度分）。基準・ホットライン情報もあり。" }),
  prefSource({ pref: "沖縄県", sector: "kensetsu", id: "okinawa_kensetsu", name: "沖縄県 建設業者監督処分", url: "https://www.pref.okinawa.jp/machizukuri/kenchiku/1023167/1013358/1028170.html", discoveryStatus: "confirmed", notes: "処分基準+処分一覧PDF（R4年度）。5年間公表。MLIT誘導もあり。", expectedCoverage: "hybrid" }),
];

// ─── 統合台帳 ─────────────────────

export const SOURCE_REGISTRY = [
  ...MLIT_SOURCES,
  ...PREFECTURE_TAKKEN_SOURCES,
  ...PREFECTURE_KENSETSU_SOURCES,
];

// ─── ヘルパー ─────────────────────

export function getSourcesBySector(sector) {
  return SOURCE_REGISTRY.filter((s) => s.sector === sector);
}

export function getActiveSources() {
  return SOURCE_REGISTRY.filter((s) => s.active);
}

export function getRegisteredPrefectures(sector) {
  return [
    ...new Set(
      SOURCE_REGISTRY.filter((s) => s.sector === sector && s.prefecture)
        .map((s) => s.prefecture)
    ),
  ];
}

export function getMissingPrefectures(sector) {
  const registered = getRegisteredPrefectures(sector);
  return ALL_PREFECTURES.filter((p) => !registered.includes(p));
}

export function getDiscoveryStatusCounts() {
  const counts = { confirmed: 0, candidate: 0, manual_review: 0 };
  SOURCE_REGISTRY.forEach((s) => {
    if (s.discoveryStatus && counts[s.discoveryStatus] !== undefined) {
      counts[s.discoveryStatus]++;
    }
  });
  return counts;
}

export function getCoverageMatrix() {
  return ALL_PREFECTURES.map((pref) => {
    const result = { prefecture: pref };
    for (const sector of Object.keys(SECTORS)) {
      const directSources = SOURCE_REGISTRY.filter(
        (s) => s.sector === sector && s.prefecture === pref && s.active
      );
      const confirmed = directSources.some((s) => s.discoveryStatus === "confirmed");
      const candidate = directSources.some((s) => s.discoveryStatus === "candidate");
      const manualReview = directSources.some((s) => s.discoveryStatus === "manual_review");
      const nationalFull = SOURCE_REGISTRY.some(
        (s) => s.sector === sector && s.authorityLevel === "national" && s.coverageScope === "full" && s.active
      );

      if (confirmed) {
        result[sector] = "confirmed";
      } else if (candidate) {
        result[sector] = "candidate";
      } else if (manualReview && nationalFull) {
        result[sector] = "complemented";
      } else if (manualReview) {
        result[sector] = "manual_review";
      } else if (nationalFull) {
        result[sector] = "complemented";
      } else {
        result[sector] = "missing";
      }
    }
    return result;
  });
}
