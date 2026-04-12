import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "月別マラソン大会",
  description: "開催月ごとにマラソン大会を探せます。シーズンに合わせて大会を見つけましょう。",
  openGraph: {
    title: "月別マラソン大会 | Risk Monitor",
    description: "1月〜12月の開催月別にマラソン大会を探せます。",
    type: "website",
  },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  label: `${i + 1}月`,
}));

const SEASONS = [
  { label: "春 (3〜5月)", months: [3, 4, 5] },
  { label: "夏 (6〜8月)", months: [6, 7, 8] },
  { label: "秋 (9〜11月)", months: [9, 10, 11] },
  { label: "冬 (12〜2月)", months: [12, 1, 2] },
];

export default function MonthIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "マラソン", href: "/marathon" },
          { label: "月別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">月別マラソン大会</h1>
      <p className="text-sm text-gray-500 mb-8">開催月から大会を探せます</p>

      <div className="space-y-6">
        {SEASONS.map((season) => (
          <div key={season.label}>
            <h2 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">
              {season.label}
            </h2>
            <div className="flex flex-wrap gap-3">
              {season.months.map((m) => (
                <Link
                  key={m}
                  href={`/marathon/month/${m}`}
                  className="inline-flex items-center justify-center w-20 h-12 text-sm font-medium text-gray-700
                             bg-white border border-gray-200 rounded-lg
                             hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                >
                  {m}月
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
