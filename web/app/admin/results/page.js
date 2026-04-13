"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

/**
 * Phase155: 結果管理画面
 *
 * /admin/results — リスクデータ別結果概要、公開ステータス管理
 */

const SPORT_OPTIONS = [
  { value: "", label: "全スポーツ" },
  { value: "marathon", label: "マラソン" },
  { value: "trail", label: "トレイル" },
];

export default function AdminResultsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    loadResults();
  }, [filterSport, offset]);

  async function loadResults() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (filterSport) params.set("sport_type", filterSport);
      const res = await fetch(`/api/admin/results?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load admin results:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">データ結果管理</h1>
        <Link href="/admin/results/upload" className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          CSVアップロード
        </Link>
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterSport}
          onChange={(e) => { setFilterSport(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
        >
          {SPORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{total}件</span>
      </div>

      {/* テーブル */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">結果データはありません</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500">データID</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500">データ名</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500">年度</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500">種別</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 text-right">全件</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 text-right">公開</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 text-right">完走</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500">最速</th>
                  <th className="py-2 text-xs font-medium text-gray-500 text-right">紐付</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`${item.event_id}-${item.result_year}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-3 text-gray-500 tabular-nums">{item.event_id}</td>
                    <td className="py-2.5 pr-3 text-gray-800 font-medium truncate max-w-[200px]">
                      {item.event_title || `Event #${item.event_id}`}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600 tabular-nums">{item.result_year || "-"}</td>
                    <td className="py-2.5 pr-3 text-gray-500 text-xs">{item.sport_type || "-"}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-700 tabular-nums">{item.total_results}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-600 tabular-nums">{item.public_count}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-600 tabular-nums">{item.finisher_count}</td>
                    <td className="py-2.5 pr-3 text-gray-500 tabular-nums text-xs">{item.fastest || "-"}</td>
                    <td className="py-2.5 text-right text-gray-500 tabular-nums">{item.linked_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* プライバシーノート */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          結果データは匿名化されています。公開結果には個人名は含まれず、ゼッケン番号のみが識別子として使用されます。
          runner_name_hashはシステム内部照合専用で、APIレスポンスには含まれません。
        </p>
      </div>
    </div>
  );
}
