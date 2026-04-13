"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase135: リスクデータ指標ダッシュボード
 *
 * /admin/event-metrics — エンゲージメント上位リスクデータ一覧
 */

const SORT_KEYS = [
  { key: "page_views", label: "PV" },
  { key: "favorites", label: "お気に入り" },
  { key: "saves", label: "保存" },
  { key: "compares", label: "比較" },
  { key: "entry_clicks", label: "エントリー" },
  { key: "cta_clicks", label: "CTA" },
  { key: "popularity_score", label: "人気スコア" },
];

const PERIOD_OPTIONS = [
  { value: "7", label: "7日" },
  { value: "30", label: "30日" },
  { value: "90", label: "90日" },
];

const SPORT_OPTIONS = [
  { value: "", label: "全スポーツ" },
  { value: "marathon", label: "マラソン" },
  { value: "trail", label: "トレイル" },
  { value: "triathlon", label: "トライアスロン" },
  { value: "cycling", label: "自転車" },
  { value: "walking", label: "ウォーキング" },
  { value: "swimming", label: "水泳" },
];

export default function AdminEventMetricsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [sportType, setSportType] = useState("");
  const [sortKey, setSortKey] = useState("popularity_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadMetrics();
  }, [days, sportType]);

  async function loadMetrics() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days, limit: "100" });
      if (sportType) params.set("sport_type", sportType);
      const res = await fetch(`/api/admin/event-metrics?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = events
    .filter((e) => !search || e.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] || 0;
      const bv = b[sortKey] || 0;
      return sortAsc ? av - bv : bv - av;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-4">リスクデータ指標ダッシュボード</h1>

      {/* フィルターバー */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">期間:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                days === opt.value
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={sportType}
          onChange={(e) => setSportType(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600"
        >
          {SPORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="データ名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded px-3 py-1.5 w-48 text-gray-700 placeholder-gray-400"
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}件</span>
      </div>

      {/* テーブル */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">データがありません</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-8">#</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 min-w-[200px]">データ名</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">競技</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">地域</th>
                {SORT_KEYS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-right px-3 py-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-0.5">{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, idx) => (
                <tr
                  key={ev.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium text-gray-800 line-clamp-1">{ev.title}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{ev.sport_type || "-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{ev.prefecture || "-"}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.page_views || 0}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.favorites || 0}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.saves || 0}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.compares || 0}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.entry_clicks || 0}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">{ev.cta_clicks || 0}</td>
                  <td className="px-3 py-2 text-right">
                    <ScoreBadge score={ev.popularity_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (!score && score !== 0) return <span className="text-xs text-gray-300">-</span>;
  let cls = "text-gray-500 bg-gray-50";
  if (score >= 80) cls = "text-red-700 bg-red-50";
  else if (score >= 60) cls = "text-orange-700 bg-orange-50";
  else if (score >= 40) cls = "text-amber-700 bg-amber-50";
  else if (score >= 20) cls = "text-blue-700 bg-blue-50";
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${cls} tabular-nums`}>
      {score}
    </span>
  );
}
