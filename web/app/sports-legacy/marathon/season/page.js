import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SEASON_SLUGS } from "@/lib/seo-config";

export const metadata = {
  title: "季節別マラソン大会",
  description: "春・夏・秋・冬の季節ごとにマラソン大会を探せます。シーズンに合った大会を見つけましょう。",
  openGraph: {
    title: "季節別マラソン大会 | Risk Monitor",
    description: "春夏秋冬の季節別にマラソン大会を探せます。",
    type: "website",
  },
};

const SEASON_ICONS = { spring: "🌸", summer: "🌻", autumn: "🍁", winter: "❄️" };

export default function SeasonIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "マラソン", href: "/marathon" },
          { label: "季節別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">季節別マラソン大会</h1>
      <p className="text-sm text-gray-500 mb-8">シーズンから大会を探せます</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(SEASON_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/marathon/season/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block text-center"
          >
            <div className="text-3xl mb-2">{SEASON_ICONS[slug]}</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">{info.label}の大会</h2>
            <p className="text-xs text-gray-500">
              {info.months.map((m) => `${m}月`).join("・")}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/marathon/month"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          月別で探す →
        </Link>
      </div>
    </div>
  );
}
