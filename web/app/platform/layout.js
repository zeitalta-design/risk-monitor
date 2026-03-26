import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: {
    default: "データプラットフォーム",
    template: `%s | ${siteConfig.siteName}`,
  },
  description:
    "食品リコール・指定管理・産廃・許認可・SaaS・補助金など、複数ドメインのデータを横断的に検索・比較できるプラットフォーム",
  openGraph: {
    title: `データプラットフォーム | ${siteConfig.siteName}`,
    description:
      "食品リコール・指定管理・産廃・許認可・SaaS・補助金など、複数ドメインのデータを横断的に検索・比較できるプラットフォーム",
  },
  alternates: {
    canonical: `${siteConfig.siteUrl}/platform`,
  },
};

export default function PlatformLayout({ children }) {
  return children;
}
