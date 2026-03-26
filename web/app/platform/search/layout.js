import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "横断検索",
  description:
    "全ドメインのデータをキーワードで横断検索。食品リコール・指定管理・産廃・許認可・SaaS・補助金を一括検索できます。",
  openGraph: {
    title: `横断検索 | データプラットフォーム | ${siteConfig.siteName}`,
    description:
      "全ドメインのデータをキーワードで横断検索。食品リコール・指定管理・産廃・許認可・SaaS・補助金を一括検索できます。",
  },
  alternates: {
    canonical: `${siteConfig.siteUrl}/platform/search`,
  },
};

export default function PlatformSearchLayout({ children }) {
  return children;
}
