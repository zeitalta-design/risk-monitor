/**
 * サイト共通設定（ブランド定義）
 * サービス名やURLをここに集約し、各所から参照する
 */

export const siteConfig = {
  /** サービス名 */
  siteName: "Risk Monitor",
  /** サービス名（英語） */
  siteNameEn: "Risk Monitor",
  /** サービス説明 */
  siteDescription: "企業リスク監視プラットフォーム — 行政処分・入札情報・補助金など、業務で使える公開データを横断検索",
  /** キャッチコピー */
  tagline: "企業リスク監視プラットフォーム",
  /** サイトURL */
  siteUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  /** ロゴ画像パス */
  logoImage: "/banner_logo.png",
  /** メール送信者名 */
  mailFrom: process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.jp>",
  /** メール件名プレフィックス */
  emailPrefix: "【Risk Monitor】",
  /** メールフッター署名 */
  emailSignature: "Risk Monitor — 企業リスク監視プラットフォーム",
};
