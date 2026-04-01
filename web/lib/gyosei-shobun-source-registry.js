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
  architect_office: { label: "建築士事務所", short: "建築士" },
  sanpai: { label: "産業廃棄物処理業", short: "産廃" },
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
  prefSource({ pref: "青森県", sector: "takken", id: "aomori_takken", name: "青森県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "固定manual_review。複数バッチ確認済みで県独自の処分公表ページ・個別公表なし。処分基準PDFのみ。MLIT補完前提で固定運用。" }),
  prefSource({ pref: "岩手県", sector: "takken", id: "iwate_takken", name: "岩手県 宅建業者監督処分情報", url: "https://www.pref.iwate.jp/kurashikankyou/kenchiku/tetsuzuki/takuchi/1010436.html", discoveryStatus: "candidate", notes: "重点再調査済み。公表枠組みあり（H22以降、5年間掲載制度）だが事例掲載なし。別階層・press releaseも未発見。処分基準ページから当該URLへのリンクあり継続導線だが、実績公表がないため固定候補寄りのcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "宮城県", sector: "takken", id: "miyagi_takken", name: "宮城県 宅建業者監督処分", url: "https://www.pref.miyagi.jp/soshiki/kentaku/takken-syobun.html", discoveryStatus: "confirmed", notes: "事業者名クリックで詳細。5年間掲載。" }),
  prefSource({ pref: "秋田県", sector: "takken", id: "akita_takken", name: "秋田県 宅建業者監督処分", url: null, discoveryStatus: "manual_review", notes: "将来再確認manual_review。処分基準ページ(archive/4592)はあるが一覧・閲覧案内なし。建設はcandidateのため、将来の県公式公表拡充時に再確認余地あり。" }),
  prefSource({ pref: "山形県", sector: "takken", id: "yamagata_takken", name: "山形県 宅建業者監督処分", url: "https://www.pref.yamagata.jp/180025/kurashi/sumai/kenchiku/takken.html", discoveryStatus: "manual_review", notes: "将来再確認manual_review。宅建業ポータルに処分基準PDF+MLIT誘導あるが専用処分ページなし。建設はcandidateのため、将来の県公式公表拡充時に再確認余地あり。" }),
  prefSource({ pref: "福島県", sector: "takken", id: "fukushima_takken", name: "福島県 宅建業者監督処分", url: "https://www.pref.fukushima.lg.jp/sec/41065b/takken-top.html", discoveryStatus: "confirmed", notes: "監督処分公表あり（5年間）。処分基準・窓口一覧も掲載。" }),
  prefSource({ pref: "茨城県", sector: "takken", id: "ibaraki_takken", name: "茨城県 宅建業者監督処分", url: "https://www.pref.ibaraki.jp/doboku/kenshi/kansatsu/kansatsumennkyohp/takkenn/syobunmenu260612syusei.html", discoveryStatus: "confirmed", notes: "過去5年間の監督処分一覧。指示・業務停止・免許取消。" }),
  prefSource({ pref: "栃木県", sector: "takken", id: "tochigi_takken", name: "栃木県 宅建業者監督処分", url: "https://www.pref.tochigi.lg.jp/h11/town/jyuutaku/jyuutaku/1259653272116.html", discoveryStatus: "confirmed", notes: "処分基準+処分一覧（5年間掲載）。PDF詳細リンクあり。" }),
  prefSource({ pref: "群馬県", sector: "takken", id: "gunma_takken", name: "群馬県 宅建業者監督処分", url: "https://www.pref.gunma.jp/page/10878.html", discoveryStatus: "confirmed", notes: "処分一覧（R3-R8）。指示・業務停止・免許取消。5年間公開。" }),
  prefSource({ pref: "埼玉県", sector: "takken", id: "saitama_takken", name: "埼玉県 宅建業者監督処分結果一覧", url: "https://www.pref.saitama.lg.jp/a1106/takkensoudan-main/kantokusyobun-kekkaitiranhyou.html", discoveryStatus: "confirmed", notes: "処分日から5年間掲載。一覧形式。" }),
  prefSource({ pref: "千葉県", sector: "takken", id: "chiba_takken", name: "千葉県 宅建業者監督処分", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/takuchi/index.html", discoveryStatus: "confirmed", notes: "指示・業務停止・免許取消。5年間公開。" }),
  prefSource({ pref: "東京都", sector: "takken", id: "tokyo_takken", name: "東京都 宅建業者監督処分", url: "https://www.juutakuseisaku.metro.tokyo.lg.jp/fudosan/takken/gs-syobun", discoveryStatus: "confirmed", notes: "都知事処分の基準・結果。" }),
  prefSource({ pref: "神奈川県", sector: "takken", id: "kanagawa_takken", name: "神奈川県 宅建業者行政処分", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531871/p870145.html", discoveryStatus: "confirmed", notes: "年度別公表。5年間掲載。国・他県処分はMLIT参照の案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "新潟県", sector: "takken", id: "niigata_takken", name: "新潟県 宅建業者監督処分一覧", url: "https://www.pref.niigata.lg.jp/sec/jutaku/1303250453579.html", discoveryStatus: "confirmed", notes: "監督処分一覧ページ。R3-R7の処分事例をリンク掲載。建築住宅課管理。" }),
  prefSource({ pref: "富山県", sector: "takken", id: "toyama_takken", name: "富山県 宅建業者監督処分", url: "https://www.pref.toyama.jp/1507/kendodukuri/toshikeikaku/keikaku-tochi/kj00003448/kj00003448-010-01.html", discoveryStatus: "confirmed", notes: "第12バッチ再確認でconfirmed昇格。PDF処分一覧（R3-R5、2件）確認。免許取消・指示。5年間公表。ドメインがpref.toyama.jp(.lgなし)のため以前未発見。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "石川県", sector: "takken", id: "ishikawa_takken", name: "石川県 宅建業者行政処分（基準）", url: "https://www.pref.ishikawa.lg.jp/kenju/shobunkizyun.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準PDFのみ。県独自の継続的公表ページなし。MLIT補完前提の固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "福井県", sector: "takken", id: "fukui_takken", name: "福井県 宅建業者監督処分", url: "https://www.pref.fukui.lg.jp/doc/kenchikujyuutakuka/takkenn/kantokusyobun.html", discoveryStatus: "confirmed", notes: "処分基準+処分事例公表（R5年6月以降）。免許取消等の具体例あり。" }),
  prefSource({ pref: "山梨県", sector: "takken", id: "yamanashi_takken", name: "山梨県 宅建業者監督処分", url: "https://www.pref.yamanashi.jp/kenchikujutaku/takkengyou/kantokushobun.html", discoveryStatus: "candidate", notes: "再確認候補寄り。重点再調査でも専用ページ+基準PDFのみで処分実績一覧なし。MLIT独自公表県リストとの矛盾あり別URLの可能性を排除できず再確認候補継続。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "長野県", sector: "takken", id: "nagano_takken", name: "長野県 宅建業者監督処分", url: "https://www.pref.nagano.lg.jp/kenchiku/infra/kensetsu/takken/shobun.html", discoveryStatus: "confirmed", notes: "監督処分情報を公開。" }),
  prefSource({ pref: "岐阜県", sector: "takken", id: "gifu_takken", name: "岐阜県 宅建業者監督処分", url: "https://www.pref.gifu.lg.jp/page/625.html", discoveryStatus: "confirmed", notes: "第10バッチ再確認でconfirmed昇格。宅建業法ページからPDF一覧（R4-R7、4件）を確認。免許取消・指示処分。5年間公表。建設もconfirmed。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "静岡県", sector: "takken", id: "shizuoka_takken", name: "静岡県 宅建業者監督処分", url: "https://www.pref.shizuoka.jp/kurashikankyo/kenchiku/takuchitatemono/1015904.html", discoveryStatus: "confirmed", notes: "HPで公表。MLITサイトも参照案内あり。" }),
  prefSource({ pref: "愛知県", sector: "takken", id: "aichi_takken", name: "愛知県 宅建業者監督処分", url: "https://www.pref.aichi.jp/soshiki/toshi-somu/takken-kantoku.html", discoveryStatus: "confirmed", notes: "5年間掲載。R5以降はMLITネガティブ情報にも掲載。" }),
  prefSource({ pref: "三重県", sector: "takken", id: "mie_takken", name: "三重県 宅建業者監督処分（基準）", url: "https://www.pref.mie.lg.jp/GYOHSEI/000070979.htm", discoveryStatus: "manual_review", notes: "将来再確認manual_review。処分基準PDFのみで県独自一覧・個別公表なし。建設はconfirmedのため、将来の県公式宅建処分公表整備時に再確認余地あり。" }),
  prefSource({ pref: "滋賀県", sector: "takken", id: "shiga_takken", name: "滋賀県 宅建業者行政処分", url: "https://www.pref.shiga.lg.jp/ippan/kendoseibi/zyuutaku/19133.html", discoveryStatus: "confirmed", notes: "処分実施年度の翌年度から5年間公開。" }),
  prefSource({ pref: "京都府", sector: "takken", id: "kyoto_takken", name: "京都府 宅建業者監督処分", url: "https://www.pref.kyoto.jp/kenchiku/1246242651763.html", discoveryStatus: "confirmed", notes: "5年間掲載。MLITネガティブ情報へのリンクあり。" }),
  prefSource({ pref: "大阪府", sector: "takken", id: "osaka_takken", name: "大阪府 宅建業者行政処分", url: "https://www.pref.osaka.lg.jp/o130200/kenshin/kantoku/index.html", discoveryStatus: "confirmed", notes: "免許取消・業務停止・指示。5年間公開。" }),
  prefSource({ pref: "兵庫県", sector: "takken", id: "hyogo_takken", name: "兵庫県 宅建業者監督処分", url: "https://web.pref.hyogo.lg.jp/ks29/wd22_000000013.html", discoveryStatus: "confirmed", notes: "年度別PDF公開。報道発表もあり。" }),
  prefSource({ pref: "奈良県", sector: "takken", id: "nara_takken", name: "奈良県 宅建業者監督処分", url: "https://www.pref.nara.lg.jp/n155/3741.html", discoveryStatus: "confirmed", notes: "第10バッチ再確認でconfirmed昇格。建築安全課(/n155/)配下にPDF行政処分一覧（R3-R7、7件）を確認。免許取消・業務停止・指示処分。建設もconfirmed。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "和歌山県", sector: "takken", id: "wakayama_takken", name: "和歌山県 宅建業者行政処分一覧", url: "https://www.pref.wakayama.lg.jp/prefg/080800/takken/syobun.html", discoveryStatus: "confirmed", notes: "行政処分一覧。5年分掲載。免許取消・業務停止・指示。処分日・商号・理由あり。" }),
  prefSource({ pref: "鳥取県", sector: "takken", id: "tottori_takken", name: "鳥取県 宅建業者監督処分", url: "https://www.pref.tottori.lg.jp/228167.htm", discoveryStatus: "confirmed", notes: "処分一覧（H26以降）。免許取消等の具体例。PDF詳細付き。5年間掲載。" }),
  prefSource({ pref: "島根県", sector: "takken", id: "shimane_takken", name: "島根県 宅建業者監督処分（基準）", url: "https://www.pref.shimane.lg.jp/infra/build/info/estate/gyosha_shobun.html", discoveryStatus: "candidate", notes: "重点再調査済み。公表方針あり（業者名・処分内容等をHP掲載と明記）だが事例ページなし。親ページからの導線もなく、ポリシー文書のみ。県独自一覧の裏取りができず固定候補寄りのcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "岡山県", sector: "takken", id: "okayama_takken", name: "岡山県 宅建業者監督処分（案内）", url: "https://www.pref.okayama.jp/page/detail-70300.html", discoveryStatus: "candidate", notes: "再棚卸し済み。県独自Web一覧なし。MLIT検索サイト+県庁窓口閲覧のみ。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "広島県", sector: "takken", id: "hiroshima_takken", name: "広島県 宅建業者監督処分", url: "https://www.pref.hiroshima.lg.jp/soshiki/107/kantoku0304.html", discoveryStatus: "confirmed", notes: "違反行為に対する監督処分情報。" }),
  prefSource({ pref: "山口県", sector: "takken", id: "yamaguchi_takken", name: "山口県 宅建業者監督処分（基準）", url: "https://www.pref.yamaguchi.lg.jp/soshiki/135/24299.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準PDFのみ。処分事例なし。MLIT誘導。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "徳島県", sector: "takken", id: "tokushima_takken", name: "徳島県 宅建業者監督処分", url: "https://www.pref.tokushima.lg.jp/ippannokata/kurashi/kenchiku/2012042600207", discoveryStatus: "confirmed", notes: "第10バッチ再確認でconfirmed昇格。処分公表ページに個別事案PDF（R6-R7、2件）を確認。指示・業務停止・免許取消。5年間公表。建設もconfirmed。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "香川県", sector: "takken", id: "kagawa_takken", name: "香川県 宅建業者監督処分公表", url: "https://www.pref.kagawa.lg.jp/jutaku/takken/syobunkijyuntoppage.html", discoveryStatus: "confirmed", notes: "処分業者7社掲載。処分日・商号・処分内容・理由。PDF詳細付き。5年間公表。" }),
  prefSource({ pref: "愛媛県", sector: "takken", id: "ehime_takken", name: "愛媛県 宅建業者監督処分", url: "https://www.pref.ehime.jp/page/2119.html", discoveryStatus: "confirmed", notes: "第11バッチ再確認でconfirmed昇格。処分基準ページにPDF処分一覧（H20以降、5年間公表）を確認。建設はcandidate。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "高知県", sector: "takken", id: "kochi_takken", name: "高知県 宅建業者監督処分", url: "https://www.pref.kochi.lg.jp/doc/takken-syobunjyouhou/", discoveryStatus: "confirmed", notes: "処分公表（H20以降）。免許取消・業務停止。5年間掲載。" }),
  prefSource({ pref: "福岡県", sector: "takken", id: "fukuoka_takken", name: "福岡県 宅建業者監督処分", url: "https://www.pref.fukuoka.lg.jp/contents/takkensyobun.html", discoveryStatus: "confirmed", notes: "知事処分の一覧。" }),
  prefSource({ pref: "佐賀県", sector: "takken", id: "saga_takken", name: "佐賀県 宅建業者監督処分一覧", url: "https://www.pref.saga.lg.jp/kiji003106819/index.html", discoveryStatus: "confirmed", notes: "年度別処分一覧（R6年度）。免許取消等の具体例あり。PDF詳細付き。" }),
  prefSource({ pref: "長崎県", sector: "takken", id: "nagasaki_takken", name: "長崎県 宅建業者監督処分公表", url: "https://www.pref.nagasaki.lg.jp/doc/page-435819.html", discoveryStatus: "confirmed", notes: "重点再調査によりCMS移行後の新URL確認。R8年2月の免許取消1件掲載中。H22以降5年間公表制度。継続的な処分公表ページを確認できたためconfirmedに更新。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "熊本県", sector: "takken", id: "kumamoto_takken", name: "熊本県 宅建業者監督処分（基準）", url: "https://www.pref.kumamoto.jp/soshiki/115/4319.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準のみ。処分事例なし。MLIT誘導。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "大分県", sector: "takken", id: "oita_takken", name: "大分県 宅建業者監督処分（基準）", url: "https://www.pref.oita.jp/soshiki/18500/kantokusyobun.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準PDFのみ。MLIT誘導中心。県独自Web一覧なし。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "宮崎県", sector: "takken", id: "miyazaki_takken", name: "宮崎県 宅建業者監督処分", url: "https://www.pref.miyazaki.lg.jp/kenchikujutaku/kurashi/shakaikiban/torihiki.html", discoveryStatus: "candidate", notes: "固定候補寄り。重点再調査で県はMLIT一元化方式と判明。公表方針（H21~/5年）はあるがデータはMLIT側。RETIO上に宮崎県処分実績（R4-R5複数件）を確認済みだが県サイトに一覧なし。MLIT補完前提で固定運用。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "鹿児島県", sector: "takken", id: "kagoshima_takken", name: "鹿児島県 宅建業者監督処分（案内）", url: "http://www.pref.kagoshima.jp/ah12/infra/kentiku/shidou/torihiki/sonota/takkengyoushashobunjouhou.html", discoveryStatus: "candidate", notes: "再棚卸し済み。案内ページのみ。MLIT検索サイト誘導。県独自Web一覧なし。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "沖縄県", sector: "takken", id: "okinawa_takken", name: "沖縄県 宅建業者監督処分（基準）", url: "https://www.pref.okinawa.jp/site/doboku/shido/gyomu/kanntokushobunnkijyunn.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準PDFのみ。処分事例なし。MLIT誘導。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
];

// ─── 都道府県 建設ソース ─────────────────────

const PREFECTURE_KENSETSU_SOURCES = [
  prefSource({ pref: "北海道", sector: "kensetsu", id: "hokkaido_kensetsu", name: "北海道 建設業者監督処分", url: "https://www.pref.hokkaido.lg.jp/kn/ksk/kenjohp/sinsa/kantoku.html", discoveryStatus: "confirmed", notes: "建設業を営む者に対する監督処分。" }),
  prefSource({ pref: "青森県", sector: "kensetsu", id: "aomori_kensetsu", name: "青森県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "固定manual_review。複数バッチ確認済みで県独自の処分一覧なし。県ポータルで明示的にMLIT誘導。指名停止は別カテゴリ。MLIT補完前提で固定運用。" }),
  prefSource({ pref: "岩手県", sector: "kensetsu", id: "iwate_kensetsu", name: "岩手県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "将来再確認manual_review。旧URL(1010873.html)が404化しCMS移行余地あり。MLIT連携+県庁閲覧のみ。宅建はcandidateのため、将来のURL再探索時に再確認余地あり。" }),
  prefSource({ pref: "宮城県", sector: "kensetsu", id: "miyagi_kensetsu", name: "宮城県 建設業者監督処分", url: "https://www.pref.miyagi.jp/soshiki/jigyokanri/syobun.html", discoveryStatus: "confirmed", notes: "年度別個別処分ページあり。" }),
  prefSource({ pref: "秋田県", sector: "kensetsu", id: "akita_kensetsu", name: "秋田県 建設業者監督処分（案内）", url: "https://www.pref.akita.lg.jp/pages/archive/4386", discoveryStatus: "candidate", notes: "再棚卸し済み。案内ページ。県庁閲覧所（5年分）+MLIT誘導。Web一覧なし。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "山形県", sector: "kensetsu", id: "yamagata_kensetsu", name: "山形県 建設業者監督処分", url: null, discoveryStatus: "candidate", sourceType: "press_release_only", notes: "重点再調査済み。R3-R6の個別press releaseを確認したが多数404化（サイト移行）。集約ページ・年度別一覧なし。URL不安定で継続的一覧の裏取りができず、MLIT補完前提の固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "福島県", sector: "kensetsu", id: "fukushima_kensetsu", name: "福島県 建設業者監督処分", url: "https://www.pref.fukushima.lg.jp/sec/41025c/kyokasyobun.html", discoveryStatus: "confirmed", notes: "許可取消・営業停止・指示の一覧。5年間公表。" }),
  prefSource({ pref: "茨城県", sector: "kensetsu", id: "ibaraki_kensetsu", name: "茨城県 建設業者監督処分", url: "https://kennsetugyou-ibaraki.jp/supervisory_measures_information/", discoveryStatus: "candidate", notes: "再棚卸し済み。専用サイト(kennsetugyou-ibaraki.jp)に監督処分情報ページあるが処分基準・廃業届一覧のみで処分実績case dataなし。MLIT補完前提の固定候補寄りcandidate。宅建はconfirmed。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "栃木県", sector: "kensetsu", id: "tochigi_kensetsu", name: "栃木県 建設業者監督処分（基準）", url: "https://www.pref.tochigi.lg.jp/h01/work/kensetsugyou/kyoka/kensetugyou_syobun.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準ページのみ。処分簿・一覧はWeb未掲載。MLIT誘導。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "群馬県", sector: "kensetsu", id: "gunma_kensetsu", name: "群馬県 建設業者監督処分（基準）", url: "https://www.pref.gunma.jp/page/10901.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準ページのみ。処分一覧・処分簿はWeb未掲載。MLIT誘導。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "埼玉県", sector: "kensetsu", id: "saitama_kensetsu", name: "埼玉県 建設業者指導監督", url: "https://www.pref.saitama.lg.jp/a1002/kantoku.html", discoveryStatus: "confirmed", notes: "建設業者等の指導監督ページ。" }),
  prefSource({ pref: "千葉県", sector: "kensetsu", id: "chiba_kensetsu", name: "千葉県 建設業者監督処分", url: "https://www.pref.chiba.lg.jp/kenfudou/gyouseishobun/kensetu/index.html", discoveryStatus: "confirmed", notes: "年度別一覧。県ページに載せていない処分はMLITに掲載との案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "東京都", sector: "kensetsu", id: "tokyo_kensetsu", name: "東京都 建設業者監督処分", url: "https://www.toshiseibi.metro.tokyo.lg.jp/kenchiku_kaihatsu/kenchiku_shidou/gyosya_shido/kensetsu/kensetsu04", discoveryStatus: "confirmed", notes: "不正行為等に対する監督処分基準。" }),
  prefSource({ pref: "神奈川県", sector: "kensetsu", id: "kanagawa_kensetsu", name: "神奈川県 建設業者監督処分", url: "https://www.pref.kanagawa.jp/docs/u2h/cnt/f531856/p870268.html", discoveryStatus: "confirmed", notes: "指示・停止・取消の3種。5年間台帳。" }),
  prefSource({ pref: "新潟県", sector: "kensetsu", id: "niigata_kensetsu", name: "新潟県 建設業者監督処分", url: "https://www.pref.niigata.lg.jp/sec/dobokukanri/1191256251816.html", discoveryStatus: "confirmed", notes: "建設業者への監督処分情報。" }),
  prefSource({ pref: "富山県", sector: "kensetsu", id: "toyama_kensetsu", name: "富山県 建設業者監督処分", url: "https://www.pref.toyama.jp/1510/sangyou/shoukoukensetsu/kensetsugyou/kj00001813/kj00001813-004-01.html", discoveryStatus: "candidate", sourceType: "press_release_only", notes: "固定候補寄り。重点再調査で情報ページ+閲覧制度（5年/県庁窓口）のみでWebデータなしと確認。press releaseも再発見できず。MLIT補完前提で固定運用。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "石川県", sector: "kensetsu", id: "ishikawa_kensetsu", name: "石川県 建設業者監督処分", url: "https://www.pref.ishikawa.lg.jp/kanri/kyokashinsei/houreizyunsyu.html", discoveryStatus: "candidate", sourceType: "press_release_only", notes: "再確認候補寄り。重点再調査で年度別press release(R5営業停止2件、R7営業停止1件)を確認。一覧ページはないが年度press releaseページ(/kisya/rN/kanri.html)に実績が蓄積。再確認候補継続。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "福井県", sector: "kensetsu", id: "fukui_kensetsu", name: "福井県 建設業者監督処分（基準）", url: "https://www.pref.fukui.lg.jp/doc/kanri/kantokusyobun.html", discoveryStatus: "manual_review", notes: "将来再確認manual_review。処分基準のみで県独自一覧なし。指名停止は別カテゴリ。宅建はconfirmedのため、将来の県公式建設処分公表整備時に再確認余地あり。" }),
  prefSource({ pref: "山梨県", sector: "kensetsu", id: "yamanashi_kensetsu", name: "山梨県 建設業者監督処分", url: "https://www.pref.yamanashi.jp/kentai/kantoku.html", discoveryStatus: "candidate", notes: "固定候補寄り。重点再調査で専用ページ+閲覧制度（5年/県庁窓口）のみと確認。Webデータ・press releaseともになし。MLIT補完前提で固定運用。", expectedCoverage: "mlit_primary" }),
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
  prefSource({ pref: "和歌山県", sector: "kensetsu", id: "wakayama_kensetsu", name: "和歌山県 建設業者監督処分（基準）", url: "https://www.pref.wakayama.lg.jp/prefg/081100/kghsyobun/index.html", discoveryStatus: "manual_review", notes: "将来再確認manual_review。処分基準のみで宅建側syobun相当の建設ページなし。指名停止は別カテゴリ。宅建はconfirmedのため、将来の県公式建設処分公表整備時に再確認余地あり。" }),
  prefSource({ pref: "鳥取県", sector: "kensetsu", id: "tottori_kensetsu", name: "鳥取県 建設業者監督処分", url: "https://www.pref.tottori.lg.jp/28184.htm", discoveryStatus: "confirmed", notes: "第10バッチ再確認でconfirmed昇格。建設業ページ内に監督処分公告セクション+処分簿PDF確認。R6営業停止等の実績あり。宅建もconfirmed。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "島根県", sector: "kensetsu", id: "shimane_kensetsu", name: "島根県 建設業者監督処分", url: "https://www.pref.shimane.lg.jp/infra/kensetsu/hou/junsyu/", discoveryStatus: "manual_review", notes: "将来再確認manual_review。法令遵守ページに処分基準+MLIT誘導あり。個別press releaseは一般報道発表に散在。宅建はcandidateのため、将来の公表体制整備時に再確認余地あり。" }),
  prefSource({ pref: "岡山県", sector: "kensetsu", id: "okayama_kensetsu", name: "岡山県 建設業監督処分一覧", url: "https://www.pref.okayama.jp/page/detail-46609.html", discoveryStatus: "confirmed", notes: "処分一覧+処分簿PDF。過去5年分。監督処分基準も掲載。" }),
  prefSource({ pref: "広島県", sector: "kensetsu", id: "hiroshima_kensetsu", name: "広島県 建設業法に基づく監督処分", url: "https://www.pref.hiroshima.lg.jp/soshiki/93/1206083718262.html", discoveryStatus: "confirmed", notes: "MLITネガティブ情報にも掲載との案内あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "山口県", sector: "kensetsu", id: "yamaguchi_kensetsu", name: "山口県 建設業者監督処分（基準）", url: "https://www.pref.yamaguchi.lg.jp/site/kensetsugyo/23463.html", discoveryStatus: "candidate", notes: "再棚卸し済み。処分基準PDF（R7改正）のみ。MLIT誘導。県独自一覧なし。固定候補寄りcandidate。", expectedCoverage: "mlit_primary" }),
  prefSource({ pref: "徳島県", sector: "kensetsu", id: "tokushima_kensetsu", name: "徳島県 建設業者監督処分", url: "https://www.pref.tokushima.lg.jp/jigyoshanokata/kendozukuri/kensetsu/7304817/", sourceType: "pdf_notice", discoveryStatus: "confirmed", notes: "重点再調査により年度別一覧ページ確認（R7年度分）。許可取消・営業停止・指示の3区分をPDF公開（7ファイル、四半期別）。年度別処分一覧と個別処分情報を確認できたためconfirmedに更新。URLは年度毎に変わる可能性あり。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "香川県", sector: "kensetsu", id: "kagawa_kensetsu", name: "香川県 建設業者監督処分情報", url: "https://www.pref.kagawa.lg.jp/dobokukanri/nyusatu/koji/kantokusyobun.html", discoveryStatus: "confirmed", notes: "処分一覧。処分日・業者名・処分内容（許可取消・営業停止）。PDF詳細付き。" }),
  prefSource({ pref: "愛媛県", sector: "kensetsu", id: "ehime_kensetsu", name: "愛媛県 建設業者監督処分", url: "https://www.pref.ehime.jp/page/5832.html", discoveryStatus: "confirmed", notes: "重点再調査でconfirmed昇格。ハブページ配下に個別処分3件（R7.9営業停止1年、R6.12指示、R7.4指示）すべてアクセス可能。処分日・業者名・処分内容・理由の具体情報あり。処分基準PDF（R7.12改訂）もリンク。宅建もconfirmed。", expectedCoverage: "pref_primary" }),
  prefSource({ pref: "高知県", sector: "kensetsu", id: "kochi_kensetsu", name: "高知県 建設業者監督処分情報", url: "https://www.pref.kochi.lg.jp/doc/kantokushobun_list/", discoveryStatus: "confirmed", notes: "処分一覧（R2以降）。営業停止・指示・許可取消。複数年度。PDF詳細付き。" }),
  prefSource({ pref: "福岡県", sector: "kensetsu", id: "fukuoka_kensetsu", name: "福岡県 建設業者監督処分", url: "https://www.pref.fukuoka.lg.jp/contents/kennsetukanntokushobunn.html", discoveryStatus: "confirmed", notes: "処分台帳は県庁窓口で閲覧可。停止・取消は官報掲載。", sourceType: "press_release_only" }),
  prefSource({ pref: "佐賀県", sector: "kensetsu", id: "saga_kensetsu", name: "佐賀県 建設業者監督処分一覧", url: "https://www.pref.saga.lg.jp/kiji003112004/index.html", discoveryStatus: "confirmed", notes: "年度別処分一覧（R2-R6の複数年度）。指示・営業停止・許可取消。PDF詳細付き。" }),
  prefSource({ pref: "長崎県", sector: "kensetsu", id: "nagasaki_kensetsu", name: "長崎県 建設業者監督処分", url: null, discoveryStatus: "candidate", sourceType: "press_release_only", notes: "再確認候補寄り。重点再調査で処分実績（R7営業停止等）を第三者記事で複数確認。ただしpress releaseは定期的に404化し常設一覧なし。宅建confirmed側のような常設ページが将来出る可能性あり再確認候補継続。", expectedCoverage: "hybrid" }),
  prefSource({ pref: "熊本県", sector: "kensetsu", id: "kumamoto_kensetsu", name: "熊本県 建設業者監督処分", url: null, discoveryStatus: "manual_review", notes: "固定manual_review。複数バッチ確認済みで処分公表ページ未発見。指名停止のみ。URL導線もなくMLIT補完前提で固定運用。宅建はcandidate。" }),
  prefSource({ pref: "大分県", sector: "kensetsu", id: "oita_kensetsu", name: "大分県 建設業者監督処分", url: "https://www.pref.oita.jp/site/n-kennsetsugyou/n-kantokushobunntokushobun.html", discoveryStatus: "confirmed", notes: "処分一覧PDF（随時追加更新）。建設業指導班。" }),
  prefSource({ pref: "宮崎県", sector: "kensetsu", id: "miyazaki_kensetsu", name: "宮崎県 建設業者監督処分", url: "https://www.pref.miyazaki.lg.jp/kanri/shigoto/kokyojigyo/kantokushobun.html", discoveryStatus: "manual_review", notes: "将来再確認manual_review。制度説明・処分基準PDFのみで処分実績の掲載なし。入札停止は別カテゴリ。宅建はcandidateのため、将来の県公式公表拡充時に再確認余地あり。" }),
  prefSource({ pref: "鹿児島県", sector: "kensetsu", id: "kagoshima_kensetsu", name: "鹿児島県 建設業者監督処分", url: "http://www.pref.kagoshima.jp/ah01/infra/tochi-kensetu/kensetu/sidoukantoku.html", discoveryStatus: "confirmed", notes: "処分一覧PDF（R5-R7の3年度分）。基準・ホットライン情報もあり。" }),
  prefSource({ pref: "沖縄県", sector: "kensetsu", id: "okinawa_kensetsu", name: "沖縄県 建設業者監督処分", url: "https://www.pref.okinawa.jp/machizukuri/kenchiku/1023167/1013358/1028170.html", discoveryStatus: "confirmed", notes: "処分基準+処分一覧PDF（R4年度）。5年間公表。MLIT誘導もあり。", expectedCoverage: "hybrid" }),
];

// ─── 建築士事務所ソース ─────────────────────

const ARCHITECT_OFFICE_SOURCES = [
  {
    id: "mlit_nega_inf_ikkyuu",
    sector: "architect_office",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（一級建築士）",
    url: "https://www.mlit.go.jp/nega-inf/cgi-bin/search.cgi?jigyoubunya=ikkyuu",
    sourceType: "aggregated_search",
    coverageScope: "full",
    discoveryStatus: "confirmed",
    expectedCoverage: "mlit_primary",
    complements: "一級建築士個人の懲戒処分（免許取消・業務停止・戒告）。建築士事務所処分はMLIT非掲載のため都道府県補完必須。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "建築士法第10条。事務所処分ではなく建築士個人処分。CGI形式。",
  },
  {
    id: "tokyo_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "東京都",
    prefecture: "東京都",
    sourceName: "東京都 建築士事務所の処分",
    url: "https://www.toshiseibi.metro.tokyo.lg.jp/kenchiku_kaihatsu/kenchiku_shidou/kenchikusi/jim_syobun",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "東京都知事登録の建築士事務所に対する監督処分（登録取消・閉鎖命令・戒告）。建築士法第26条。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "都市整備局管轄。",
  },
  {
    id: "hyogo_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "兵庫県",
    prefecture: "兵庫県",
    sourceName: "兵庫県 建築士事務所の監督処分一覧",
    url: "https://web.pref.hyogo.lg.jp/ks29/wd30_000000047.html",
    sourceType: "pdf_notice",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "兵庫県知事登録の建築士事務所に対する監督処分（登録取消・閉鎖命令・戒告）。PDF公告形式。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "pdf",
    active: true,
    notes: "建築士法第26条第4項準用。PDF一覧確認済み。",
  },
  {
    id: "miyagi_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "宮城県",
    prefecture: "宮城県",
    sourceName: "宮城県 建築士事務所の監督処分",
    url: "https://www.pref.miyagi.jp/soshiki/kentaku/syobun-20top.html",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "宮城県知事登録の建築士事務所に対する監督処分。建築士懲戒処分も同ページで公表。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "平成19年6月20日以降の処分一覧。処分種別（登録取消・事務所閉鎖）をリンク形式で公表。",
  },
  {
    id: "kanagawa_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "神奈川県",
    prefecture: "神奈川県",
    sourceName: "神奈川県 建築士事務所の監督処分",
    url: "https://www.pref.kanagawa.jp/docs/f7t/cnt/f500365/index.html",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "神奈川県知事登録の建築士事務所に対する監督処分（戒告・事務所閉鎖・登録取消）。年度別一覧。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "令和2年度・令和4年度・令和6年度の処分一覧を確認。令和3年度・令和5年度は処分なし。",
  },
  {
    id: "aichi_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "愛知県",
    prefecture: "愛知県",
    sourceName: "愛知県 建築士事務所の監督処分",
    url: "https://www.pref.aichi.jp/soshiki/kenchikushido/kenchikushihou-shobun.html",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "愛知県知事登録の建築士事務所に対する監督処分一覧。建築士懲戒処分も同ページで公表。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "処分年月日・開設者・事務所名・登録種別・処分内容・原因事実をテーブル形式で公表。5年間掲載。",
  },
  {
    id: "fukuoka_architect_office",
    sector: "architect_office",
    authorityLevel: "prefecture",
    authorityName: "福岡県",
    prefecture: "福岡県",
    sourceName: "福岡県 建築士事務所の監督処分状況",
    url: "https://www.pref.fukuoka.lg.jp/contents/kenchikushishobun.html",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "confirmed",
    expectedCoverage: "pref_primary",
    complements: "福岡県知事登録の建築士事務所に対する監督処分。建築士懲戒処分も同ページで公表。",
    publicationWindow: "5 years",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "建築指導課管轄。2025年3月17日更新確認。",
  },
];

// ─── 産廃DB中央ソース ─────────────────────

const SANPAI_CENTRAL_SOURCES = [
  {
    id: "env_sanpai_portal",
    sector: "sanpai",
    authorityLevel: "national",
    authorityName: "環境省",
    prefecture: null,
    sourceName: "環境省 産業廃棄物処理業者情報案内",
    url: "https://www.env.go.jp/recycle/waste/",
    sourceType: "official_list",
    coverageScope: "full",
    discoveryStatus: "candidate",
    expectedCoverage: "mlit_primary",
    complements: "産廃処理業の許可・規制の根拠。都道府県への許可権限委任。直接の処分一覧はなし。",
    publicationWindow: "unknown",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "廃棄物処理法に基づく情報案内。直接スクレイプ対象ではなく制度的根拠として登録。",
  },
  {
    id: "sanpainet_gyosha",
    sector: "sanpai",
    authorityLevel: "national",
    authorityName: "公益財団法人日本産業廃棄物処理振興センター",
    prefecture: null,
    sourceName: "産廃情報ネット 行政情報検索システム（許可情報）",
    url: "https://www2.sanpainet.or.jp/sanpai/",
    sourceType: "aggregated_search",
    coverageScope: "full",
    discoveryStatus: "candidate",
    expectedCoverage: "mlit_primary",
    complements: "全国の産廃処理業許可業者を横断検索。都道府県許可番号・業種・有効期限を収録。",
    publicationWindow: "current",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "許可情報の中央集約ソース。取消処分情報も掲載あり。要アクセス確認。行政情報検索システム。自治体提供の全国処理業者情報・許可基本情報を検索可。",
  },
  {
    id: "sanpainet_torikeshi",
    sector: "sanpai",
    authorityLevel: "national",
    authorityName: "公益財団法人日本産業廃棄物処理振興センター",
    prefecture: null,
    sourceName: "産廃情報ネット 許可取消処分情報",
    url: "https://www2.sanpainet.or.jp/shobun/",
    sourceType: "official_list",
    coverageScope: "full",
    discoveryStatus: "candidate",
    expectedCoverage: "mlit_primary",
    complements: "全国の産廃処理業許可取消処分を集約。都道府県別取消情報の補完として機能。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "取消処分DBのMVP中核ソース。個別URLは調査中のためトップドメインで暫定登録。自治体提供の処理業許可・施設設置許可の取消処分情報。全国横断検索可。",
  },
  {
    id: "sanpainet_yuryo",
    sector: "sanpai",
    authorityLevel: "national",
    authorityName: "公益財団法人日本産業廃棄物処理振興センター",
    prefecture: null,
    sourceName: "産廃情報ネット 優良さんぱいナビ",
    url: "https://www3.sanpainet.or.jp/",
    sourceType: "official_list",
    coverageScope: "partial",
    discoveryStatus: "candidate",
    expectedCoverage: "mlit_primary",
    complements: "優良産廃処理業者認定制度に基づく認定業者情報。優良認定の有無確認に活用。",
    publicationWindow: "current",
    updateFrequency: "as_needed",
    acquisitionMethod: "html",
    active: true,
    notes: "優良認定業者が登録した情報を検索・閲覧可能。MVP後回し対象だが中央ソースとして登録。",
  },
];

// ─── 統合台帳 ─────────────────────

export const SOURCE_REGISTRY = [
  ...MLIT_SOURCES,
  ...PREFECTURE_TAKKEN_SOURCES,
  ...PREFECTURE_KENSETSU_SOURCES,
  ...ARCHITECT_OFFICE_SOURCES,
  ...SANPAI_CENTRAL_SOURCES,
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
