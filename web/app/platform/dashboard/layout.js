import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "プラットフォーム ダッシュボード",
  description:
    "全ドメインの統計・新着・ランキングを一覧できるデータプラットフォームのダッシュボード",
  openGraph: {
    title: `プラットフォーム ダッシュボード | ${siteConfig.siteName}`,
    description:
      "全ドメインの統計・新着・ランキングを一覧できるデータプラットフォームのダッシュボード",
  },
  alternates: {
    canonical: `${siteConfig.siteUrl}/platform/dashboard`,
  },
};

export default function DashboardLayout({ children }) {
  return children;
}
