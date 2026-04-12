import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { DISTANCE_SLUGS } from "@/lib/seo-mappings";

export const metadata = {
  title: "距離別マラソン大会",
  description: "フルマラソン、ハーフマラソン、10km、5kmなど距離別にマラソン大会を探せます。",
  openGraph: {
    title: "距離別マラソン大会 | Risk Monitor",
    description: "距離で絞ってマラソン大会を探せます。フル、ハーフ、10km、5km、ウルトラ対応。",
    type: "website",
  },
};

const DISTANCE_ADVICE = {
  "5km": "初めてのレースにおすすめ",
  "10km": "ランニングに慣れてきた方に",
  half: "ステップアップしたい方に人気",
  full: "マラソンの王道を走りたい方に",
  ultra: "限界に挑戦したい上級者向け",
};

export default function DistanceIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "マラソン", href: "/marathon" },
          { label: "距離別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">距離別マラソン大会</h1>
      <p className="text-sm text-gray-500 mb-8">自分に合った距離のマラソン大会を探せます</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(DISTANCE_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/marathon/distance/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block"
          >
            <h2 className="font-bold text-gray-900 text-lg mb-2">{info.label}</h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{info.description}</p>
            {DISTANCE_ADVICE[slug] && (
              <p className="text-xs text-blue-600 font-medium">{DISTANCE_ADVICE[slug]}</p>
            )}
          </Link>
        ))}
      </div>

      {/* テーマ別への導線 */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">目的から探す</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/marathon/theme/beginner" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
            初心者向け大会
          </Link>
          <Link href="/marathon/theme/record" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
            記録狙いの大会
          </Link>
          <Link href="/marathon/theme/flat-course" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
            フラットコース
          </Link>
          <Link href="/marathon/theme/sightseeing" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
            観光ラン向け
          </Link>
        </div>
      </div>
    </div>
  );
}
