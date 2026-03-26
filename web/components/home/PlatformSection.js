"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function PlatformSection() {
  const [overview, setOverview] = useState(null);
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    fetch("/api/platform/overview")
      .then((r) => r.json())
      .then((data) => {
        console.log("[PlatformSection] loaded:", data?.domains?.length, "domains");
        setOverview(data);
      })
      .catch(() => {});

    fetch("/api/platform/feed")
      .then((r) => r.json())
      .then((d) => {
        console.log("[PlatformSection] feed loaded:", d?.feed?.length, "items");
        setFeed(d);
      })
      .catch((err) => console.error("[PlatformSection] feed error:", err));
  }, []);

  if (!overview || !overview.domains) return null;

  const typeColors = {
    "監視型": "bg-red-50 text-red-700 border-red-200",
    "公募型": "bg-blue-50 text-blue-700 border-blue-200",
    "検索型": "bg-green-50 text-green-700 border-green-200",
    "比較型": "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-gray-900">データプラットフォーム</h2>
        <p className="text-sm text-gray-500 mt-1">
          {overview.totalItems.toLocaleString()}件以上のデータを横断検索・比較
        </p>
        <Link href="/platform/dashboard" className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 hover:text-blue-800 hover:underline">
          📊 ダッシュボードで全体を見る →
        </Link>
      </div>

      {/* 横断検索 */}
      <div className="max-w-xl mx-auto mb-8">
        <Link href="/platform/search" className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-5 py-3.5 hover:border-blue-400 transition-colors group">
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm text-gray-400 group-hover:text-gray-600">全ドメインを横断検索...</span>
          <span className="ml-auto text-xs text-gray-300">→</span>
        </Link>
      </div>

      {/* ドメインカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {overview.domains.map((d) => (
          <Link key={d.id} href={d.path} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{d.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 truncate">{d.label}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${typeColors[d.type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {d.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{d.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-blue-600">{d.count.toLocaleString()}件</span>
                  {d.recentCount > 0 && (
                    <span className="text-green-600">+{d.recentCount} 新着</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 用途別導線 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "監視・追跡", icon: "🔍", desc: "リコール/処分/補助金", links: ["/food-recall", "/sanpai", "/hojokin"] },
          { label: "公募・応募", icon: "📝", desc: "指定管理/補助金", links: ["/shitei", "/hojokin"] },
          { label: "事業者検索", icon: "🏢", desc: "許認可/建設業者", links: ["/kyoninka"] },
          { label: "比較・検索", icon: "💻", desc: "SaaS/優待/民泊", links: ["/saas", "/yutai", "/minpaku"] },
        ].map((u) => (
          <Link key={u.label} href={u.links[0]} className="p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors text-center group">
            <span className="text-2xl block mb-1">{u.icon}</span>
            <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600 block">{u.label}</span>
            <span className="text-xs text-gray-400 block">{u.desc}</span>
          </Link>
        ))}
      </div>

      {/* ─── 横断新着フィード + ランキング ───── */}
      {feed && feed.feed && (
        <>
          {/* 新着フィード */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">全ドメイン新着</h3>
              <Link href="/platform/search" className="text-xs text-blue-600 hover:underline">横断検索 →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {feed.feed.slice(0, 9).map((item, i) => (
                <Link
                  key={`${item.domain}-${item.slug}-${i}`}
                  href={item.url}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{item.domainIcon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 line-clamp-1">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.domainLabel}</span>
                      <span className="text-xs text-gray-400">{formatDate(item.updatedAt || item.date)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ランキング + タイプ別 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 件数ランキング */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h4 className="text-sm font-bold text-gray-700 mb-3">データ件数ランキング</h4>
              <div className="space-y-2">
                {feed.ranking.byCount.map((d, i) => (
                  <Link key={d.id} href={d.path} className="flex items-center gap-3 group">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-lg flex-shrink-0">{d.icon}</span>
                    <span className="text-sm text-gray-700 group-hover:text-blue-600 flex-1 truncate">{d.label}</span>
                    <span className="text-sm font-bold text-blue-600">{d.count.toLocaleString()}件</span>
                  </Link>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-right">全{feed.totalDomains}ドメイン・{feed.totalItems.toLocaleString()}件</p>
            </div>

            {/* タイプ別集計 */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h4 className="text-sm font-bold text-gray-700 mb-3">ドメインタイプ別</h4>
              <div className="space-y-3">
                {feed.byType.map((t) => (
                  <div key={t.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{t.type}</span>
                      <span className="text-xs text-gray-500">{t.count.toLocaleString()}件</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (t.count / feed.totalItems) * 100)}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.domains.map((d) => (
                        <Link key={d.id} href={d.path} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
                          {d.icon} {d.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return "今日";
  if (diff < 172800000) return "昨日";
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
