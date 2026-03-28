"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import EventCard from "@/components/EventCard";
import SearchFilterChips from "@/components/search/SearchFilterChips";
import { REGIONS, MONTHS } from "@/lib/constants";
import { SPORT_CONFIGS } from "@/lib/sport-config";

/**
 * Phase49: 汎用スポーツ一覧ページ
 *
 * /[sportSlug] にマッチ（/marathon は既存ルートが優先）。
 * SPORT_CONFIGS からメタ情報・文言を取得し、sportSlug に応じた一覧を表示。
 */

const DEFAULT_DISTANCES = [
  { key: "", label: "すべて" },
  { key: "5", label: "〜5km" },
  { key: "10", label: "〜10km" },
  { key: "half", label: "ハーフ" },
  { key: "full", label: "フル" },
  { key: "ultra", label: "ウルトラ" },
];

const SORT_OPTIONS = [
  { key: "event_date", label: "開催日順" },
  { key: "entry_end_date", label: "締切日順" },
  { key: "entry_status_priority", label: "募集状況優先" },
  { key: "newest", label: "新着順" },
  { key: "popularity", label: "人気順" },
];

const ENTRY_STATUS_OPTIONS = [
  { key: "", label: "すべて" },
  { key: "open", label: "受付中" },
  { key: "upcoming", label: "受付予定" },
];

