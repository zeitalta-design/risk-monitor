import Link from "next/link";

/**
 * パンくずナビ + JSON-LD構造化データ
 * items: [{ label: "トップ", href: "/" }, { label: "マラソン", href: "/marathon" }, ...]
 * 最後の要素はリンクなし（現在のページ）
 */
export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;

  // BreadcrumbList JSON-LD: 全 ListItem に position + name。最後以外には item（絶対URL）。最後は item 省略（Google仕様準拠）
  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.APP_BASE_URL || "https://taikainavi.jp");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const entry = {
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
      };
      if (item.href) {
        entry.item = item.href.startsWith("http") ? item.href : `${baseUrl}${item.href}`;
      }
      return entry;
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="パンくずリスト" className="text-xs text-gray-500 mb-4">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-400">/</span>}
              {i < items.length - 1 && item.href ? (
                <Link href={item.href} className="hover:text-blue-600 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-600">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
