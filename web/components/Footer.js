import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 上段: ロゴ + ナビリンク */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🧭</span>
            <span className="font-bold text-sm" style={{ color: "#1A3F6B" }}>大海ナビ</span>
            <span className="text-xs text-gray-400 ml-1">公開データ / 業務DBカタログ</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-gray-800 transition-colors">利用規約</Link>
            <span className="text-gray-300 mx-1">|</span>
            <Link href="/privacy" className="hover:text-gray-800 transition-colors">プライバシー</Link>
            <span className="text-gray-300 mx-1">|</span>
            <Link href="/about-data" className="hover:text-gray-800 transition-colors">データについて</Link>
            <span className="text-gray-300 mx-1">|</span>
            <Link href="/contact" className="hover:text-gray-800 transition-colors">お問い合わせ</Link>
          </nav>
        </div>

        {/* 下段: コピーライト */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">&copy; 2026 大海ナビ (TAIKAI NAVI)</p>
        </div>
      </div>
    </footer>
  );
}
