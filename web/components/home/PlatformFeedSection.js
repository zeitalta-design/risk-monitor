"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * プラットフォーム横断フィード
 * - 共通新着ブロック（直近15件）
 * - 横断ランキング（件数Top5 / タイプ別集計）
 */
export default function PlatformFeedSection() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/platform/feed")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      {/* ─── 新着フィード ───── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">全ドメイン新着</h2>
          <Link href="/search" className="text-xs text-blue-600 hover:underline">
            横断検索 →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.feed.slice(0, 9).map((item, i) => (
            <Link
              key={`${item.domain}-${item.slug}-${i}`}
              href={item.url}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{item.domainIcon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 line-clamp-1">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {item.domainLabel}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.updatedAt || item.date)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── 横断ランキング + タイプ別 ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 件数ランキング */}
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">データ件数ランキング</h3>
          <div className="space-y-2">
            {data.ranking.byCount.map((d, i) => (
              <Link
                key={d.id}
                href={d.path}
                className="flex items-center gap-3 group"
              >
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-lg flex-shrink-0">{d.icon}</span>
                <span className="text-sm text-gray-700 group-hover:text-blue-600 flex-1 truncate">
                  {d.label}
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {d.count.toLocaleString()}件
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-right">
            全{data.totalDomains}ドメイン・{data.totalItems.toLocaleString()}件
          </p>
        </div>

        {/* タイプ別集計 */}
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">ドメインタイプ別</h3>
          <div className="space-y-3">
            {data.byType.map((t) => (
              <div key={t.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{t.type}</span>
                  <span className="text-xs text-gray-500">{t.count.toLocaleString()}件</span>
                </div>
                {/* プログレスバー */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, (t.count / data.totalItems) * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.domains.map((d) => (
                    <Link
                      key={d.id}
                      href={d.path}
                      className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                    >
                      {d.icon} {d.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
