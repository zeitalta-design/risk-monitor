"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase144: 口コミ管理画面
 *
 * /admin/reviews — 口コミ一覧・ステータス管理
 */

const STATUS_LABELS = {
  published: { label: "公開", color: "bg-green-100 text-green-700" },
  pending: { label: "確認中", color: "bg-amber-100 text-amber-700" },
  hidden: { label: "非公開", color: "bg-gray-100 text-gray-500" },
  flagged: { label: "要確認", color: "bg-red-100 text-red-700" },
};

const PARTICIPANT_LABELS = {
  beginner: "初心者",
  intermediate: "中級者",
  experienced: "上級者",
  spectator: "観戦者",
};

const SPORT_OPTIONS = [
  { value: "", label: "全スポーツ" },
  { value: "marathon", label: "マラソン" },
  { value: "trail", label: "トレイル" },
];

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [searchEventId, setSearchEventId] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadReviews();
  }, [filterStatus, filterSport, searchEventId]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterSport) params.set("sport_type", filterSport);
      if (searchEventId) params.set("event_id", searchEventId);
      const res = await fetch(`/api/admin/reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setStats(data.stats || {});
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      loadReviews();
    } catch (err) {
      console.error("Failed to update review status:", err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-4">口コミ管理</h1>

      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_LABELS).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              filterStatus === key ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="text-2xl font-bold text-gray-700">{stats[key] || 0}</p>
            <p className="text-xs text-gray-500">{info.label}</p>
          </button>
        ))}
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
        >
          {SPORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={searchEventId}
          onChange={(e) => setSearchEventId(e.target.value)}
          placeholder="データIDで検索"
          className="text-xs border border-gray-200 rounded px-3 py-1.5 w-36 text-gray-700 placeholder-gray-400"
        />
        <span className="text-xs text-gray-400 ml-auto">{total}件</span>
      </div>

      {/* テーブル */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">口コミはありません</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => {
            const statusInfo = STATUS_LABELS[review.status] || STATUS_LABELS.published;
            const isExpanded = expandedId === review.id;
            const rating = review.rating_overall || review.rating || 0;
            return (
              <div key={review.id} className="border border-gray-200 rounded-lg bg-white">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : review.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-8">#{review.id}</span>
                  <span className="flex text-yellow-400 text-xs">
                    {"★".repeat(rating)}{"☆".repeat(5 - rating)}
                  </span>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                    {review.event_title || `Event #${review.event_id}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {review.nickname || review.author_name || "匿名"}
                  </span>
                  {review.participant_type && (
                    <span className="text-xs text-gray-400">
                      {PARTICIPANT_LABELS[review.participant_type]}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {review.created_at?.slice(0, 10)}
                  </span>
                  <span className="text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                    {(review.review_title || review.title) && (
                      <p className="text-sm font-bold text-gray-800">
                        {review.review_title || review.title}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {review.review_body || review.body || "(本文なし)"}
                    </p>

                    {/* カテゴリ評価 */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {review.rating_course && <span>コース: {review.rating_course}</span>}
                      {review.rating_access && <span>アクセス: {review.rating_access}</span>}
                      {review.rating_venue && <span>会場: {review.rating_venue}</span>}
                      {review.rating_beginner && <span>初心者向け: {review.rating_beginner}</span>}
                    </div>

                    {review.recommended_for && (
                      <p className="text-xs text-gray-500">向いている人: {review.recommended_for}</p>
                    )}

                    {/* ステータス変更 */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">ステータス変更:</span>
                      {Object.entries(STATUS_LABELS).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => updateStatus(review.id, key)}
                          disabled={review.status === key}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            review.status === key
                              ? `${info.color} border-current opacity-70`
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {info.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
