/**
 * SaaSナビ レイアウト
 * /saas 配下の全ページに適用。既存スポーツアプリのレイアウトはそのまま維持。
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: {
    default: "SaaSナビ | ビジネスSaaSを比較・検討",
    template: "%s | SaaSナビ",
  },
  description: "SaaSナビは、ビジネス向けSaaSツールを比較・検討できるサービスです。",
};

export default function SaasLayout({ children }) {
  return children;
}
