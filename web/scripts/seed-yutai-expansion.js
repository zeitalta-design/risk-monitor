#!/usr/bin/env node
/**
 * 株主優待ナビ データ拡充 seed — 12件 → 60件以上
 * 人気株主優待銘柄を追加投入
 *
 * Usage:
 *   node scripts/seed-yutai-expansion.js
 */

const YUTAI = [
  // ─── 食品・飲食 ─────
  { code: "7550", slug: "7550-zensho", title: "ゼンショーHD", category: "food", confirm_months: "[3,9]", min_investment: 75000, benefit_summary: "食事券（年間2,000円分：すき家・ココス・はま寿司等で利用可能）", dividend_yield: 0.87, benefit_yield: 1.33 },
  { code: "7616", slug: "7616-colowide", title: "コロワイド", category: "food", confirm_months: "[3,9]", min_investment: 92000, benefit_summary: "優待ポイント（年間40,000円相当：かっぱ寿司・牛角・甘太郎等で利用可能）", dividend_yield: 0.54, benefit_yield: 4.35 },
  { code: "3563", slug: "3563-food-and-life", title: "FOOD&LIFE COMPANIES", category: "food", confirm_months: "[3,9]", min_investment: 28000, benefit_summary: "優待割引券（スシロー等で利用可能・年間2,200円分）", dividend_yield: 0.89, benefit_yield: 3.93 },
  { code: "9936", slug: "9936-ohsho", title: "王将フードサービス", category: "food", confirm_months: "[3,9]", min_investment: 86000, benefit_summary: "食事優待券（年間4,000円分：餃子の王将で利用可能）", dividend_yield: 1.40, benefit_yield: 2.33 },
  { code: "2695", slug: "2695-くら寿司", title: "くら寿司", category: "food", confirm_months: "[4]", min_investment: 38000, benefit_summary: "優待割引券（年間2,500円分：くら寿司全店で利用可能）", dividend_yield: 0.53, benefit_yield: 3.29 },
  { code: "3543", slug: "3543-komeda", title: "コメダホールディングス", category: "food", confirm_months: "[2,8]", min_investment: 27000, benefit_summary: "コメカ（電子マネー）1,000円分チャージ（年2回）", dividend_yield: 2.59, benefit_yield: 3.70 },
  { code: "2811", slug: "2811-kagome", title: "カゴメ", category: "food", confirm_months: "[6]", min_investment: 38000, benefit_summary: "自社商品詰め合わせ（2,000円相当のジュース・ケチャップ等）", dividend_yield: 1.05, benefit_yield: 2.63 },
  { code: "2897", slug: "2897-nissin", title: "日清食品HD", category: "food", confirm_months: "[3,9]", min_investment: 40000, benefit_summary: "自社グループ製品詰め合わせ（3,000円相当：カップヌードル等）", dividend_yield: 1.25, benefit_yield: 3.75 },
  { code: "7412", slug: "7412-atom", title: "アトム", category: "food", confirm_months: "[3,9]", min_investment: 8500, benefit_summary: "優待カードポイント（年間4,000円分：ステーキ宮・にぎりの徳兵衛等）", dividend_yield: 0.24, benefit_yield: 23.5 },
  { code: "2503", slug: "2503-kirin", title: "キリンHD", category: "food", confirm_months: "[12]", min_investment: 21000, benefit_summary: "自社商品詰め合わせ（ビール・飲料等1,000円相当）", dividend_yield: 3.33, benefit_yield: 2.38 },

  // ─── ショッピング・小売 ─────
  { code: "3048", slug: "3048-bic-camera", title: "ビックカメラ", category: "shopping", confirm_months: "[2,8]", min_investment: 12000, benefit_summary: "お買物優待券（年間3,000円分：ビックカメラ・コジマで利用可能）", dividend_yield: 1.67, benefit_yield: 12.5 },
  { code: "3382", slug: "3382-seven-i", title: "セブン&アイHD", category: "shopping", confirm_months: "[2,8]", min_investment: 24000, benefit_summary: "セブン&アイ共通商品券（2,000円分：イトーヨーカドー・セブンイレブン等）", dividend_yield: 2.08, benefit_yield: 4.17 },
  { code: "7532", slug: "7532-pan-pacific", title: "パン・パシフィックHD", category: "shopping", confirm_months: "[6,12]", min_investment: 33000, benefit_summary: "majicaポイント（年間4,000円分：ドン・キホーテで利用可能）", dividend_yield: 0.73, benefit_yield: 6.06 },
  { code: "8252", slug: "8252-marui", title: "丸井グループ", category: "shopping", confirm_months: "[3,9]", min_investment: 25000, benefit_summary: "エポスポイント（年間2,000円相当：マルイ・モディで利用可能）", dividend_yield: 2.52, benefit_yield: 4.00 },
  { code: "3086", slug: "3086-j-front", title: "J.フロント リテイリング", category: "shopping", confirm_months: "[2,8]", min_investment: 18000, benefit_summary: "10%割引カード（大丸・松坂屋で利用可能・年間限度額50万円）", dividend_yield: 2.44, benefit_yield: null },
  { code: "8273", slug: "8273-izumi", title: "イズミ", category: "shopping", confirm_months: "[2,8]", min_investment: 37000, benefit_summary: "株主優待券（年間10,000円分：ゆめタウン・ゆめマートで利用可能）", dividend_yield: 2.43, benefit_yield: 13.5 },
  { code: "2651", slug: "2651-lawson", title: "ローソン", category: "shopping", confirm_months: "[2,8]", min_investment: 100000, benefit_summary: "QUOカード（年間3,000円分：ローソン・ナチュラルローソン等）", dividend_yield: 1.50, benefit_yield: 1.50 },

  // ─── レジャー・旅行 ─────
  { code: "9201", slug: "9201-jal", title: "日本航空（JAL）", category: "leisure", confirm_months: "[3,9]", min_investment: 28000, benefit_summary: "国内線50%割引券（年2枚：ANA同様の航空優待）", dividend_yield: 2.50, benefit_yield: null },
  { code: "9020", slug: "9020-jr-east", title: "JR東日本", category: "leisure", confirm_months: "[3]", min_investment: 28000, benefit_summary: "株主優待割引券（運賃・料金4割引）", dividend_yield: 1.79, benefit_yield: null },
  { code: "9022", slug: "9022-jr-central", title: "JR東海", category: "leisure", confirm_months: "[3,9]", min_investment: 34000, benefit_summary: "株主優待割引券（東海道新幹線等10%割引2枚）", dividend_yield: 0.88, benefit_yield: null },
  { code: "9021", slug: "9021-jr-west", title: "JR西日本", category: "leisure", confirm_months: "[3]", min_investment: 30000, benefit_summary: "鉄道優待割引券（運賃・料金5割引1枚）", dividend_yield: 2.33, benefit_yield: null },
  { code: "9001", slug: "9001-tobu", title: "東武鉄道", category: "leisure", confirm_months: "[3,9]", min_investment: 37000, benefit_summary: "電車全線乗車証・東武百貨店等優待券", dividend_yield: 0.81, benefit_yield: null },
  { code: "2764", slug: "2764-hiramatsu", title: "ひらまつ", category: "leisure", confirm_months: "[3,9]", min_investment: 22000, benefit_summary: "レストラン・ホテル10%〜20%割引優待", dividend_yield: 0.00, benefit_yield: null },
  { code: "4680", slug: "4680-round-one", title: "ラウンドワン", category: "leisure", confirm_months: "[3,9]", min_investment: 12000, benefit_summary: "施設利用割引券500円×5枚（年間5,000円分）＋入会券等", dividend_yield: 1.67, benefit_yield: 20.83 },

  // ─── 日用品・生活 ─────
  { code: "4452", slug: "4452-kao", title: "花王", category: "daily", confirm_months: "[12]", min_investment: 60000, benefit_summary: "自社製品詰め合わせ（洗剤・化粧品等）※長期保有優遇あり", dividend_yield: 2.50, benefit_yield: null },
  { code: "4911", slug: "4911-shiseido", title: "資生堂", category: "daily", confirm_months: "[12]", min_investment: 27000, benefit_summary: "自社グループ化粧品・ヘアケア製品（1,500円相当）※100株以上", dividend_yield: 1.85, benefit_yield: 2.78 },
  { code: "4927", slug: "4927-pola", title: "ポーラ・オルビスHD", category: "daily", confirm_months: "[12]", min_investment: 15000, benefit_summary: "自社グループ商品（ポーラ・オルビス製品3,000円相当）", dividend_yield: 3.33, benefit_yield: 10.0 },
  { code: "7203", slug: "7203-toyota", title: "トヨタ自動車", category: "other", confirm_months: "[3,9]", min_investment: 27000, benefit_summary: "自社施設利用割引（トヨタ会館等）※長期保有条件あり", dividend_yield: 3.33, benefit_yield: null },
  { code: "2914", slug: "2914-jt", title: "日本たばこ産業（JT）", category: "food", confirm_months: "[12]", min_investment: 43000, benefit_summary: "自社グループ商品（加工食品詰め合わせ2,500円相当）", dividend_yield: 4.42, benefit_yield: 2.91 },
  { code: "4578", slug: "4578-otsuka", title: "大塚ホールディングス", category: "daily", confirm_months: "[12]", min_investment: 80000, benefit_summary: "自社グループ製品詰め合わせ（ポカリスエット・カロリーメイト等3,000円相当）", dividend_yield: 1.25, benefit_yield: 1.88 },

  // ─── マネー・金融 ─────
  { code: "8316", slug: "8316-smfg", title: "三井住友FG", category: "money", confirm_months: "[3,9]", min_investment: 36000, benefit_summary: "Vポイント（年間3,000ポイント：SBI証券との連携特典あり）※100株1年以上", dividend_yield: 3.33, benefit_yield: 4.17 },
  { code: "8306", slug: "8306-mufg", title: "三菱UFJFG", category: "money", confirm_months: "[3,9]", min_investment: 20000, benefit_summary: "Pontaポイント（年間1,000ポイント）※長期保有条件あり", dividend_yield: 3.50, benefit_yield: 2.50 },
  { code: "8411", slug: "8411-mizuho", title: "みずほFG", category: "money", confirm_months: "[3]", min_investment: 36000, benefit_summary: "カタログギフト等（2,500円相当）※500株以上かつ1年以上保有", dividend_yield: 3.61, benefit_yield: null },
  { code: "8604", slug: "8604-nomura", title: "野村ホールディングス", category: "money", confirm_months: "[3,9]", min_investment: 8000, benefit_summary: "自社サービス割引（野村證券の投信購入手数料20%割引等）", dividend_yield: 3.75, benefit_yield: null },

  // ─── その他・カタログ ─────
  { code: "2379", slug: "2379-dip", title: "ディップ", category: "other", confirm_months: "[2,8]", min_investment: 25000, benefit_summary: "QUOカード（年間1,000円分）※長期保有で増額あり", dividend_yield: 2.40, benefit_yield: 2.00 },
  { code: "4921", slug: "4921-fancl", title: "ファンケル", category: "daily", confirm_months: "[3]", min_investment: 32000, benefit_summary: "自社製品（化粧品・健康食品3,000円相当）", dividend_yield: 2.19, benefit_yield: 4.69 },
  { code: "8697", slug: "8697-jpe", title: "日本取引所グループ", category: "other", confirm_months: "[3]", min_investment: 39000, benefit_summary: "QUOカード（1,000円分）※長期保有で最大4,000円に増額", dividend_yield: 2.31, benefit_yield: 1.28 },
  { code: "9433", slug: "9433-kddi", title: "KDDI", category: "other", confirm_months: "[3]", min_investment: 48000, benefit_summary: "Pontaポイント（年間3,000ポイント）※au PAY マーケット商品カタログ", dividend_yield: 2.92, benefit_yield: 3.13 },
  { code: "9432", slug: "9432-ntt", title: "日本電信電話（NTT）", category: "other", confirm_months: "[3]", min_investment: 15000, benefit_summary: "dポイント（年間1,500ポイント）※2年以上継続保有で3,000ポイント", dividend_yield: 3.47, benefit_yield: 5.00 },
  { code: "9434", slug: "9434-softbank", title: "ソフトバンク", category: "other", confirm_months: "[3]", min_investment: 19000, benefit_summary: "PayPayポイント（年間1,000円相当）※1年以上保有", dividend_yield: 4.47, benefit_yield: 2.63 },
  { code: "4502", slug: "4502-takeda", title: "武田薬品工業", category: "daily", confirm_months: "[3,9]", min_investment: 42000, benefit_summary: "自社製品（オーラルケア・ビタミン剤等2,000円相当）", dividend_yield: 4.29, benefit_yield: 2.38 },
  { code: "2802", slug: "2802-ajinomoto", title: "味の素", category: "food", confirm_months: "[3]", min_investment: 60000, benefit_summary: "自社グループ製品詰め合わせ（調味料・冷凍食品等1,500円相当）", dividend_yield: 1.17, benefit_yield: 1.25 },
  { code: "2801", slug: "2801-kikkoman", title: "キッコーマン", category: "food", confirm_months: "[3]", min_investment: 17000, benefit_summary: "自社グループ製品詰め合わせ（醤油・つゆ等1,000円相当）", dividend_yield: 1.18, benefit_yield: 2.94 },
  { code: "7751", slug: "7751-canon", title: "キヤノン", category: "other", confirm_months: "[12]", min_investment: 50000, benefit_summary: "自社オンラインショップ割引（カレンダー・カメラ用品等）※長期保有で増額", dividend_yield: 2.80, benefit_yield: null },
  { code: "6758", slug: "6758-sony", title: "ソニーグループ", category: "other", confirm_months: "[3]", min_investment: 32000, benefit_summary: "ソニーストア15%割引クーポン（100株以上・AV製品対象）", dividend_yield: 0.63, benefit_yield: null },
  { code: "2269", slug: "2269-meiji", title: "明治HD", category: "food", confirm_months: "[3]", min_investment: 34000, benefit_summary: "自社グループ製品詰め合わせ（チョコレート・乳製品等2,000円相当）", dividend_yield: 2.94, benefit_yield: 2.94 },
  { code: "4543", slug: "4543-terumo", title: "テルモ", category: "daily", confirm_months: "[3,9]", min_investment: 27000, benefit_summary: "自社製品（体温計・血圧計等のヘルスケア製品優待販売）", dividend_yield: 1.11, benefit_yield: null },
  { code: "8233", slug: "8233-takashimaya", title: "高島屋", category: "shopping", confirm_months: "[2,8]", min_investment: 14000, benefit_summary: "株主優待カード（10%割引：高島屋全店で利用可能）", dividend_yield: 2.14, benefit_yield: null },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO yutai_items
      (code, slug, title, category, confirm_months, min_investment, benefit_summary, dividend_yield, benefit_yield, is_published, created_at, updated_at)
    VALUES
      (@code, @slug, @title, @category, @confirm_months, @min_investment, @benefit_summary, @dividend_yield, @benefit_yield, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const row of YUTAI) {
    if (insert.run(row).changes > 0) inserted++;
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM yutai_items WHERE is_published = 1").get().c;
  console.log(`追加: ${inserted}/${YUTAI.length}件 (合計: ${total}件)`);
  console.log("\nカテゴリ別:");
  db.prepare("SELECT category, COUNT(*) as c FROM yutai_items WHERE is_published = 1 GROUP BY category ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.category}: ${r.c}`));
}

main().catch(console.error);
