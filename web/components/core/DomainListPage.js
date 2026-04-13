"use client";

/**
 * ドメイン共通の一覧ページ骨格コンポーネント
 *
 * 一覧ページに共通する責務（レイアウト、ヘッダー、loading/empty/error 分岐、
 * カード描画ループ、ページネーション、slot）を集約する。
 *
 * データ取得、フィルタ UI、カード本体、お気に入り/比較ロジックは
 * 各ドメインページに残し、slot / renderItem で委譲する。
 *
 * 現在 SaaS 一覧で使用。将来の他カテゴリにも適用可能な props 設計。
 *
 * @example
 *   <DomainListPage
 *     title="SaaSツール一覧"
 *     subtitle={`${total}件のツール`}
 *     items={items}
 *     loading={loading}
 *     renderItem={(item) => <ItemCard key={item.id} item={item} />}
 *     renderFilters={() => <FilterSidebar ... />}
 *     emptyState={<div>見つかりません</div>}
 *     page={page}
 *     totalPages={totalPages}
 *     onPageChange={setPage}
 *     layout="sidebar"
 *     bottomBar={<DomainCompareBar ... />}
 *   />
 */

/**
 * @param {Object} props
 * @param {string} props.title - ページタイトル
 * @param {string|React.ReactNode} [props.subtitle] - 件数表示など
 * @param {Array} props.items - 表示対象アイテム
 * @param {boolean} props.loading - ローディング中か
 * @param {(item: any) => React.ReactNode} props.renderItem - カード描画関数
 * @param {() => React.ReactNode} [props.renderFilters] - フィルタ UI slot
 * @param {() => React.ReactNode} [props.renderSort] - ソート UI slot
 * @param {() => React.ReactNode} [props.renderSkeleton] - ローディング骨格（デフォルトあり）
 * @param {React.ReactNode} [props.emptyState] - 0件時の表示
 * @param {number} props.page - 現在ページ
 * @param {number} props.totalPages - 総ページ数
 * @param {(page: number) => void} props.onPageChange - ページ変更ハンドラ
 * @param {React.ReactNode} [props.footerSlot] - SEO内部リンク等
 * @param {React.ReactNode} [props.bottomBar] - CompareBar 等固定バー
 * @param {"sidebar"|"stacked"} [props.layout="stacked"] - フィルタ配置
 * @param {React.ReactNode} [props.error] - エラー時表示
 * @param {React.ReactNode} [props.headerSlot] - ヘッダーとメインの間に挿入する任意コンテンツ
 */
export default function DomainListPage({
  title,
  subtitle,
  items,
  loading,
  renderItem,
  renderFilters,
  renderSort,
  renderSkeleton,
  emptyState,
  page,
  totalPages,
  onPageChange,
  footerSlot,
  bottomBar,
  layout = "stacked",
  error,
  headerSlot,
}) {
  const showPagination = !loading && totalPages > 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ─── ヘッダー ──── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>

      {/* ─── ヘッダー下スロット（検索バー等） ──── */}
      {headerSlot}

      {/* ─── メインエリア ──── */}
      {layout === "sidebar" ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* サイドバーフィルタ */}
          {renderFilters && renderFilters()}

          {/* コンテンツ */}
          <div className="flex-1">
            {renderSort && renderSort()}
            <ListContent
              items={items}
              loading={loading}
              error={error}
              renderItem={renderItem}
              renderSkeleton={renderSkeleton}
              emptyState={emptyState}
            />
            {showPagination && (
              <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* stacked: フィルタが上部 */}
          {renderFilters && renderFilters()}
          {renderSort && renderSort()}
          <ListContent
            items={items}
            loading={loading}
            error={error}
            renderItem={renderItem}
            renderSkeleton={renderSkeleton}
            emptyState={emptyState}
          />
          {showPagination && (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </>
      )}

      {/* ─── フッタースロット（SEO内部リンク等） ──── */}
      {footerSlot}

      {/* ─── 固定下部バー（CompareBar等） ──── */}
      {bottomBar}
    </div>
  );
}

// ─── 内部: リスト描画分岐 ──────────────────────

function ListContent({ items, loading, error, renderItem, renderSkeleton, emptyState }) {
  if (loading) {
    return renderSkeleton ? renderSkeleton() : <DefaultSkeleton />;
  }

  if (error) {
    return error;
  }

  if (!items || items.length === 0) {
    return emptyState || (
      <div className="card p-8 text-center">
        <p className="text-gray-500">該当するアイテムが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => renderItem(item))}
    </div>
  );
}

// ─── 内部: デフォルトスケルトン ──────────────────

function DefaultSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ─── 内部: ページネーション ──────────────────────

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {page > 1 && (
        <button
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary text-xs"
        >
          前へ
        </button>
      )}
      <span className="text-sm text-gray-500">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <button
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary text-xs"
        >
          次へ
        </button>
      )}
    </div>
  );
}
