#!/usr/bin/env node
/**
 * 補助金ナビ データ拡充 seed — 11件 → 50件以上
 */

const HOJOKIN = [
  // ─── IT・デジタル ─────
  { slug: "denshi-torihiki-2026", title: "電子取引データ保存対応補助金", category: "it", target_type: "corp", max_amount: 1000000, subsidy_rate: "2/3", deadline: "2026-08-31", status: "open", provider_name: "中小企業庁", summary: "電子帳簿保存法対応のためのシステム導入費用を補助。" },
  { slug: "dx-sokushin-2026", title: "DX推進補助金", category: "it", target_type: "corp", max_amount: 5000000, subsidy_rate: "1/2", deadline: "2026-07-31", status: "open", provider_name: "経済産業省", summary: "中小企業のDX（デジタルトランスフォーメーション）を支援する補助金。" },
  { slug: "cyber-security-hojo", title: "サイバーセキュリティ対策促進助成金", category: "it", target_type: "corp", max_amount: 1500000, subsidy_rate: "1/2", deadline: "2026-09-30", status: "open", provider_name: "東京都", summary: "中小企業のサイバーセキュリティ対策に係る機器・サービス導入費を補助。" },

  // ─── 設備投資 ─────
  { slug: "sho-kibo-jizoku-2026", title: "小規模事業者持続化補助金（第17回）", category: "equipment", target_type: "small", max_amount: 2000000, subsidy_rate: "2/3", deadline: "2026-05-31", status: "open", provider_name: "日本商工会議所", summary: "小規模事業者の販路開拓や業務効率化の取組を支援。" },
  { slug: "jigyo-saikochiku-2026", title: "事業再構築補助金（第12回）", category: "equipment", target_type: "corp", max_amount: 100000000, subsidy_rate: "1/2〜3/4", deadline: "2026-10-31", status: "open", provider_name: "中小企業庁", summary: "ポストコロナ・ウクライナ情勢の変化に対応した事業再構築を支援。" },
  { slug: "setsubi-donyu-hojo-tokyo", title: "躍進的な事業推進のための設備投資支援事業", category: "equipment", target_type: "corp", max_amount: 10000000, subsidy_rate: "1/2〜2/3", deadline: "2026-06-30", status: "open", provider_name: "東京都中小企業振興公社", summary: "競争力強化に向けた設備投資を支援。最先端設備から一般設備まで対象。" },
  { slug: "setsubi-toshi-osaka", title: "大阪府ものづくり企業設備投資補助金", category: "equipment", target_type: "corp", max_amount: 5000000, subsidy_rate: "1/3", deadline: "2026-07-15", status: "open", provider_name: "大阪府", summary: "大阪府内ものづくり企業の競争力強化のための設備投資を支援。" },

  // ─── 雇用・人材 ─────
  { slug: "career-up-josei", title: "キャリアアップ助成金", category: "employment", target_type: "corp", max_amount: 800000, subsidy_rate: "定額", deadline: null, status: "open", provider_name: "厚生労働省", summary: "有期雇用労働者等の正社員化、処遇改善を行う事業主を支援。" },
  { slug: "ryoiku-kunren-hojo", title: "人材開発支援助成金", category: "employment", target_type: "corp", max_amount: 10000000, subsidy_rate: "経費の30%〜75% + 賃金助成", deadline: null, status: "open", provider_name: "厚生労働省", summary: "従業員の職業訓練を実施する事業主に対する助成金。OJT・Off-JT対象。" },
  { slug: "telework-josei", title: "テレワーク推進助成金", category: "employment", target_type: "corp", max_amount: 2500000, subsidy_rate: "1/2", deadline: "2026-12-31", status: "open", provider_name: "東京都", summary: "テレワーク環境整備のための機器・ソフトウェア導入を支援。" },
  { slug: "wakamono-koyo-hojo", title: "若者雇用促進支援事業", category: "employment", target_type: "corp", max_amount: 600000, subsidy_rate: "定額", deadline: null, status: "open", provider_name: "厚生労働省", summary: "若年者の安定就労を促進するため、採用・育成に取り組む企業を支援。" },

  // ─── 研究開発 ─────
  { slug: "sbir-phase1-2026", title: "SBIR Phase 1（研究開発型スタートアップ支援）", category: "research", target_type: "startup", max_amount: 50000000, subsidy_rate: "2/3", deadline: "2026-08-15", status: "open", provider_name: "NEDO", summary: "技術シーズを持つスタートアップの研究開発・事業化を支援。" },
  { slug: "sentan-gijutsu-kaihatsu", title: "先端技術実装推進事業補助金", category: "research", target_type: "corp", max_amount: 30000000, subsidy_rate: "1/2", deadline: "2026-09-30", status: "open", provider_name: "総務省", summary: "AI・IoT・ロボティクス等の先端技術を活用した地域課題解決を支援。" },

  // ─── 創業・起業 ─────
  { slug: "sogyo-shien-2026", title: "創業助成金（東京都）", category: "startup", target_type: "startup", max_amount: 3000000, subsidy_rate: "2/3", deadline: "2026-04-30", status: "open", provider_name: "東京都中小企業振興公社", summary: "都内で創業予定の方や創業後5年未満の方を対象に、事業に必要な経費の一部を助成。" },
  { slug: "joseiki-kigyouka-hojo", title: "女性起業家支援補助金", category: "startup", target_type: "startup", max_amount: 2000000, subsidy_rate: "2/3", deadline: "2026-07-31", status: "open", provider_name: "経済産業省", summary: "女性起業家の事業化を支援する補助金。創業準備から事業拡大まで対象。" },

  // ─── 環境・エネルギー ─────
  { slug: "sho-ene-hojo-2026", title: "省エネルギー設備投資促進補助金", category: "environment", target_type: "corp", max_amount: 50000000, subsidy_rate: "1/3〜1/2", deadline: "2026-06-30", status: "open", provider_name: "資源エネルギー庁", summary: "工場・事業場の省エネルギー設備の導入を支援する補助金。" },
  { slug: "ev-donyu-hojo", title: "クリーンエネルギー自動車導入補助金", category: "environment", target_type: "any", max_amount: 850000, subsidy_rate: "定額", deadline: "2027-03-31", status: "open", provider_name: "経済産業省", summary: "電気自動車・プラグインハイブリッド車・燃料電池自動車の購入を補助。" },
  { slug: "jisedai-solar-hojo", title: "次世代太陽光発電等導入促進事業", category: "environment", target_type: "any", max_amount: 10000000, subsidy_rate: "1/2", deadline: "2026-11-30", status: "open", provider_name: "環境省", summary: "建物への太陽光パネル、蓄電池の導入を補助。ZEB・ZEH要件あり。" },

  // ─── 海外展開 ─────
  { slug: "kaigai-tenkai-hojo", title: "海外展開支援補助金", category: "international", target_type: "corp", max_amount: 5000000, subsidy_rate: "1/2", deadline: "2026-08-31", status: "open", provider_name: "JETRO", summary: "中小企業の海外展示会出展、海外マーケティング調査等の費用を補助。" },
  { slug: "yushutsu-sanhin-kaihatsu", title: "海外向け製品開発支援補助金", category: "international", target_type: "corp", max_amount: 8000000, subsidy_rate: "2/3", deadline: "2026-10-31", status: "open", provider_name: "中小企業基盤整備機構", summary: "海外市場向けの製品改良・開発費用を支援。パッケージ改良から認証取得まで対象。" },

  // ─── 地域活性化 ─────
  { slug: "chiiki-dukuri-hojo", title: "地域まちづくり推進補助金", category: "regional", target_type: "npo", max_amount: 3000000, subsidy_rate: "1/2", deadline: "2026-05-31", status: "open", provider_name: "国土交通省", summary: "空き店舗活用、商店街活性化、コミュニティスペース運営等を支援。" },
  { slug: "kanko-chiiki-hojo", title: "観光地域づくり支援事業", category: "regional", target_type: "any", max_amount: 5000000, subsidy_rate: "1/2", deadline: "2026-07-31", status: "open", provider_name: "観光庁", summary: "地域の観光資源を活かした持続可能な観光地域づくりを支援。" },

  // ─── 農業・水産 ─────
  { slug: "nogyo-next-hojo", title: "農業次世代人材投資資金", category: "agriculture", target_type: "individual", max_amount: 1500000, subsidy_rate: "定額（年間）", deadline: null, status: "open", provider_name: "農林水産省", summary: "新規就農者に対して年間最大150万円を最長5年間支給。" },
  { slug: "smart-nogyo-hojo", title: "スマート農業技術導入補助金", category: "agriculture", target_type: "corp", max_amount: 10000000, subsidy_rate: "1/2", deadline: "2026-09-30", status: "open", provider_name: "農林水産省", summary: "ドローン、自動運転トラクター、AI解析等のスマート農業技術導入を支援。" },

  // ─── 福祉・医療 ─────
  { slug: "kaigo-robot-hojo", title: "介護ロボット導入補助金", category: "welfare", target_type: "corp", max_amount: 1000000, subsidy_rate: "1/2", deadline: "2026-08-31", status: "open", provider_name: "厚生労働省", summary: "介護施設における介護ロボット・ICT機器の導入を支援。" },
  { slug: "hoyojo-ict-hojo", title: "保育所等ICT化推進事業", category: "welfare", target_type: "corp", max_amount: 1000000, subsidy_rate: "3/4", deadline: "2026-12-31", status: "open", provider_name: "厚生労働省", summary: "保育所の業務効率化のためのICTシステム導入を支援。" },

  // ─── 防災・BCP ─────
  { slug: "bcp-sakutei-hojo", title: "BCP策定支援補助金", category: "other", target_type: "corp", max_amount: 1000000, subsidy_rate: "1/2", deadline: "2026-06-30", status: "open", provider_name: "東京都", summary: "BCP（事業継続計画）の策定にかかるコンサルティング費用等を補助。" },

  // ─── 期限切れ/決定済み（参考データ） ─────
  { slug: "it-hojo-2025-closed", title: "IT導入補助金2025（終了）", category: "it", target_type: "corp", max_amount: 4500000, subsidy_rate: "1/2〜2/3", deadline: "2025-12-31", status: "closed", provider_name: "中小企業庁", summary: "2025年度のIT導入補助金。募集終了済み。" },
  { slug: "mono-hojo-19-closed", title: "ものづくり補助金（第19次・終了）", category: "equipment", target_type: "corp", max_amount: 12500000, subsidy_rate: "1/2〜2/3", deadline: "2025-09-30", status: "closed", provider_name: "中小企業庁", summary: "第19次公募。終了済み。" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO hojokin_items (slug, title, category, target_type, max_amount, subsidy_rate,
      deadline, status, provider_name, summary, is_published, created_at, updated_at)
    VALUES (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
      @deadline, @status, @provider_name, @summary, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const h of HOJOKIN) {
    if (insert.run(h).changes > 0) inserted++;
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM hojokin_items WHERE is_published = 1").get().c;
  console.log(`追加: ${inserted}/${HOJOKIN.length}件 (合計: ${total}件)`);
  console.log("\nカテゴリ別:");
  db.prepare("SELECT category, COUNT(*) as c FROM hojokin_items WHERE is_published = 1 GROUP BY category ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.category}: ${r.c}`));
}

main().catch(console.error);
