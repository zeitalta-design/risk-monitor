"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * トップページ — 公開データポータル入口
 * 既存9ドメインの一覧ページへの導線を表示する
 */

// タイプ別カラー
const TYPE_STYLES = {
  "監視型": { bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
  "公募型": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  "検索型": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  "比較型": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
};

function DomainCard({ domain }) {
  const ts = TYPE_STYLES[domain.type] || TYPE_STYLES["検索型"];

  return (
    <Link href={domain.path} className="group block">
      <div
        className="h-full overflow-hidden rounded-xl bg-white border border-gray-100
                    shadow-sm hover:shadow-lg hover:-translate-y-1
                    transition-all duration-300 flex flex-col"
      >
        {/* ヘッダー */}
        <div className="p-5 pb-3 flex items-start gap-3.5">
          <span className="text-3xl flex-shrink-0 mt-0.5">{domain.icon}</span>
          <div className="min-w-0">
            <h3
              className="font-bold text-[15px] leading-snug group-hover:text-blue-700
                         transition-colors line-clamp-1"
              style={{ color: "#1a1a1a" }}
            >
              {domain.label}
            </h3>
            <span
              className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5
                          rounded border ${ts.bg} ${ts.text} ${ts.border}`}
            >
              {domain.type}
            </span>
          </div>
        </div>

        {/* 説明 */}
        <div className="px-5 pb-3 flex-1">
          <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: "#666" }}>
            {domain.description}
          </p>
        </div>

        {/* フッター: 件数 + CTA */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-gray-50">
          {domain.count > 0 ? (
            <span className="text-xs font-medium" style={{ color: "#888" }}>
              <span className="font-bold text-sm" style={{ color: "#444" }}>
                {domain.count.toLocaleString()}
              </span>{" "}
              件公開中
            </span>
          ) : (
            <span className="text-xs" style={{ color: "#bbb" }}>データ準備中</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
            一覧を見る
            <svg
              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [domains, setDomains] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    fetch("/api/platform/overview")
      .then((r) => r.json())
      .then((data) => {
        setDomains(data.domains || []);
        setTotalItems(data.totalItems || 0);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ── ヒーロー ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(100,150,255,0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(100,200,255,0.2), transparent 50%)",
          }}
        />
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 text-center">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          >
            公開データを、もっと見やすく
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/70 font-medium max-w-lg mx-auto">
            行政公開情報・許認可・入札・リコール・補助金など
            {totalItems > 0 && (
              <span className="inline-flex items-center ml-1">
                —{" "}
                <span className="font-extrabold text-white ml-1 text-lg sm:text-xl" style={{ lineHeight: 1 }}>
                  {totalItems.toLocaleString()}
                </span>
                <span className="ml-0.5 text-white/70">件</span>
              </span>
            )}
          </p>
        </div>
      </section>

      {/* ── ドメイン一覧 ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-7 bg-blue-600 rounded-full" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "#1a1a1a" }}>
              カテゴリから探す
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              各ドメインの一覧・検索ページへ
            </p>
          </div>
        </div>

        {domains.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.map((d) => (
              <DomainCard key={d.id} domain={d} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        )}
      </section>

      {/* ── 横断検索への導線 ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <Link
          href="/platform/search"
          className="block rounded-xl border border-gray-200 bg-white p-6 sm:p-8
                     hover:border-blue-200 hover:shadow-md transition-all text-center group"
        >
          <p className="text-sm font-semibold" style={{ color: "#444" }}>
            横断検索
          </p>
          <p className="mt-1.5 text-lg sm:text-xl font-bold group-hover:text-blue-700 transition-colors" style={{ color: "#1a1a1a" }}>
            すべてのデータを横断して検索する
          </p>
          <p className="mt-2 text-xs" style={{ color: "#999" }}>
            複数ドメインをまたいでキーワード検索
          </p>
        </Link>
      </section>
    </>
  );
}
