"use client";

/**
 * 汎用ページネーション（省略記号つき）
 *
 * Props:
 *   - currentPage: number
 *   - totalPages: number
 *   - onPageChange: (page: number) => void
 */
export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) {
        end = Math.min(maxVisible, totalPages - 1);
      } else if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - maxVisible + 1);
      }
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="mt-8 flex flex-col items-center gap-3" aria-label="ページネーション">
      <div className="hidden sm:flex items-center gap-1">
        <PaginationButton onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="最初のページへ">
          &laquo;
        </PaginationButton>
        <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="前のページへ">
          &lsaquo; 前へ
        </PaginationButton>
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm select-none">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 px-2 text-sm rounded-lg font-medium transition-colors ${
                p === currentPage ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <PaginationButton onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="次のページへ">
          次へ &rsaquo;
        </PaginationButton>
        <PaginationButton onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} aria-label="最後のページへ">
          &raquo;
        </PaginationButton>
      </div>
      <div className="flex sm:hidden items-center gap-3">
        <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          &lsaquo; 前へ
        </PaginationButton>
        <span className="text-sm text-gray-600 font-medium">{currentPage} / {totalPages}</span>
        <PaginationButton onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          次へ &rsaquo;
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({ onClick, disabled, children, ...props }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-9 px-3 text-sm rounded-lg font-medium transition-colors ${
        disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
