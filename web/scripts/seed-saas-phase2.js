#!/usr/bin/env node
/**
 * SaaS比較ナビ Phase2 拡充 — 既存カテゴリ深堀り + 新カテゴリ追加
 * 目標: 51件 → 80件以上
 */

const NEW_SAAS = [
  // ─── CRM 追加 ─────
  { title: "Freshsales", slug: "freshsales", category: "crm", summary: "AI搭載のモダンCRM・営業管理", description: "FreshsalesはFreshworksが提供するAI搭載CRM。リード管理、営業パイプライン、メール追跡を統合。", url: "https://www.freshworks.com/crm/sales/", price_min: 0, price_max: 8300, popularity_score: 72, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "small", strengths: "AI搭載、無料プランあり、メール追跡", weaknesses: "日本語サポートが限定的", features: { "案件管理": "◎", "名刺管理": "△", "MA連携": "○", "API": "◎", "モバイル": "◎" } }) },

  // ─── プロジェクト管理 追加 ─────
  { title: "Todoist", slug: "todoist", category: "project", summary: "シンプルで強力なタスク管理アプリ", description: "Todoistは、個人からチームまで使えるシンプルなタスク管理ツール。自然言語入力が特徴。", url: "https://todoist.com/ja", price_min: 0, price_max: 888, popularity_score: 80, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "シンプル、自然言語入力、マルチプラットフォーム", weaknesses: "プロジェクト管理としては機能が限定的", features: { "ガント": "×", "カンバン": "◎", "工数管理": "×", "権限管理": "○", "外部連携": "◎" } }) },
  { title: "Jooto", slug: "jooto", category: "project", summary: "国産のカンバン型タスク管理", description: "Jootoは、日本発のカンバンボード型プロジェクト管理ツール。直感的な操作で中小企業に人気。", url: "https://www.jooto.com/", price_min: 0, price_max: 1780, popularity_score: 58, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "small", strengths: "日本語完全対応、シンプル、無料プランあり", weaknesses: "大規模向け機能は弱い", features: { "ガント": "○", "カンバン": "◎", "工数管理": "△", "権限管理": "○", "外部連携": "○" } }) },

  // ─── 会計 追加 ─────
  { title: "Misoca", slug: "misoca", category: "accounting", summary: "請求書作成の最短ルート", description: "Misocaは、弥生グループの請求書作成クラウドサービス。テンプレートから1分で請求書を作成。", url: "https://www.misoca.jp/", price_min: 0, price_max: 3300, popularity_score: 72, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "small", strengths: "無料プランあり、操作簡単、弥生連携", weaknesses: "会計機能は別途必要", features: { "請求書": "◎", "経費精算": "×", "銀行連携": "△", "電帳法": "◎", "API": "○" } }) },
  { title: "Staple", slug: "staple", category: "accounting", summary: "法人カード連動の経費精算", description: "Stapleは、法人プリペイドカードと連動した経費精算サービス。リアルタイムで経費を可視化。", url: "https://staple.jp/", price_min: 0, price_max: 0, popularity_score: 55, extension_json: JSON.stringify({ pricing_model: "contact", free_plan: false, trial: true, target_size: "medium", strengths: "カード連動、リアルタイム可視化、不正防止", weaknesses: "カード契約が前提、小規模には過剰", features: { "請求書": "△", "経費精算": "◎", "銀行連携": "◎", "電帳法": "◎", "API": "○" } }) },

  // ─── 人事 追加 ─────
  { title: "タレントパレット", slug: "talent-palette", category: "hr", summary: "科学的人事データ分析プラットフォーム", description: "タレントパレットは、人材データを統合分析し、適材適所や離職予防を支援するタレント管理システム。", url: "https://www.talent-palette.com/", price_min: 0, price_max: 0, popularity_score: 68, extension_json: JSON.stringify({ pricing_model: "contact", free_plan: false, trial: true, target_size: "enterprise", strengths: "データ分析が強い、離職予防、組織診断", weaknesses: "導入コスト高い、中小企業には過剰", features: { "勤怠管理": "×", "給与計算": "×", "年末調整": "×", "入退社": "○", "タレント管理": "◎" } }) },
  { title: "rakumo", slug: "rakumo", category: "hr", summary: "Google Workspace連携のバックオフィス", description: "rakumoは、Google Workspaceと連携した勤怠管理・経費精算・ワークフローのクラウドサービス。", url: "https://rakumo.com/", price_min: 300, price_max: 600, popularity_score: 55, extension_json: JSON.stringify({ pricing_model: "subscription", free_plan: false, trial: true, target_size: "small", strengths: "Google Workspace連携、低コスト、シンプル", weaknesses: "Google Workspace前提", features: { "勤怠管理": "◎", "給与計算": "×", "年末調整": "×", "入退社": "△", "タレント管理": "×" } }) },

  // ─── コミュニケーション 追加 ─────
  { title: "Discord", slug: "discord", category: "communication", summary: "コミュニティ・チーム向け音声チャット", description: "Discordは、音声・ビデオ・テキストチャットを統合したコミュニケーションプラットフォーム。ビジネス利用も増加中。", url: "https://discord.com/", price_min: 0, price_max: 1600, popularity_score: 85, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: false, target_size: "any", strengths: "無料で高品質音声、コミュニティ運営、ボット連携", weaknesses: "ビジネス特化ではない", features: { "チャット": "◎", "ビデオ会議": "◎", "ファイル共有": "○", "タスク管理": "×", "外部連携": "◎" } }) },
  { title: "Lark", slug: "lark", category: "communication", summary: "ByteDance提供の統合ワークスペース", description: "Larkは、チャット・ビデオ会議・ドキュメント・カレンダーを統合したオールインワンプラットフォーム。", url: "https://www.larksuite.com/ja_jp", price_min: 0, price_max: 1200, popularity_score: 65, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "無料で多機能、翻訳内蔵、スプレッドシート統合", weaknesses: "日本での知名度低い", features: { "チャット": "◎", "ビデオ会議": "◎", "ファイル共有": "◎", "タスク管理": "○", "外部連携": "○" } }) },

  // ─── MA 追加 ─────
  { title: "Mailchimp", slug: "mailchimp", category: "ma", summary: "世界最大級のメールマーケティング", description: "Mailchimpは、メール配信・LP作成・顧客セグメントを提供する世界最大級のマーケティングプラットフォーム。", url: "https://mailchimp.com/", price_min: 0, price_max: 4600, popularity_score: 82, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "無料プラン充実、グローバル、テンプレート豊富", weaknesses: "日本語サポートが弱い", features: { "メール配信": "◎", "LP作成": "◎", "リード管理": "○", "分析": "◎", "CRM連携": "○" } }) },
  { title: "SendGrid", slug: "sendgrid", category: "ma", summary: "メール配信基盤のグローバルリーダー", description: "SendGridは、トランザクションメールとマーケティングメールの配信基盤。API経由での大量配信に対応。", url: "https://sendgrid.com/", price_min: 0, price_max: 8980, popularity_score: 75, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "大量配信対応、API充実、到達率高い", weaknesses: "MA機能は限定的、開発者向け", features: { "メール配信": "◎", "LP作成": "×", "リード管理": "△", "分析": "○", "CRM連携": "○" } }) },

  // ─── 新カテゴリ: セキュリティ ─────
  { title: "1Password Business", slug: "1password-business", category: "security", summary: "チーム向けパスワード管理", description: "1Password Businessは、企業向けのパスワード管理ソリューション。SSO連携、管理コンソール、監査ログを提供。", url: "https://1password.com/jp/business/", price_min: 999, price_max: 999, popularity_score: 85, extension_json: JSON.stringify({ pricing_model: "subscription", free_plan: false, trial: true, target_size: "any", strengths: "使いやすいUI、SSO連携、セキュリティ高い", weaknesses: "無料プランなし", features: { "パスワード管理": "◎", "SSO": "◎", "監査ログ": "◎", "MFA": "◎", "管理コンソール": "◎" } }) },
  { title: "LastPass Business", slug: "lastpass-business", category: "security", summary: "エンタープライズ向けパスワード管理", description: "LastPass Businessは、ゼロナレッジ暗号化による企業向けパスワード・アクセス管理。ディレクトリ連携に対応。", url: "https://www.lastpass.com/products/business", price_min: 500, price_max: 900, popularity_score: 78, extension_json: JSON.stringify({ pricing_model: "subscription", free_plan: false, trial: true, target_size: "medium", strengths: "低コスト、ディレクトリ連携、多要素認証", weaknesses: "過去にセキュリティインシデント", features: { "パスワード管理": "◎", "SSO": "○", "監査ログ": "○", "MFA": "◎", "管理コンソール": "○" } }) },
  { title: "Keeper Business", slug: "keeper-business", category: "security", summary: "ゼロトラストのパスワード・秘密管理", description: "Keeper Businessは、ゼロトラスト・ゼロナレッジのパスワード管理と秘密管理を統合したセキュリティプラットフォーム。", url: "https://www.keepersecurity.com/ja_JP/business.html", price_min: 550, price_max: 1120, popularity_score: 70, extension_json: JSON.stringify({ pricing_model: "subscription", free_plan: false, trial: true, target_size: "any", strengths: "ゼロトラスト、秘密管理統合、コンプライアンス対応", weaknesses: "UIが複雑", features: { "パスワード管理": "◎", "SSO": "◎", "監査ログ": "◎", "MFA": "◎", "管理コンソール": "◎" } }) },
  { title: "Bitwarden Business", slug: "bitwarden-business", category: "security", summary: "オープンソースのパスワード管理", description: "Bitwardenは、オープンソースベースの透明性の高いパスワード管理ソリューション。セルフホスト可能。", url: "https://bitwarden.com/", price_min: 0, price_max: 600, popularity_score: 75, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "オープンソース、低コスト、セルフホスト可能", weaknesses: "UIがシンプルすぎる", features: { "パスワード管理": "◎", "SSO": "○", "監査ログ": "○", "MFA": "◎", "管理コンソール": "○" } }) },

  // ─── 新カテゴリ: BI/分析 ─────
  { title: "Tableau", slug: "tableau", category: "other", summary: "ビジュアル分析のデファクト", description: "Tableauは、Salesforce傘下のBIツール。ドラッグ&ドロップでデータの可視化・分析が可能。", url: "https://www.tableau.com/ja-jp", price_min: 8400, price_max: 10500, popularity_score: 88, extension_json: JSON.stringify({ pricing_model: "subscription", free_plan: false, trial: true, target_size: "enterprise", strengths: "ビジュアル分析No.1、Salesforce連携、大規模データ対応", weaknesses: "コスト高い、学習コスト高い" }) },
  { title: "Looker Studio", slug: "looker-studio", category: "other", summary: "Google提供の無料BIダッシュボード", description: "Looker Studio（旧Data Studio）は、Googleが無料提供するデータ可視化・レポートツール。", url: "https://lookerstudio.google.com/", price_min: 0, price_max: 0, popularity_score: 82, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: false, target_size: "any", strengths: "完全無料、Google連携、共有簡単", weaknesses: "高度な分析には限界" }) },
  { title: "Power BI", slug: "power-bi", category: "other", summary: "Microsoft提供のBI分析プラットフォーム", description: "Power BIは、Microsoftが提供するBIツール。Excel連携とAIインサイトが強力。", url: "https://powerbi.microsoft.com/ja-jp/", price_min: 0, price_max: 2700, popularity_score: 90, extension_json: JSON.stringify({ pricing_model: "freemium", free_plan: true, trial: true, target_size: "any", strengths: "Excel連携、AI分析、低コスト、Microsoft統合", weaknesses: "デザインの自由度はTableauに劣る" }) },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO items (title, slug, category, status, description, summary, url,
      price_min, price_max, popularity_score, extension_json, is_published, created_at, updated_at)
    VALUES (@title, @slug, @category, 'active', @description, @summary, @url,
      @price_min, @price_max, @popularity_score, @extension_json, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  for (const item of NEW_SAAS) {
    if (insert.run(item).changes > 0) inserted++;
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM items WHERE is_published = 1").get().c;
  console.log(`追加: ${inserted}/${NEW_SAAS.length}件 (合計: ${total}件)`);
  console.log("\nカテゴリ別:");
  db.prepare("SELECT category, COUNT(*) as c FROM items WHERE is_published = 1 GROUP BY category ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.category}: ${r.c}`));
}

main().catch(console.error);
