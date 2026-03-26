"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PlatformNav from "@/components/platform/PlatformNav";

export default function PlatformDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/platform/overview")
      .then((r) => r.json())
      .then(setOverview)
      .catch(() => setError(true));

    fetch("/api/platform/feed")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">データの読み込みに失敗しました。</p>
      </div>
    );
  }

  if (!overview || !feed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    );
  }

  const typeColors = {
    "監視型": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", bar: "bg-red-500" },
    "公募型": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", bar: "bg-blue-500" },
    "検索型": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", bar: "bg-green-500" },
    "比較型": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", bar: "bg-purple-500" },
  };

  const totalRecent = overview.domains.reduce((sum, d) => sum + (d.recentCount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <PlatformNav current="/platform/dashboard" />

        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">プラットフォーム ダッシュボード</h1>
          <p className="text-sm text-gray-500">
            全ドメインの統計・新着・ランキングを一覧できます
          </p>
        </div>

        {/* ──── サマリーカード ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="総データ件数" value={overview.totalItems.toLocaleString()} unit="件" icon="📊" />
          <SummaryCard label="公開ドメイン" value={overview.domains.length} unit="ドメイン" icon="🌐" />
          <SummaryCard label="ドメインタイプ" value={feed.byType?.length || 4} unit="タイプ" icon="📁" />
          <SummaryCard label="直近7日 新着" value={totalRecent} unit="件" icon="🆕" />
        </div>

        {/* ──── ドメイン別カード ──── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">ドメイン別データ</h2>
            <span className="text-xs text-gray-400">{overview.domains.length}ドメイン</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overview.domains
              .sort((a, b) => b.count - a.count)
              .map((d) => {
                const tc = typeColors[d.type] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
                return (
                  <Link
                    key={d.id}
                    href={d.path}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 truncate">{d.label}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${tc.bg} ${tc.text} ${tc.border}`}>
                          {d.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">{d.count.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 ml-1">件</span>
                      </div>
                      {d.recentCount > 0 && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          +{d.recentCount} 新着
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>

        {/* ──── タイプ別構成 ──── */}
        {feed.byType && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">タイプ別構成</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {/* 構成比バー */}
              <div className="flex h-6 rounded-full overflow-hidden mb-4">
                {feed.byType.map((t) => {
                  const pct = (t.count / feed.totalItems) * 100;
                  const tc = typeColors[t.type] || { bar: "bg-gray-400" };
                  return (
                    <div
                      key={t.type}
                      className={`${tc.bar} relative group/bar`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                      title={`${t.type}: ${t.count.toLocaleString()}件 (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              {/* タイプ詳細 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {feed.byType.map((t) => {
                  const tc = typeColors[t.type] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", bar: "bg-gray-400" };
                  const pct = ((t.count / feed.totalItems) * 100).toFixed(1);
                  return (
                    <div key={t.type} className={`rounded-lg p-3 ${tc.bg} border ${tc.border}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-bold ${tc.text}`}>{t.type}</span>
                        <span className={`text-xs ${tc.text}`}>{t.count.toLocaleString()}件 ({pct}%)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.domains.map((d) => (
                          <Link
                            key={d.id}
                            href={d.path}
                            className="text-xs px-2 py-0.5 rounded-full bg-white/80 border border-white text-gray-700 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          >
                            {d.icon} {d.label} ({d.count.toLocaleString()})
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ──── ランキング + 新着 2カラム ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

          {/* 件数ランキング */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">件数ランキング</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              {feed.ranking.byCount.map((d, i) => {
                const barWidth = feed.ranking.byCount[0]?.count
                  ? (d.count / feed.ranking.byCount[0].count) * 100
                  : 0;
                return (
                  <Link key={d.id} href={d.path} className="flex items-center gap-3 group">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      i === 0 ? "bg-yellow-100 text-yellow-700" :
                      i === 1 ? "bg-gray-100 text-gray-600" :
                      i === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-400"
                    }`}>{i + 1}</span>
                    <span className="text-lg flex-shrink-0">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate">{d.label}</span>
                        <span className="text-sm font-bold text-blue-600 flex-shrink-0 ml-2">{d.count.toLocaleString()}件</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 新着が多いドメイン */}
            {feed.ranking.byRecent?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">直近30日の新着が多いドメイン</h3>
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  {feed.ranking.byRecent.slice(0, 5).map((d, i) => (
                    <Link key={d.id} href={d.path} className="flex items-center gap-2 group">
                      <span className="text-lg">{d.icon}</span>
                      <span className="text-sm text-gray-700 group-hover:text-blue-600 flex-1 truncate">{d.label}</span>
                      <span className="text-sm font-bold text-green-600">+{d.recentCount}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 新着フィード */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">新着・更新</h2>
              <Link href="/platform/search" className="text-xs text-blue-600 hover:underline">横断検索 →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {feed.feed.slice(0, 12).map((item, i) => (
                <Link
                  key={`${item.domain}-${item.slug}-${i}`}
                  href={item.url}
                  className="flex items-start gap-3 p-3.5 hover:bg-blue-50/40 transition-colors group first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{item.domainIcon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 group-hover:text-blue-700 line-clamp-1">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.domainLabel}</span>
                      <span className="text-xs text-gray-400">{formatDate(item.updatedAt || item.date)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ──── CTA / 導線 ──── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-6 border-t border-gray-200">
          <Link
            href="/platform/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            横断検索を使う
          </Link>
          <Link
            href="/platform"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            プラットフォームトップへ
          </Link>
        </div>

      </div>
    </div>
  );
}

function SummaryCard({ label, value, unit, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-500 ml-1">{unit}</span>
      </div>
    </div>
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
