/**
 * サイト共通設定（ブランド定義）
 * サービス名やURLをここに集約し、各所から参照する
 */

export const siteConfig = {
  /** サービス名（日本語） */
  siteName: "大海ナビ",
  /** サービス名（英語） */
  siteNameEn: "TAIKAI NAVI",
  /** サービス説明 */
  siteDescription: "公開データ / 業務DBカタログ — インターネットという大海原から、業務で使える情報を見つけやすく整理しています",
  /** キャッチコピー */
  tagline: "公開データ / 業務DBカタログ",
  /** サイトURL */
  siteUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  /** ロゴ画像パス */
  logoImage: "/banner_logo.png",
  /** メール送信者名 */
  mailFrom: process.env.MAIL_FROM || "大海ナビ <noreply@taikainavi.jp>",
  /** メール件名プレフィックス */
  emailPrefix: "【大海ナビ】",
  /** メールフッター署名 */
  emailSignature: "大海ナビ — 公開データ / 業務DBカタログ",
};
