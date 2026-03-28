"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
// v2: carousel with arrow navigation

/**
 * 共通カルーセルセクション — トップページのランキング系セクション用
 *
 * PC: 4枚表示 + 矢印で横スライド
 * タブレット: 2〜3枚
 * モバイル: 1.2枚 + 横スクロール
 */
export default function EventCarouselSection({
  title,
  subtitle,
  accentColor = "#2563eb",
  moreHref,
  moreLabel = "もっと見る",
  children,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, children]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    // 1カード分の幅 + gap でスクロール量を算出
    const card = el.querySelector("[data-carousel-card]");
    if (!card) return;
    const gap = 16; // gap-4 = 16px
    const amount = (card.offsetWidth + gap) * 4; // 4枚分
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-7 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <div>
            <h2
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ color: "#1a1a1a" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* PC用矢印ボタン */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              aria-label="前のカードを表示"
              className="w-9 h-9 flex items-center justify-center rounded-full border
                         transition-all duration-200
                         disabled:opacity-0 disabled:pointer-events-none
                         border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300
                         text-gray-500 hover:text-gray-700 shadow-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              aria-label="次のカードを表示"
              className="w-9 h-9 flex items-center justify-center rounded-full border
                         transition-all duration-200
                         disabled:opacity-0 disabled:pointer-events-none
                         border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300
                         text-gray-500 hover:text-gray-700 shadow-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
          {moreHref && (
            <Link
              href={moreHref}
              className="text-xs font-medium transition-colors"
              style={{ color: accentColor }}
            >
              {moreLabel} →
            </Link>
          )}
        </div>
      </div>

      {/* ── カードスクロールエリア ── */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
