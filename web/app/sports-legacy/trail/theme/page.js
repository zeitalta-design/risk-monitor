import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { TRAIL_THEME_SLUGS } from "@/lib/seo-config";

export const metadata = {
  title: "テーマ別トレイルラン大会",
  description: "初心者向け・絶景コース・締切間近など、目的に合ったトレイルラン大会を探せます。",
  openGraph: {
    title: "テーマ別トレイルラン大会 | Risk Monitor",
    description: "目的やテーマ別にトレイルラン大会を探せます。",
    type: "website",
  },
};

export default function TrailThemeIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "トレイルラン", href: "/trail" },
          { label: "テーマ別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">テーマ別トレイルラン大会</h1>
      <p className="text-sm text-gray-500 mb-8">目的に合ったトレイルラン大会を探せます</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(TRAIL_THEME_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/trail/theme/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{info.icon}</span>
              <h2 className="font-bold text-gray-900 text-lg">{info.shortLabel}</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{info.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
