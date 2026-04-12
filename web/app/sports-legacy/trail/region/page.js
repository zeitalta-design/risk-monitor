import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { REGION_SLUGS } from "@/lib/seo-config";

export const metadata = {
  title: "地方別トレイルラン大会",
  description: "北海道から九州・沖縄まで、地方別にトレイルラン大会を探せます。お住まいの地域の大会をチェックしましょう。",
  openGraph: {
    title: "地方別トレイルラン大会 | Risk Monitor",
    description: "全国8地方のトレイルラン大会を地域ごとに探せます。",
    type: "website",
  },
};

export default function TrailRegionIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "トレイルラン", href: "/trail" },
          { label: "地方別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">地方別トレイルラン大会</h1>
      <p className="text-sm text-gray-500 mb-8">地方を選んでトレイルラン大会を探せます</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(REGION_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/trail/region/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block"
          >
            <h2 className="font-bold text-gray-900 text-lg mb-2">{info.label}</h2>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{info.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/trail/prefecture"
          className="text-sm text-green-600 hover:text-green-800 hover:underline"
        >
          都道府県別で探す →
        </Link>
      </div>
    </div>
  );
}
