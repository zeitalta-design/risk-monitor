import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { TRAIL_DISTANCE_SLUGS } from "@/lib/seo-mappings";

export const metadata = {
  title: "距離別トレイルラン大会",
  description: "ショート・ミドル・ロングなど距離別にトレイルラン大会を探せます。",
  openGraph: {
    title: "距離別トレイルラン大会 | Risk Monitor",
    description: "距離で絞ってトレイルラン大会を探せます。ショート、ミドル、ロング対応。",
    type: "website",
  },
};

const TRAIL_DISTANCE_ADVICE = {
  short: "初めてのトレイルランにおすすめ",
  middle: "ステップアップしたい方に人気",
  long: "上級者向けの本格山岳レース",
};

const TRAIL_DISTANCE_ICONS = {
  short: "🌿",
  middle: "⛰️",
  long: "🏔️",
};

export default function TrailDistanceIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "トレイルラン", href: "/trail" },
          { label: "距離別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">距離別トレイルラン大会</h1>
      <p className="text-sm text-gray-500 mb-8">自分に合った距離のトレイルラン大会を探せます</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(TRAIL_DISTANCE_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/trail/distance/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block"
          >
            <div className="text-2xl mb-2">{TRAIL_DISTANCE_ICONS[slug]}</div>
            <h2 className="font-bold text-gray-900 text-lg mb-2">{info.shortLabel}</h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{info.description}</p>
            {TRAIL_DISTANCE_ADVICE[slug] && (
              <p className="text-xs text-green-600 font-medium">{TRAIL_DISTANCE_ADVICE[slug]}</p>
            )}
          </Link>
        ))}
      </div>

      {/* テーマ別への導線 */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">目的から探す</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/trail/theme/beginner" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
            初心者向け大会
          </Link>
          <Link href="/trail/theme/scenic" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
            絶景コース
          </Link>
          <Link href="/trail/theme/popular" className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
            人気の大会
          </Link>
        </div>
      </div>
    </div>
  );
}
