"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

/**
 * 管理画面 — リスク情報詳細情報一覧
 * marathon_details の有無を確認し、編集ページへ遷移する
 */
export default function AdminMarathonDetailsPage() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        filter,
        limit: String(limit),
        offset: String(page * limit),
      });
      const res = await fetch(`/api/admin/marathon-details?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [query, filter, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(0);
    fetchEvents();
  }

  const totalPages = Math.ceil(total / limit);
  const withDetail = events.filter((e) => e.has_detail).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />

      <h1 className="text-xl font-bold text-gray-900 mb-2">
        リスク情報詳細情報 データ管理
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        marathon_details のデータ有無を確認し、編集・新規作成できます
      </p>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">総データ件数</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{withDetail}</div>
          <div className="text-xs text-gray-500">
            詳細あり（表示中）
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">
            {events.length - withDetail}
          </div>
          <div className="text-xs text-gray-500">
            詳細なし（表示中）
          </div>
        </div>
      </div>

      {/* 検索・フィルタ */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="データ名で検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="all">すべて</option>
          <option value="with_detail">詳細あり</option>
          <option value="without_detail">詳細なし</option>
        </select>
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          検索
        </button>
      </form>

      {/* テーブル */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          該当するリスク情報がありません
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    ID
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    データ名
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    開催日
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    都道府県
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">
                    詳細
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    データソース
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">
                    更新日
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-3 text-gray-500">{ev.id}</td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/marathon/${ev.id}`}
                        className="text-gray-900 hover:text-blue-600 font-medium"
                        target="_blank"
                      >
                        {ev.title}
                      </Link>
                      <div className="flex gap-1 mt-1">
                        {ev.has_tagline && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            キャッチ
                          </span>
                        )}
                        {ev.has_summary && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                            概要
                          </span>
                        )}
                        {ev.has_series && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                            系列
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {ev.event_date || "-"}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {ev.prefecture || "-"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {ev.has_detail ? (
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="詳細あり" />
                      ) : (
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-300" title="詳細なし" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-600 text-xs">
                      {ev.organizer_name || "-"}
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-xs">
                      {ev.detail_updated_at
                        ? new Date(ev.detail_updated_at).toLocaleDateString("ja-JP")
                        : "-"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={`/admin/marathon-details/${ev.id}`}
                        className="inline-block px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        {ev.has_detail ? "編集" : "作成"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30"
              >
                ← 前
              </button>
              <span className="text-sm text-gray-500">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30"
              >
                次 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
