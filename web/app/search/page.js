"use client";

/**
 * /search — 大会検索ページ
 *
 * ヘッダーの「大会を探す」からの遷移先。
 * HomeSearchBar を活用し、大会名・エリア・開催月・種目で検索できる。
 */

import HomeSearchBar from "@/components/home/HomeSearchBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";

const QUICK_LINKS = [
  { label: "🏃 マラソン大会一覧", href: "/marathon" },
  { label: "🌲 トレイルラン", href: "/trail" },
  { label: "🔥 人気の大会", href: "/popular" },
  { label: "⏰ 締切間近", href: "/entry-deadlines" },
  { label: "🔰 初心者向け", href: "/marathon/theme/beginner" },
  { label: "📅 開催カレンダー", href: "/calendar" },
];

export default function SearchPage() {
  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会を探す" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* 検索バー（HomeSearchBar再利用） */}
      <div className="mt-2">
        <HomeSearchBar standalone />
      </div>

      {/* クイック導線 */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-gray-700 mb-3">よく使われる探し方</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl
                         hover:bg-blue-50 hover:border-blue-200 border border-gray-100
                         transition-colors text-sm font-medium text-gray-700 hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