export default function SportListPage() {
  const { sportSlug } = useParams();
  const sport = SPORT_CONFIGS.find((s) => s.slug === sportSlug) || null;
  const meta = sport?.meta || {};

  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [filters, setFilters] = useState({
    keyword: "",
    prefecture: "",
    month: "",
    distance: "",
    entry_status: "",
    sort: "event_date",
  });

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { fetchEvents(); }, [filters, page, sportSlug]);
  useEffect(() => { fetchFavoriteIds(); }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sport_type: sport?.sportTypeForDb || sportSlug,
        page: String(page),
      });
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.prefecture) params.set("prefecture", filters.prefecture);
      if (filters.month) params.set("month", filters.month);
      if (filters.distance) params.set("distance", filters.distance);
      if (filters.entry_status) params.set("entry_status", filters.entry_status);
      if (filters.sort) params.set("sort", filters.sort);

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFavoriteIds() {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      setFavoriteIds(new Set(data.ids || []));
    } catch {}
  }

  const handleFavoriteToggle = useCallback(async (eventId) => {
    const isFav = favoriteIds.has(eventId);
    try {
      if (isFav) {
        await fetch(`/api/favorites/${eventId}`, { method: "DELETE" });
        setFavoriteIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
        setFavoriteIds((prev) => new Set(prev).add(eventId));
      }
    } catch (err) {
      console.error(err);
    }
  }, [favoriteIds]);

  const allPrefectures = REGIONS.flatMap((r) => r.prefectures);
  const distances = sport?.distanceFilters || DEFAULT_DISTANCES;

  // 既知スポーツは enabled に関わらず一覧ページを表示（データがあれば機能する）

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {meta.pageHeading || `${sport?.label || sportSlug}大会一覧`}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {meta.heroText || `全国の${sport?.label || sportSlug}大会を検索`}
      </p>

      {/* フィルター */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">キーワード</label>
            <input
              type="text"
              placeholder={meta.searchPlaceholder || "大会名・会場名"}
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">都道府県</label>
            <select
              value={filters.prefecture}
              onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {allPrefectures.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">開催月</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {MONTHS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          {sport?.showDistanceFilter !== false && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">距離</label>
              <select
                value={filters.distance}
                onChange={(e) => setFilters({ ...filters, distance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {distances.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">募集状況</label>
            <select
              value={filters.entry_status}
              onChange={(e) => setFilters({ ...filters, entry_status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ENTRY_STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">並び順</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Phase68: フィルターチップ */}
      <SearchFilterChips
        currentDistance={filters.distance}
        currentStatus={filters.status}
        onDistanceChange={(d) => setFilters({ ...filters, distance: d })}
        onStatusChange={(s) => setFilters({ ...filters, status: s })}
      />

      {/* 件数 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {loading ? "読み込み中..." : `${total}件の大会`}
        </p>
        {!loading && totalPages > 1 && (
          <p className="text-xs text-gray-400">{page} / {totalPages} ページ</p>
        )}
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 md:w-56 h-40 sm:h-[200px] bg-gray-200 rounded-t-lg sm:rounded-t-none sm:rounded-l-lg" />
                <div className="flex-1 p-4">
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-4/5 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">{sport?.icon || "🔍"}</p>
          <p className="text-gray-400 text-sm">{meta.emptyText || "該当する大会が見つかりませんでした"}</p>
          <p className="text-xs text-gray-300 mt-2">まもなくデータが追加されます</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isFavorite={favoriteIds.has(event.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) pageNum = i + 1;
                else if (page <= 4) pageNum = i + 1;
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                else pageNum = page - 3 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      page === pageNum ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* Phase54/Phase120: trail ランキング・回遊導線 */}
      {sport?.slug === "trail" && (
        <div className="mt-10 pt-8 border-t border-gray-100 space-y-8">
          {/* ランキング・特集カード */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">トレイルを探す</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/trail/ranking"
                 className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all group">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="text-sm font-bold text-green-800 group-hover:text-green-900">人気のトレイル大会ランキング</p>
                  <p className="text-xs text-green-600">閲覧数・お気に入りで人気順に表示</p>
                </div>
              </a>
              <a href="/trail/theme/open"
                 className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all group">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-green-800 group-hover:text-green-900">募集中のトレイル大会</p>
                  <p className="text-xs text-green-600">今すぐエントリーできる大会を表示</p>
                </div>
              </a>
            </div>
          </div>

          {/* Phase120: 距離から探す */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">距離から探す</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "ショート", sub: "〜20km", href: "/trail/distance/short", emoji: "🌿" },
                { label: "ミドル", sub: "20〜50km", href: "/trail/distance/middle", emoji: "⛰️" },
                { label: "ロング", sub: "50km〜", href: "/trail/distance/long", emoji: "🏔️" },
              ].map((d) => (
                <a key={d.href} href={d.href}
                   className="flex flex-col items-center gap-1 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all text-center">
                  <span className="text-xl">{d.emoji}</span>
                  <span className="text-sm font-bold text-gray-800">{d.label}</span>
                  <span className="text-xs text-gray-500">{d.sub}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Phase120: 地方から探す */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">地方から探す</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "北海道", href: "/trail/region/hokkaido" },
                { label: "東北", href: "/trail/region/tohoku" },
                { label: "関東", href: "/trail/region/kanto" },
                { label: "中部", href: "/trail/region/chubu" },
                { label: "近畿", href: "/trail/region/kinki" },
                { label: "中国", href: "/trail/region/chugoku" },
                { label: "四国", href: "/trail/region/shikoku" },
                { label: "九州・沖縄", href: "/trail/region/kyushu" },
              ].map((link) => (
                <a key={link.href} href={link.href}
                   className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                              rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
                  {link.label}
                </a>
              ))}
              <a href="/trail/region" className="inline-block px-3 py-1.5 text-xs text-green-600 hover:underline">
                地方別一覧 →
              </a>
            </div>
          </div>

          {/* 季節別開催月 */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">季節・開催月から探す</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "春", emoji: "🌸", months: [3, 4, 5], slug: "spring", highlight: true },
                { label: "夏", emoji: "☀️", months: [6, 7, 8], slug: "summer", highlight: false },
                { label: "秋", emoji: "🍁", months: [9, 10, 11], slug: "autumn", highlight: true },
                { label: "冬", emoji: "❄️", months: [12, 1, 2], slug: "winter", highlight: false },
              ].map((season) => (
                <div key={season.label} className={`p-3 rounded-xl border ${season.highlight ? "bg-green-50/50 border-green-100" : "bg-gray-50 border-gray-100"}`}>
                  <a href={`/trail/season/${season.slug}`} className="text-xs font-bold text-gray-600 mb-2 block hover:text-green-700">{season.emoji} {season.label}の大会 →</a>
                  <div className="flex flex-wrap gap-1.5">
                    {season.months.map((m) => (
                      <a key={m} href={`/trail/month/${m}`}
                         className="inline-block px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-200
                                    rounded-lg hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
                        {m}月
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase120: テーマから探す */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">テーマから探す</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "🔰 初心者向け", href: "/trail/theme/beginner" },
                { label: "🏔️ 絶景コース", href: "/trail/theme/scenic" },
                { label: "⏰ 締切間近", href: "/trail/theme/deadline" },
                { label: "🔥 人気の大会", href: "/trail/theme/popular" },
              ].map((link) => (
                <a key={link.href} href={link.href}
                   className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                              rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
                  {link.label}
                </a>
              ))}
              <a href="/trail/theme" className="inline-block px-3 py-1.5 text-xs text-green-600 hover:underline">
                テーマ別一覧 →
              </a>
            </div>
          </div>

          {/* 地域から探す（都道府県） */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">都道府県から探す</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "東京都", href: "/trail/prefecture/tokyo" },
                { label: "長野県", href: "/trail/prefecture/nagano" },
                { label: "山梨県", href: "/trail/prefecture/yamanashi" },
                { label: "静岡県", href: "/trail/prefecture/shizuoka" },
                { label: "神奈川県", href: "/trail/prefecture/kanagawa" },
                { label: "群馬県", href: "/trail/prefecture/gunma" },
                { label: "新潟県", href: "/trail/prefecture/niigata" },
                { label: "大阪府", href: "/trail/prefecture/osaka" },
              ].map((link) => (
                <a key={link.href} href={link.href}
                   className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                              rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
