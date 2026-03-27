import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "行政処分DB",
  description:
    "建設業・運送業・廃棄物処理業・派遣業など、各業種の行政処分情報を横断検索できるデータベース",
  openGraph: {
    title: `行政処分DB | ${siteConfig.siteName}`,
    description:
      "建設業・運送業・廃棄物処理業・派遣業など、各業種の行政処分情報を横断検索できるデータベース",
  },
};

export default function GyoseiShobunLayout({ children }) {
  return children;
}
