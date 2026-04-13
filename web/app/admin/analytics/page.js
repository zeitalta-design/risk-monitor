"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * 行動ログ分析ダッシュボード
 * サイト訪問者の行動データを集計・可視化
 */

const KPI_DEFS = [
  { key: "pageViews", label: "詳細ページ閲覧数", desc: "リスクデータの詳細ページが表示された回数" },
  { key: "externalClicks", label: "外部リンククリック", desc: "情報源サイトへのリンクがクリックされた回数" },
  { key: "overallCTR", label: "クリック率 (CTR)", desc: "閲覧数に対する外部リンククリックの割合", suffix: "%" },
  { key: "favorites", label: "お気に入り登録", desc: "ユーザーがお気に入りに追加した回数" },
  { key: "uniqueSessions", label: "訪問数", desc: "サイトを訪れたユニークな訪問回数" },
  { key: "newUsers", label: "新規会員登録", desc: "期間中に新しく会員登録したユーザー数" },
];

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
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold text-gray-900">行動ログ分析</h1>
        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                days === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {d}日間
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        サイト訪問者の行動データを集計し、どのリスク情報に関心が集まっているか、どの地域・キーワードで検索されているかを把握できます。データ拡充の優先度判断やサービス改善に活用してください。
      </p>

      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : !data || data.error ? (
        <div className="text-center py-20 text-red-500">エラー: {data?.error || "取得失敗"}</div>
      ) : (
        <>
          {/* ===== KPIカード ===== */}
          <section className="mb-10">
            <SectionHeader
              title="主要指標（KPI）"
              description="期間中の主要な数値です。サイト全体の利用状況を一目で把握できます。"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {KPI_DEFS.map((def) => (
                <div key={def.key} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-2xl font-extrabold text-gray-900">
                    {(data.kpi?.[def.key] ?? 0).toLocaleString()}{def.suffix || ""}
                  </p>
                  <p className="text-xs font-bold text-gray-700 mt-1">{def.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{def.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== 日別アクティビティ ===== */}
          <section className="mb-10">
            <SectionHeader
              title="日別アクティビティ"
              description="日ごとのアクション件数（閲覧・クリック・検索など全て含む）の推移です。急な増減がないか確認できます。"
            />
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {data.dailyActivity?.length > 0 ? (
                <div className="space-y-1.5">
                  {data.dailyActivity.map((row) => (
                    <div key={row.day} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20 shrink-0 font-mono">{row.day?.slice(5)}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded"
                          style={{ width: `${Math.max((row.cnt / maxDaily) * 100, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-12 text-right">{row.cnt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">データなし</p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* ===== PV・CTRランキング ===== */}
            <section>
              <SectionHeader
                title="閲覧数・クリック率ランキング"
                description="どのリスクデータが最も閲覧されているか、また外部リンクがどれだけクリックされているかの順位です。"
              />
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                {data.topEvents?.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold px-1 border-b border-gray-100 pb-2">
                      <span className="w-6">順位</span>
                      <span className="flex-1">データ名</span>
                      <span className="w-10 text-right">閲覧</span>
                      <span className="w-12 text-right">クリック</span>
                      <span className="w-12 text-right">CTR</span>
                    </div>
                    {data.topEvents.map((ev, i) => (
                      <div key={ev.event_id} className="flex items-center gap-3 py-1">
                        <RankNumber rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700 truncate">
                          {ev.title}
                        </span>
                        <span className="w-10 text-right text-xs font-bold text-gray-900">{ev.views}</span>
                        <span className="w-12 text-right text-xs font-bold text-blue-600">{ev.clicks}</span>
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
              </div>
            </section>

            {/* ===== ソースサイト別クリック ===== */}
            <section>
              <SectionHeader
                title="情報源サイト別クリック数"
                description="ユーザーがどの情報源サイト（官公庁サイト等）へのリンクを最もクリックしているかの内訳です。"
              />
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                {data.clicksBySite?.length > 0 ? (
                  <div className="space-y-3">
                    {data.clicksBySite.map((s) => {
                      const maxClicks = Math.max(...data.clicksBySite.map((x) => x.cnt), 1);
                      return (
                        <div key={s.site}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">{s.site}</span>
                            <span className="text-xs font-bold text-gray-900">{s.cnt}件</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded"
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

                {/* クリック数TOPデータ */}
                {data.topClickEvents?.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-600 mb-3">クリック数が多いリスクデータ</h3>
                    <div className="space-y-2">
                      {data.topClickEvents.map((ev, i) => (
                        <div key={ev.event_id} className="flex items-center gap-3">
                          <RankNumber rank={i + 1} />
                          <span className="flex-1 text-xs text-gray-700 truncate">{ev.title}</span>
                          <span className="text-[10px] text-gray-400">{ev.sites}</span>
                          <span className="text-xs font-bold text-gray-900">{ev.clicks}件</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* ===== 検索キーワード上位 ===== */}
            <section>
              <SectionHeader
                title="検索キーワード上位"
                description="ユーザーがサイト内でどんなキーワードで検索しているかの順位です。ニーズの把握やデータ拡充の参考になります。"
              />
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                {data.searchKeywords?.length > 0 ? (
                  <div className="space-y-2">
                    {data.searchKeywords.map((kw, i) => (
                      <div key={kw.keyword} className="flex items-center gap-3 py-1">
                        <RankNumber rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700">{kw.keyword}</span>
                        <span className="text-xs font-bold text-gray-900">{kw.cnt}回</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">データなし</p>
                )}
              </div>
            </section>

            {/* ===== 検索エリア上位 ===== */}
            <section>
              <SectionHeader
                title="検索エリア上位"
                description="どの地域（都道府県）で検索されているかの順位です。地域別のデータ需要がわかります。"
              />
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                {data.searchAreas?.length > 0 ? (
                  <div className="space-y-2">
                    {data.searchAreas.map((a, i) => (
                      <div key={a.area} className="flex items-center gap-3 py-1">
                        <RankNumber rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700">{a.area}</span>
                        <span className="text-xs font-bold text-gray-900">{a.cnt}回</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">データなし</p>
                )}
              </div>
            </section>
          </div>

          {/* ===== アクション別内訳 ===== */}
          <section className="mb-6">
            <SectionHeader
              title="アクション別内訳"
              description="ユーザーの行動を種類別に集計したものです。detail_view=詳細閲覧、search=検索、favorite_add=お気に入り追加 などの内訳がわかります。"
            />
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {data.actionCounts?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-bold text-gray-500">アクション種別</th>
                        <th className="text-right px-3 py-2 text-xs font-bold text-gray-500">件数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.actionCounts.map((a) => (
                        <tr key={a.action_type} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-700">{ACTION_LABELS[a.action_type] || a.action_type}</td>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900 text-right">{a.cnt.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">データなし</p>
              )}
            </div>
          </section>

          <p className="text-xs text-gray-400 text-right">
            集計期間: {data.period?.since?.slice(0, 10)} -- 本日（{days}日間）
          </p>
        </>
      )}
    </div>
  );
}

/** セクション見出し + 説明文 */
function SectionHeader({ title, description }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-extrabold text-gray-900">{title}</h2>
      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
  );
}

/** 順位表示 */
function RankNumber({ rank }) {
  const bg = rank <= 3 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500";
  return (
    <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold shrink-0 ${bg}`}>
      {rank}
    </span>
  );
}

/** アクション種別の日本語ラベル */
const ACTION_LABELS = {
  detail_view: "詳細ページ閲覧",
  search: "検索",
  external_click: "外部リンククリック",
  entry_click: "外部リンククリック（旧）",
  favorite_add: "お気に入り追加",
  favorite_remove: "お気に入り解除",
  save_search: "検索条件保存",
  compare: "比較",
  share: "共有",
  signup: "会員登録",
  login: "ログイン",
  page_view: "ページ閲覧",
  impression: "表示",
};
