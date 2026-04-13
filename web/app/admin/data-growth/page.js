"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase207: データ成長ダッシュボード
 *
 * /admin/data-growth — データ件数・口コミ数・写真数・結果公開データ・月別成長率
 */

export default function AdminDataGrowthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/data-growth")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <AdminNav />
        <p className="text-sm text-gray-400 py-12 text-center">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <AdminNav />
        <p className="text-sm text-red-500 py-12 text-center">{error}</p>
      </div>
    );
  }

  const c = data?.current || {};
  const mg = data?.monthlyGrowth || [];

  // 月別チャートの最大値
  const maxMonthly = Math.max(
    ...mg.map((m) => m.reviews + m.photos + m.results),
    1
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-6">データ成長KPI</h1>

      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <KpiCard label="データ件数" value={c.totalEvents} sub={`うち今後: ${c.futureEvents}`} />
        <KpiCard label="口コミ数" value={c.totalReviews} color="text-blue-600" />
        <KpiCard label="写真数" value={c.totalPhotos} color="text-emerald-600" />
        <KpiCard label="結果公開データ" value={c.eventsWithResults} sub={`全${c.totalResults}件`} color="text-purple-600" />
        <KpiCard label="ユーザー数" value={c.totalUsers} />
        <KpiCard label="紐付済ユーザー" value={c.linkedUsers} color="text-indigo-600" />
        <KpiCard
          label="結果カバー率"
          value={c.totalEvents > 0 ? `${Math.round((c.eventsWithResults / c.totalEvents) * 100)}%` : "0%"}
          color="text-amber-600"
        />
        <KpiCard
          label="口コミ/データ件数"
          value={c.totalEvents > 0 ? (c.totalReviews / c.totalEvents).toFixed(1) : "0"}
          color="text-teal-600"
        />
      </div>

      {/* 月別成長グラフ */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4">月別データ成長（直近6ヶ月）</h2>

        {/* 凡例 */}
        <div className="flex gap-4 mb-4">
          <LegendDot color="bg-blue-500" label="口コミ" />
          <LegendDot color="bg-emerald-500" label="写真" />
          <LegendDot color="bg-purple-500" label="結果" />
        </div>

        {/* バーチャート */}
        <div className="space-y-3">
          {mg.map((m) => {
            const total = m.reviews + m.photos + m.results;
            const pct = (total / maxMonthly) * 100;
            const rPct = total > 0 ? (m.reviews / total) * pct : 0;
            const pPct = total > 0 ? (m.photos / total) * pct : 0;
            const resPct = total > 0 ? (m.results / total) * pct : 0;

            return (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 shrink-0 tabular-nums">{m.label}</span>
                <div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden flex">
                  {rPct > 0 && (
                    <div
                      className="bg-blue-500 h-full transition-all duration-500"
                      style={{ width: `${rPct}%` }}
                      title={`口コミ: ${m.reviews}`}
                    />
                  )}
                  {pPct > 0 && (
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${pPct}%` }}
                      title={`写真: ${m.photos}`}
                    />
                  )}
                  {resPct > 0 && (
                    <div
                      className="bg-purple-500 h-full transition-all duration-500"
                      style={{ width: `${resPct}%` }}
                      title={`結果: ${m.results}`}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 w-12 text-right tabular-nums">{total}</span>
              </div>
            );
          })}
        </div>

        {/* 月別テーブル */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-3 text-left text-gray-500 font-medium">月</th>
                <th className="py-2 pr-3 text-right text-blue-500 font-medium">口コミ</th>
                <th className="py-2 pr-3 text-right text-emerald-500 font-medium">写真</th>
                <th className="py-2 pr-3 text-right text-purple-500 font-medium">結果</th>
                <th className="py-2 text-right text-gray-500 font-medium">合計</th>
              </tr>
            </thead>
            <tbody>
              {mg.map((m) => (
                <tr key={m.label} className="border-b border-gray-50">
                  <td className="py-2 pr-3 text-gray-600 tabular-nums">{m.label}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{m.reviews}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{m.photos}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{m.results}</td>
                  <td className="py-2 text-right text-gray-900 font-medium tabular-nums">{m.reviews + m.photos + m.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color = "text-gray-900" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
