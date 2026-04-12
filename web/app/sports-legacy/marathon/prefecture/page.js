import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { REGION_GROUPS, PREFECTURE_SLUGS } from "@/lib/seo-mappings";

export const metadata = {
  title: "都道府県別マラソン大会",
  description: "都道府県ごとにマラソン大会を探せます。お住まいの地域や旅先の大会をチェックしましょう。",
  openGraph: {
    title: "都道府県別マラソン大会 | Risk Monitor",
    description: "全国47都道府県のマラソン大会を地域ごとに探せます。",
    type: "website",
  },
};

export default function PrefectureIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "マラソン", href: "/marathon" },
          { label: "都道府県別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">都道府県別マラソン大会</h1>
      <p className="text-sm text-gray-500 mb-8">地域を選んでマラソン大会を探せます</p>

      <div className="space-y-8">
        {REGION_GROUPS.map((region) => (
          <div key={region.label}>
            <h2 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">
              {region.label}
            </h2>
            <div className="flex flex-wrap gap-2">
              {region.slugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/marathon/prefecture/${slug}`}
                  className="inline-block px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg
                             hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                >
                  {PREFECTURE_SLUGS[slug]}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
