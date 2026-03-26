import Link from "next/link";

const NAV_ITEMS = [
  { href: "/platform", label: "トップ" },
  { href: "/platform/search", label: "横断検索" },
  { href: "/platform/dashboard", label: "ダッシュボード" },
];

/**
 * /platform 配下の共通ナビゲーション
 * @param {string} current - 現在のパス（アクティブ表示用）
 */
export default function PlatformNav({ current }) {
  return (
    <nav className="flex items-center gap-1 text-xs mb-6">
      {NAV_ITEMS.map((item, i) => {
        const isActive = current === item.href;
        return (
          <span key={item.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300 mx-0.5">/</span>}
            {isActive ? (
              <span className="text-gray-900 font-medium">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
