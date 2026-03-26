import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "横断検索",
  description:
    "食品リコール・指定管理・産廃・許認可・SaaS・補助金など、全ドメインのデータをキーワードで横断検索できます。",
  openGraph: {
    title: `横断検索 | ${siteConfig.siteName}`,
    description:
      "食品リコール・指定管理・産廃・許認可・SaaS・補助金など、全ドメインのデータをキーワードで横断検索できます。",
  },
  alternates: {
    canonical: `${siteConfig.siteUrl}/search`,
  },
};

export default function SearchLayout({ children }) {
  return children;
}
