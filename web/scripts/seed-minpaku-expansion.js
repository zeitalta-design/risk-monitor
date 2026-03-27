#!/usr/bin/env node
/**
 * 民泊ナビ データ拡充 seed — 8件 → 40件以上
 * 地域・タイプ・価格帯のバランスを重視
 */

const MINPAKU = [
  // ─── 東京 ─────
  { slug: "asakusa-traditional-house", title: "浅草 下町レトロハウス", category: "city", area: "東京都台東区", property_type: "entire", capacity: 5, price_per_night: 18000, min_nights: 2, host_name: "Masao", rating: 4.6, review_count: 142, summary: "浅草寺徒歩3分。和室2間の一棟貸し。外国人ゲストにも人気。", status: "active" },
  { slug: "roppongi-luxury-penthouse", title: "六本木ラグジュアリーペントハウス", category: "luxury", area: "東京都港区", property_type: "entire", capacity: 4, price_per_night: 65000, min_nights: 2, host_name: "Sora", rating: 4.9, review_count: 28, summary: "六本木ヒルズ至近。最上階からの夜景が圧巻のハイエンド物件。", status: "active" },
  { slug: "ikebukuro-budget-capsule", title: "池袋カプセル型ゲストルーム", category: "budget", area: "東京都豊島区", property_type: "shared_room", capacity: 1, price_per_night: 2800, min_nights: 1, host_name: "Taro", rating: 4.0, review_count: 523, summary: "池袋駅東口徒歩5分。清潔なカプセル型個室。女性専用フロアあり。", status: "active" },
  { slug: "shimokitazawa-artist-loft", title: "下北沢アーティストロフト", category: "city", area: "東京都世田谷区", property_type: "entire", capacity: 3, price_per_night: 12000, min_nights: 2, host_name: "Miki", rating: 4.7, review_count: 95, summary: "下北沢の古着街すぐ。アート作品に囲まれたおしゃれなロフト。", status: "active" },

  // ─── 大阪 ─────
  { slug: "osaka-shinsekai-guesthouse", title: "新世界レトロゲストハウス", category: "budget", area: "大阪府大阪市浪速区", property_type: "shared_room", capacity: 1, price_per_night: 2500, min_nights: 1, host_name: "Koji", rating: 4.2, review_count: 389, summary: "通天閣の目の前。串カツ・たこ焼きの食べ歩きに最適。", status: "active" },
  { slug: "osaka-umeda-business-suite", title: "梅田ビジネススイート", category: "business", area: "大阪府大阪市北区", property_type: "entire", capacity: 2, price_per_night: 11000, min_nights: 1, host_name: "Yoko", rating: 4.5, review_count: 201, summary: "梅田駅直結。高速Wi-Fi・モニター2台完備のテレワーク特化型。", status: "active" },
  { slug: "osaka-minami-family-house", title: "心斎橋ファミリーハウス", category: "family", area: "大阪府大阪市中央区", property_type: "entire", capacity: 7, price_per_night: 22000, min_nights: 2, host_name: "Tomoko", rating: 4.6, review_count: 134, summary: "心斎橋・道頓堀徒歩5分。3LDKで子ども用ベッドあり。", status: "active" },

  // ─── 京都 ─────
  { slug: "kyoto-gion-machiya", title: "祇園花見小路 京町家", category: "luxury", area: "京都府京都市東山区", property_type: "entire", capacity: 4, price_per_night: 55000, min_nights: 2, host_name: "Chie", rating: 4.95, review_count: 67, summary: "花見小路沿いの築150年町家。坪庭・五右衛門風呂付き。", status: "active" },
  { slug: "kyoto-arashiyama-cottage", title: "嵐山竹林ビューコテージ", category: "resort", area: "京都府京都市右京区", property_type: "entire", capacity: 5, price_per_night: 35000, min_nights: 2, host_name: "Naoki", rating: 4.8, review_count: 91, summary: "嵐山竹林の小径すぐ。テラスから竹林を望む贅沢な立地。", status: "active" },
  { slug: "kyoto-station-compact", title: "京都駅前コンパクトステイ", category: "city", area: "京都府京都市下京区", property_type: "private_room", capacity: 2, price_per_night: 6500, min_nights: 1, host_name: "Ryo", rating: 4.3, review_count: 278, summary: "京都駅八条口徒歩2分。観光拠点に最適なコスパ重視の個室。", status: "active" },

  // ─── 北海道 ─────
  { slug: "niseko-ski-lodge", title: "ニセコ スキーロッジ", category: "resort", area: "北海道虻田郡ニセコ町", property_type: "entire", capacity: 8, price_per_night: 50000, min_nights: 3, host_name: "Ken", rating: 4.7, review_count: 56, summary: "グラン・ヒラフ徒歩5分。スキーイン・アウト可能。暖炉付き。", status: "active" },
  { slug: "sapporo-susukino-studio", title: "札幌すすきのスタジオ", category: "city", area: "北海道札幌市中央区", property_type: "entire", capacity: 3, price_per_night: 8000, min_nights: 1, host_name: "Yumi", rating: 4.4, review_count: 198, summary: "すすきの駅徒歩1分。ラーメン横丁・狸小路至近。", status: "active" },
  { slug: "furano-lavender-house", title: "富良野ラベンダーファームハウス", category: "family", area: "北海道富良野市", property_type: "entire", capacity: 6, price_per_night: 20000, min_nights: 2, host_name: "Akira", rating: 4.8, review_count: 43, summary: "ラベンダー畑に隣接。夏は花畑、冬はスキーを満喫。BBQ設備あり。", status: "active" },

  // ─── 沖縄 ─────
  { slug: "naha-kokusai-apartment", title: "那覇国際通り アパートメント", category: "city", area: "沖縄県那覇市", property_type: "entire", capacity: 4, price_per_night: 10000, min_nights: 2, host_name: "Haruki", rating: 4.5, review_count: 165, summary: "国際通り徒歩1分。牧志公設市場すぐの好立地ワンルーム。", status: "active" },
  { slug: "miyako-beachfront-villa", title: "宮古島ビーチフロント ヴィラ", category: "luxury", area: "沖縄県宮古島市", property_type: "entire", capacity: 6, price_per_night: 70000, min_nights: 3, host_name: "Mei", rating: 4.95, review_count: 21, summary: "与那覇前浜ビーチ目の前。プライベートプール・ジャグジー完備。", status: "active" },
  { slug: "okinawa-chatan-family", title: "北谷アメリカンビレッジ ファミリーコンド", category: "family", area: "沖縄県北谷町", property_type: "entire", capacity: 8, price_per_night: 28000, min_nights: 2, host_name: "Lisa", rating: 4.6, review_count: 87, summary: "アメリカンビレッジ徒歩3分。サンセットビーチ目の前。キッズルームあり。", status: "active" },

  // ─── 福岡 ─────
  { slug: "fukuoka-hakata-workation", title: "博多駅前ワーケーションルーム", category: "business", area: "福岡県福岡市博多区", property_type: "entire", capacity: 2, price_per_night: 8500, min_nights: 3, host_name: "Shota", rating: 4.4, review_count: 112, summary: "博多駅筑紫口徒歩3分。昇降デスク・4Kモニター完備。長期割引あり。", status: "active" },
  { slug: "fukuoka-ohori-park-house", title: "大濠公園ビューハウス", category: "family", area: "福岡県福岡市中央区", property_type: "entire", capacity: 5, price_per_night: 16000, min_nights: 2, host_name: "Emi", rating: 4.7, review_count: 76, summary: "大濠公園徒歩2分。公園ビューのファミリー向け2LDK。", status: "active" },

  // ─── 地方都市 ─────
  { slug: "kanazawa-samurai-house", title: "金沢 武家屋敷ステイ", category: "luxury", area: "石川県金沢市", property_type: "entire", capacity: 4, price_per_night: 40000, min_nights: 2, host_name: "Kazuki", rating: 4.85, review_count: 38, summary: "長町武家屋敷跡地区内。加賀百万石の歴史を体感する一棟貸し。", status: "active" },
  { slug: "hiroshima-peace-guesthouse", title: "広島平和公園ゲストハウス", category: "budget", area: "広島県広島市中区", property_type: "private_room", capacity: 2, price_per_night: 4500, min_nights: 1, host_name: "Hiro", rating: 4.3, review_count: 267, summary: "平和記念公園徒歩5分。国際交流が盛んなアットホームな宿。", status: "active" },
  { slug: "nagasaki-dejima-apartment", title: "長崎出島エリア アパートメント", category: "city", area: "長崎県長崎市", property_type: "entire", capacity: 3, price_per_night: 9500, min_nights: 2, host_name: "Sakura", rating: 4.5, review_count: 82, summary: "出島・中華街エリア。異国情緒あふれる港町ステイ。", status: "active" },
  { slug: "sendai-jozenji-loft", title: "仙台定禅寺通り ロフト", category: "city", area: "宮城県仙台市青葉区", property_type: "entire", capacity: 3, price_per_night: 8000, min_nights: 1, host_name: "Daiki", rating: 4.4, review_count: 143, summary: "定禅寺通りのケヤキ並木沿い。牛タンの名店が徒歩圏内。", status: "active" },
  { slug: "takayama-kominka-stay", title: "高山 古民家まるごとステイ", category: "resort", area: "岐阜県高山市", property_type: "entire", capacity: 8, price_per_night: 32000, min_nights: 2, host_name: "Fumio", rating: 4.8, review_count: 54, summary: "高山の古い町並み徒歩10分。囲炉裏・五右衛門風呂のある築200年古民家。", status: "active" },
  { slug: "naoshima-art-cottage", title: "直島アートコテージ", category: "resort", area: "香川県直島町", property_type: "entire", capacity: 4, price_per_night: 25000, min_nights: 2, host_name: "Kaoru", rating: 4.7, review_count: 63, summary: "ベネッセアートサイト至近。瀬戸内海を望むアート好きのための宿。", status: "active" },
  { slug: "yakushima-forest-cabin", title: "屋久島 森のキャビン", category: "resort", area: "鹿児島県屋久島町", property_type: "entire", capacity: 4, price_per_night: 18000, min_nights: 2, host_name: "Ryota", rating: 4.75, review_count: 41, summary: "縄文杉トレッキング拠点。原生林に囲まれた静かなログハウス。", status: "active" },

  // ─── ワーケーション / 長期滞在 ─────
  { slug: "atami-seaside-workation", title: "熱海シーサイド ワーケーション", category: "business", area: "静岡県熱海市", property_type: "entire", capacity: 3, price_per_night: 12000, min_nights: 5, host_name: "Noriko", rating: 4.6, review_count: 58, summary: "海を見ながらリモートワーク。温泉付き・高速Wi-Fi完備。週割あり。", status: "active" },
  { slug: "kamakura-longstay-house", title: "鎌倉 長期滞在向けハウス", category: "city", area: "神奈川県鎌倉市", property_type: "entire", capacity: 4, price_per_night: 14000, min_nights: 7, host_name: "Mana", rating: 4.65, review_count: 35, summary: "由比ヶ浜徒歩8分。洗濯機・キッチン完備。1週間以上の滞在に最適。", status: "active" },
  { slug: "izu-onsen-workation", title: "伊豆高原 温泉ワーケーション", category: "business", area: "静岡県伊東市", property_type: "entire", capacity: 5, price_per_night: 15000, min_nights: 3, host_name: "Taku", rating: 4.5, review_count: 47, summary: "源泉掛け流し露天風呂付き。ワークスペース・会議室あり。", status: "active" },

  // ─── 予約停止中 / 閉鎖（status 分散） ─────
  { slug: "yokohama-chinatown-closed", title: "横浜中華街アパートメント（休止中）", category: "city", area: "神奈川県横浜市中区", property_type: "entire", capacity: 4, price_per_night: 12000, min_nights: 2, host_name: "Chen", rating: 4.2, review_count: 89, summary: "横浜中華街の中心。現在リノベーション中のため予約停止。", status: "inactive" },
  { slug: "kobe-harbor-view-closed", title: "神戸ハーバービュールーム（閉鎖）", category: "city", area: "兵庫県神戸市中央区", property_type: "private_room", capacity: 2, price_per_night: 8000, min_nights: 1, host_name: "Akiko", rating: 4.0, review_count: 156, summary: "神戸ハーバーランド一望。2025年12月で営業終了。", status: "closed" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO minpaku_items
      (slug, title, category, area, property_type, capacity, price_per_night, min_nights, host_name, rating, review_count, summary, status, is_published, created_at, updated_at)
    VALUES
      (@slug, @title, @category, @area, @property_type, @capacity, @price_per_night, @min_nights, @host_name, @rating, @review_count, @summary, @status, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const row of MINPAKU) {
    if (insert.run(row).changes > 0) inserted++;
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM minpaku_items WHERE is_published = 1").get().c;
  console.log(`追加: ${inserted}/${MINPAKU.length}件 (合計: ${total}件)`);

  console.log("\nカテゴリ別:");
  db.prepare("SELECT category, COUNT(*) as c FROM minpaku_items WHERE is_published = 1 GROUP BY category ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.category}: ${r.c}`));

  console.log("\n地域別:");
  db.prepare("SELECT SUBSTR(area, 1, INSTR(area, '県') ) as pref, COUNT(*) as c FROM minpaku_items WHERE is_published = 1 AND area LIKE '%県%' GROUP BY pref ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.pref}: ${r.c}`));
  db.prepare("SELECT SUBSTR(area, 1, INSTR(area, '都') ) as pref, COUNT(*) as c FROM minpaku_items WHERE is_published = 1 AND area LIKE '%都%' GROUP BY pref ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.pref}: ${r.c}`));
  db.prepare("SELECT SUBSTR(area, 1, INSTR(area, '府') ) as pref, COUNT(*) as c FROM minpaku_items WHERE is_published = 1 AND area LIKE '%府%' GROUP BY pref ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.pref}: ${r.c}`));
  db.prepare("SELECT SUBSTR(area, 1, INSTR(area, '道') ) as pref, COUNT(*) as c FROM minpaku_items WHERE is_published = 1 AND area LIKE '%道%' GROUP BY pref ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.pref}: ${r.c}`));
}

main().catch(console.error);
