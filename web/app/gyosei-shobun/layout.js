import { Suspense } from "react";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "行政処分DB — 企業の行政処分情報を横断検索",
  description:
    "建設業・不動産業・廃棄物処理業・運送業など、各業種の行政処分情報を横断検索できるデータベース。処分種別・都道府県・年度で絞り込み。リスク監視・取引先審査に。",
  keywords: [
    "行政処分", "行政処分 検索", "建設業 処分", "不動産 処分",
    "営業停止", "免許取消", "改善命令", "国交省 処分",
    "企業リスク", "取引先審査", "コンプライアンス",
  ],
  openGraph: {
    title: `行政処分DB | ${siteConfig.siteName}`,
    description:
      "建設業・不動産業・廃棄物処理業・運送業など、各業種の行政処分情報を横断検索。リスク監視・取引先審査に。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: `行政処分DB | ${siteConfig.siteName}`,
    description: "各業種の行政処分情報を横断検索できるデータベース。リスク監視・取引先審査に。",
  },
};

// JSON-LD: Dataset + BreadcrumbList
const datasetJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "行政処分データベース",
  alternateName: "行政処分DB",
  description: "建設業・不動産業・廃棄物処理業・運送業などに対する行政処分（許可取消・営業停止・改善命令等）の横断検索データベース。国土交通省および各都道府県の公開情報をもとに構築。",
  url: `${siteConfig.siteUrl}/gyosei-shobun`,
  license: "https://creativecommons.org/publicdomain/mark/1.0/",
  creator: {
    "@type": "Organization",
    name: siteConfig.siteName,
    url: siteConfig.siteUrl,
  },
  spatialCoverage: { "@type": "Place", name: "日本" },
  temporalCoverage: "2020/..",
  keywords: [
    "行政処分", "建設業", "不動産業", "廃棄物処理業",
    "許可取消", "営業停止", "改善命令", "国交省",
  ],
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "text/html",
    contentUrl: `${siteConfig.siteUrl}/gyosei-shobun`,
  },
});

const breadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "トップ", item: siteConfig.siteUrl },
    { "@type": "ListItem", position: 2, name: "行政処分DB", item: `${siteConfig.siteUrl}/gyosei-shobun` },
  ],
});

export default function GyoseiShobunLayout({ children }) {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-500">読み込み中...</div>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: datasetJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {children}
    </Suspense>
  );
}
