import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 上段: ロゴ + ナビリンク */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1E3A8A] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: "#1E3A8A" }}>Risk Monitor</span>
            <span className="text-xs text-gray-400 ml-1">企業リスク監視プラットフォーム</span>
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

        {/* 法的注記 */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 leading-relaxed max-w-3xl">
            本サイトは官公庁が公開している情報を基に整理・提供しています。データの正確性・完全性を保証するものではありません。
            最新の情報は各行政機関の公式発表をご確認ください。掲載情報の利用により生じた損害について、当サイトは一切の責任を負いません。
          </p>
        </div>

        {/* コピーライト */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">&copy; 2026 Risk Monitor</p>
        </div>
      </div>
    </footer>
  );
}
