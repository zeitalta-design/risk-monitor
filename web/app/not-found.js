import Link from "next/link";

export const metadata = {
  title: "ページが見つかりません | Risk Monitor",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* アイコン */}
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>

        <p className="text-5xl font-black text-gray-200 mb-3">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          お探しのページが見つかりませんでした
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          URLが変更されたか、ページが存在しない可能性があります。<br />
          行政処分DBの検索やトップページからお探しの情報にアクセスできます。
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Link
            href="/gyosei-shobun"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            行政処分DBを検索する
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            トップページへ戻る
          </Link>
        </div>

        {/* 補足リンク */}
        <div className="border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 mb-3">お探しの情報はこちらにあるかもしれません</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { href: "/gyosei-shobun", label: "行政処分DB" },
              { href: "/gyosei-shobun/favorites", label: "お気に入り" },
              { href: "/gyosei-shobun/compare", label: "比較" },
              { href: "/login", label: "ログイン" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
