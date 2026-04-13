"use client";

/**
 * ドメイン共通の詳細ページ骨格コンポーネント
 *
 * 詳細ページに共通する責務（レイアウト、パンくず、ヘッダーカード、
 * loading/notFound 分岐、コンテンツ slot、フッター）を集約する。
 *
 * セクション中身、SEO、データ取得は各ドメインページに残し、
 * children / slot で委譲する。
 *
 * 現在 saas で使用。将来の他カテゴリにも適用可能。
 *
 * @param {Object} props
 * @param {boolean} [props.loading=false] - ローディング中か
 * @param {React.ReactNode} [props.notFound] - not found 時の表示（指定時は他を描画しない）
 * @param {React.ReactNode} [props.breadcrumb] - パンくず slot
 * @param {React.ReactNode} [props.icon] - ヘッダーアイコン（16x16 枠）
 * @param {string} [props.title] - h1 タイトル
 * @param {string|React.ReactNode} [props.subtitle] - プロバイダ名等
 * @param {React.ReactNode} [props.meta] - バッジ、カテゴリ表示
 * @param {React.ReactNode} [props.actions] - favorite / compare / 外部リンクボタン
 * @param {React.ReactNode} [props.children] - コンテンツセクション
 * @param {React.ReactNode} [props.footerSlot] - 下部導線（戻るリンク等）
 * @param {() => React.ReactNode} [props.renderSkeleton] - カスタムローディング
 */
export default function DomainDetailPage({
  loading = false,
  notFound,
  breadcrumb,
  icon,
  title,
  subtitle,
  meta,
  actions,
  children,
  footerSlot,
  renderSkeleton,
}) {
  // ─── ローディング ─────
  if (loading) {
    return renderSkeleton ? renderSkeleton() : <DefaultSkeleton />;
  }

  // ─── Not Found ─────
  if (notFound) {
    return notFound;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* パンくず */}
      {breadcrumb && (
        <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          {breadcrumb}
        </nav>
      )}

      {/* ヘッダーカード */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-3xl shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                {title && (
                  <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                )}
                {meta && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {meta}
                  </div>
                )}
              </div>
              {actions && (
                <div className="flex flex-col gap-2 shrink-0">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* コンテンツセクション */}
      {children}

      {/* フッター */}
      {footerSlot}
    </div>
  );
}

// ─── デフォルトスケルトン ───────────────────

function DefaultSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
