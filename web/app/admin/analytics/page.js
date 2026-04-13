"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";
import Link from "next/link";

/**
 * 行動ログ分析ダッシュボード
 *
 * CV改善に必要な指標を一覧表示:
 * - KPIカード（PV、クリック、CTR等）
 * - 日別アクティビティ
 * - リスク情報別PV+CTRランキング
 * - source_site別クリック
 * - 検索キーワード上位
 */

const KPI_DEFS = [
  { key: "pageViews", label: "詳細PV", icon: "👀" },
  { key: "externalClicks", label: "外部クリック", icon: "🔗" },
  { key: "overallCTR", label: "CTR", icon: "📈", suffix: "%" },
  { key: "favorites", label: "お気に入り", icon: "⭐" },
  { key: "uniqueSessions", label: "セッション", icon: "👤" },
  { key: "newUsers", label: "新規ユーザー", icon: "🆕" },
];

function RankBadge({ rank }) {
  const cls = rank <= 3 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500";
  return (
    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${cls}`}>
      {rank}
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics-summary?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const maxDaily = data?.dailyActivity
    ? Math.max(...data.dailyActivity.map((d) => d.cnt), 1)
    : 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">📊 行動ログ分析</h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                days === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {d}日間
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : !data || data.error ? (
        <div className="text-center py-20 text-red-500">エラー: {data?.error || "取得失敗"}</div>
      ) : (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
            {KPI_DEFS.map((def) => (
              <div key={def.key} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-lg mb-1">{def.icon}</div>
                <div className="text-xl font-bold text-gray-900">
                  {(data.kpi?.[def.key] ?? 0).toLocaleString()}{def.suffix || ""}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{def.label}</div>
              </div>
            ))}
          </div>

          {/* 日別アクティビティ */}
          <section className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4">📈 日別アクティビティ</h2>
            {data.dailyActivity?.length > 0 ? (
              <div className="space-y-1.5">
                {data.dailyActivity.map((row) => (
                  <div key={row.day} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">{row.day?.slice(5)}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.max((row.cnt / maxDaily) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-12 text-right">{row.cnt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">データなし</p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* リスク情報別 PV + CTR ランキング */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">🏆 リスク情報別 PV・CTRランキング</h2>
              {data.topEvents?.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium px-1">
                    <span className="w-5" />
                    <span className="flex-1">データ名</span>
                    <span className="w-10 text-right">PV</span>
                    <span className="w-12 text-right">クリック</span>
                    <span className="w-12 text-right">CTR</span>
                  </div>
                  {data.topEvents.map((ev, i) => (
                    <div key={ev.event_id} className="flex items-center gap-3">
                      <RankBadge rank={i + 1} />
                      <Link
                        href={`/marathon/${ev.event_id}`}
                        className="flex-1 text-xs text-gray-700 truncate hover:text-blue-600"
                      >
                        {ev.title}
                      </Link>
                      <span className="w-10 text-right text-xs font-medium text-gray-900">{ev.views}</span>
                      <span className="w-12 text-right text-xs font-medium text-blue-600">{ev.clicks}</span>
                      <span className={`w-12 text-right text-xs font-bold ${
                        ev.ctr >= 30 ? "text-green-600" : ev.ctr >= 10 ? "text-amber-600" : "text-gray-500"
                      }`}>
                        {ev.ctr}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">データなし</p>
              )}
            </section>

            {/* source_site別クリック */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">🌐 source_site別クリック数</h2>
              {data.clicksBySite?.length > 0 ? (
                <div className="space-y-3">
                  {data.clicksBySite.map((s) => {
                    const maxClicks = Math.max(...data.clicksBySite.map((x) => x.cnt), 1);
                    return (
                      <div key={s.site}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{s.site}</span>
                          <span className="text-xs font-bold text-gray-900">{s.cnt}</span>
                        </div>
                        <div className="h-3 bg-gray-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${(s.cnt / maxClicks) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">データなし</p>
              )}

              {/* クリック数ランキング */}
              {data.topClickEvents?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-600 mb-3">🔥 クリック数TOPリスク情報</h3>
                  <div className="space-y-2">
                    {data.topClickEvents.map((ev, i) => (
                      <div key={ev.event_id} className="flex items-center gap-3">
                        <RankBadge rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700 truncate">{ev.title}</span>
                        <span className="text-[10px] text-gray-400">{ev.sites}</span>
                        <span className="text-xs font-bold text-gray-900">{ev.clicks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 検索キーワード上位 */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">🔍 検索キーワード上位</h2>
              {data.searchKeywords?.length > 0 ? (
                <div className="space-y-2">
                  {data.searchKeywords.map((kw, i) => (
                    <div key={kw.keyword} className="flex items-center gap-3">
                      <RankBadge rank={i + 1} />
                      <span className="flex-1 text-xs text-gray-700">{kw.keyword}</span>
                      <span className="text-xs font-bold text-gray-900">{kw.cnt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">キーワードデータなし</p>
              )}
            </section>

            {/* 検索エリア上位 */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">📍 検索エリア上位</h2>
              {data.searchAreas?.length > 0 ? (
                <div className="space-y-2">
                  {data.searchAreas.map((a, i) => (
                    <div key={a.area} className="flex items-center gap-3">
                      <RankBadge rank={i + 1} />
                      <span className="flex-1 text-xs text-gray-700">{a.area}</span>
                      <span className="text-xs font-bold text-gray-900">{a.cnt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">エリアデータなし</p>
              )}
            </section>
          </div>

          {/* アクション別内訳 */}
          <section className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
            <h2 className="text-sm font-bold text-gray-800 mb-4">🏷️ アクション別内訳</h2>
            {data.actionCounts?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.actionCounts.map((a) => (
                  <span key={a.action_type} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-gray-600">{a.action_type}</span>
                    <span className="text-xs font-bold text-gray-900">{a.cnt}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">データなし</p>
            )}
          </section>

          <p className="text-[10px] text-gray-400 mt-4 text-right">
            集計期間: {data.period?.since?.slice(0, 10)} 〜 本日（{days}日間）
          </p>
        </>
      )}
    </div>
  );
}
