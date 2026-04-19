/**
 * 企業詳細ページ（cross-domain ハブ /organizations/[id]）への導線カード。
 *
 * 5ドメイン詳細ページの CrossDomainLinks の直後に置き、
 * 「この企業の横断サマリーを見る」導線を明示する。
 *
 * Props:
 *   - organizationId?: number  organizations.id が既知なら優先
 *   - corp?: string            法人番号（id が無いとき fallback で /organizations?corp=X）
 *   - name?: string            表示用の企業名（subtitle）
 *
 * organizationId も corp も無ければ null（導線を出せない）。
 *
 * 実装メモ: 元は "use client" + next/link だったが、server component ページから
 * 使われると dev 環境で「Lazy element type must resolve to a class or function」
 * エラーが出るケースがあったため、SSR 完結の plain <a> に変更。
 */
import Link from "next/link";

export default function OrganizationHubLink({ organizationId, corp, name }) {
  if (!organizationId && !corp) return null;
  const href = organizationId
    ? `/organizations/${organizationId}`
    : `/organizations?corp=${encodeURIComponent(corp)}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 p-4 mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 to-white hover:border-blue-400 hover:shadow-sm transition-all"
    >
      <span className="text-2xl shrink-0" aria-hidden>🔗</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-gray-900">
          企業詳細（cross-domain ハブ）を開く
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {name ? `${name} の` : "この企業の"}入札 / 補助金 / 許認可 / 行政処分 / 産廃 横断サマリー
        </div>
      </div>
      <span className="text-blue-600 shrink-0 group-hover:translate-x-0.5 transition-transform">→</span>
    </Link>
  );
}
