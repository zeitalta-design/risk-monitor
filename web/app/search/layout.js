import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "大会を探す",
  description:
    "全国のマラソン・ランニング大会を大会名・開催地・種目・距離・開催月で検索。あなたにぴったりの大会が見つかります。",
  openGraph: {
    title: `大会を探す | ${siteConfig.siteName}`,
    description:
      "全国のマラソン・ランニング大会を大会名・開催地・種目・距離・開催月で検索。あなたにぴったりの大会が見つかります。",
  },
  alternates: {
    canonical: `${siteConfig.siteUrl}/search`,
  },
};

export default function SearchLayout({ children }) {
  return children;
}
