"use client";
import { useState, useEffect } from "react";

/**
 * Phase228: 基本分析ページ
 * - 期間別KPI（今日/7日/30日）
 * - 人気スポーツ・エリア
 * - よく見られているリスク情報
 * - アクション分布
 * - 日別推移
 */

const ACTION_LABELS = {
  detail_view: "詳細閲覧",
  favorite_add: "お気に入り追加",
  favorite_remove: "お気に入り解除",
  entry_click: "エントリークリック",
  external_click: "外部リンク",
  search: "検索",
  filter_change: "フィルター変更",
  compare_add: "比較追加",
  compare_remove: "比較解除",
};

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ops/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="p-8 text-center text-gray-500">データを取得できませんでした</div>;

  const { views, searches, extClicks, favorites, sportDistribution, popularAreas, popularEvents, actionDistribution, dailyTrend, userCount, monthlyInquiries } = data;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">基本分析</h1>
        <p className="text-sm text-gray-500 mt-1">
          最終更新: {new Date(data.generatedAt).toLocaleString("ja-JP")}
        </p>
      </div>

      {/* 主要KPI（期間別） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <PeriodCard title="詳細ページ閲覧" today={views.today} week={views.week} month={views.month} icon="👁" />
        <PeriodCard title="検索回数" today={searches.today} week={searches.week} month={searches.month} icon="🔍" />
        <PeriodCard title="外部リンククリック" today={extClicks.today} week={extClicks.week} month={extClicks.month} icon="🔗" />
        <PeriodCard title="お気に入り追加" today={favorites.today} week={favorites.week} month={favorites.month} icon="❤️" />
      </div>

      {/* サブKPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MiniCard label="登録ユーザー" value={userCount} />
        <MiniCard label="月間問い合わせ" value={monthlyInquiries} />
        <MiniCard label="スポーツ種目" value={sportDistribution.length} />
        <MiniCard label="対応エリア" value={popularAreas.length} />
      </div>

      {/* 3カラム: 日別推移・人気スポーツ・人気エリア */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 日別推移 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-gray-900">日別アクション数（7日間）</h3>
          </div>
          <div className="p-5">
            {dailyTrend.length === 0 ? (
              <EmptyState message="まだデータがありません" />
            ) : (
              <div className="space-y-2">
                {dailyTrend.map((d) => {
                  const maxVal = Math.max(...dailyTrend.map((x) => x.count), 1);
                  const pct = (d.count / maxVal) * 100;
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12 shrink-0">{formatShortDate(d.date)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-10 text-right">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 人気スポーツ種目 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-gray-900">スポーツ種目分布</h3>
          </div>
          <div className="p-5">
            {sportDistribution.length === 0 ? (
              <EmptyState message="データがありません" />
            ) : (
              <div className="space-y-3">
                {sportDistribution.map((s) => (
                  <div key={s.sport_type} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">{s.sport_type || "未設定"}</span>
                    <span className="text-sm font-extrabold text-blue-700">{s.count} 件</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 人気エリア */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-extrabold text-gray-900">エリア別データ件数 TOP10</h3>
          </div>
          <div className="p-5">
            {popularAreas.length === 0 ? (
              <EmptyState message="データがありません" />
            ) : (
              <div className="space-y-2">
                {popularAreas.map((a, i) => (
                  <div key={a.prefecture} className="flex items-center gap-3">
                    <span className={`w-5 text-center text-xs font-extrabold ${i < 3 ? "text-blue-700" : "text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-800 flex-1">{a.prefecture}</span>
                    <span className="text-sm font-bold text-gray-700">{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* よく見られているリスク情報 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-extrabold text-gray-900">よく見られているリスク情報（7日間）</h3>
        </div>
        {popularEvents.length === 0 ? (
          <div className="p-8"><EmptyState message="閲覧データがまだありません" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">順位</th>
                <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">データ名</th>
                <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">種目</th>
                <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">開催日</th>
                <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">エリア</th>
                <th className="text-right px-4 py-2.5 font-extrabold text-gray-600 text-xs">閲覧数</th>
              </tr>
            </thead>
            <tbody>
              {popularEvents.map((ev, i) => (
                <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className={`text-sm font-extrabold ${i < 3 ? "text-blue-700" : "text-gray-400"}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-gray-800 max-w-[250px] truncate">{ev.title}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{ev.sport_type || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{ev.event_date || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{ev.prefecture || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-blue-700">{ev.view_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* アクション分布 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-extrabold text-gray-900">アクション種別分布（7日間）</h3>
        </div>
        <div className="p-5">
          {actionDistribution.length === 0 ? (
            <EmptyState message="アクションデータがまだありません" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {actionDistribution.map((act) => (
                <div key={act.action_type} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-extrabold text-gray-900">{act.count.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{ACTION_LABELS[act.action_type] || act.action_type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- サブコンポーネント ---

function PeriodCard({ title, today, week, month, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-extrabold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xl font-extrabold text-gray-900">{today.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">今日</p>
        </div>
        <div className="text-center border-l border-gray-200">
          <p className="text-xl font-extrabold text-gray-900">{week.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">7日間</p>
        </div>
        <div className="text-center border-l border-gray-200">
          <p className="text-xl font-extrabold text-gray-900">{month.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">30日間</p>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return <p className="text-center text-sm text-gray-400 py-4">{message}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-32 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {Array(4).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-32" />)}
      </div>
    </div>
  );
}

function formatShortDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
