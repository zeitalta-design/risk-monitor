"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * 運営ダッシュボード — 全情報集約ページ
 * 行動ログ分析・巡回パトロール・問い合わせ・データ同期を一画面で把握
 */

const ACTION_LABELS = {
  detail_view: "詳細閲覧", search: "検索", external_click: "外部クリック",
  entry_click: "外部クリック(旧)", favorite_add: "お気に入り追加",
  favorite_remove: "お気に入り解除", save_search: "検索保存",
  compare: "比較", share: "共有", signup: "会員登録",
  login: "ログイン", page_view: "ページ閲覧", impression: "表示",
};

const INQUIRY_TYPE = {
  general: "一般", listing_request: "情報提供", correction: "情報修正",
  deletion: "削除依頼", bug_report: "不具合", organizer_apply: "その他",
};

const LEVEL_CONFIG = {
  danger: { dot: "bg-red-500", card: "border-red-300 bg-red-50", badge: "bg-red-100 text-red-800 border-red-200" },
  warning: { dot: "bg-yellow-500", card: "border-yellow-300 bg-yellow-50", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  info: { dot: "bg-blue-400", card: "border-gray-200 bg-white", badge: "bg-blue-100 text-blue-800 border-blue-200" },
};

export default function OpsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [patrol, setPatrol] = useState(null);
  const [inquiries, setInquiries] = useState(null);
  const [cronSettings, setCronSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsDays, setAnalyticsDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/analytics-summary?days=${analyticsDays}`).then(r => r.json()).catch(() => null),
      fetch("/api/admin/ops/patrol").then(r => r.json()).catch(() => null),
      fetch("/api/admin/ops/inquiries?limit=5").then(r => r.json()).catch(() => null),
      fetch("/api/admin/cron-settings").then(r => r.json()).catch(() => null),
    ]).then(([a, p, i, c]) => {
      setAnalytics(a);
      setPatrol(p);
      setInquiries(i);
      setCronSettings(c);
      setLoading(false);
    });
  }, [analyticsDays]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">運営ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          サイトの利用状況・データ品質・問い合わせ・同期状態を一画面で把握できます
        </p>
      </div>

      {/* ===== 1. サイト利用状況 ===== */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="サイト利用状況"
            description="ユーザーの閲覧・検索・クリックなどの行動データです"
          />
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[7, 30].map(d => (
                <button key={d} onClick={() => setAnalyticsDays(d)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition ${
                    analyticsDays === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>{d}日</button>
              ))}
            </div>
            <Link href="/admin/analytics" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
              詳細 &rarr;
            </Link>
          </div>
        </div>

        {analytics?.kpi ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
              {[
                { key: "pageViews", label: "閲覧数" },
                { key: "externalClicks", label: "外部クリック" },
                { key: "overallCTR", label: "CTR", suffix: "%" },
                { key: "favorites", label: "お気に入り" },
                { key: "uniqueSessions", label: "訪問数" },
                { key: "newUsers", label: "新規会員" },
              ].map(def => (
                <div key={def.key} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xl font-extrabold text-gray-900">
                    {(analytics.kpi[def.key] ?? 0).toLocaleString()}{def.suffix || ""}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{def.label}</p>
                </div>
              ))}
            </div>

            {/* 日別アクティビティ */}
            {analytics.dailyActivity?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <p className="text-xs font-bold text-gray-600 mb-2">日別アクティビティ</p>
                <div className="space-y-1">
                  {analytics.dailyActivity.slice(-10).map(row => {
                    const max = Math.max(...analytics.dailyActivity.map(d => d.cnt), 1);
                    return (
                      <div key={row.day} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 w-14 shrink-0 font-mono">{row.day?.slice(5)}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                          <div className="h-full bg-blue-500 rounded" style={{ width: `${Math.max((row.cnt / max) * 100, 2)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 w-8 text-right">{row.cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 検索キーワード + エリア */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-600 mb-2">検索キーワード上位</p>
                {analytics.searchKeywords?.length > 0 ? (
                  <div className="space-y-1.5">
                    {analytics.searchKeywords.slice(0, 5).map((kw, i) => (
                      <div key={kw.keyword} className="flex items-center gap-2">
                        <RankNumber rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700 truncate">{kw.keyword}</span>
                        <span className="text-xs font-bold text-gray-900">{kw.cnt}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">データなし</p>}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-600 mb-2">検索エリア上位</p>
                {analytics.searchAreas?.length > 0 ? (
                  <div className="space-y-1.5">
                    {analytics.searchAreas.slice(0, 5).map((a, i) => (
                      <div key={a.area} className="flex items-center gap-2">
                        <RankNumber rank={i + 1} />
                        <span className="flex-1 text-xs text-gray-700 truncate">{a.area}</span>
                        <span className="text-xs font-bold text-gray-900">{a.cnt}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">データなし</p>}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            利用状況データを取得できませんでした
          </div>
        )}
      </section>

      {/* ===== 2. データ品質 ===== */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="データ品質"
            description="6カテゴリ横断の品質チェック結果です。問題があるカードをクリックすると詳細を確認できます"
          />
        </div>

        {patrol?.issueCards ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              公開データ {patrol.totalPublished?.toLocaleString() || 0} 件 / 要確認 {patrol.issueCards.reduce((s, c) => s + (c.count || 0), 0)} 件
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {patrol.issueCards.map(card => {
                const lc = LEVEL_CONFIG[card.level] || LEVEL_CONFIG.info;
                return (
                  <Link
                    key={card.key}
                    href={`/admin/ops`}
                    className={`block p-3 rounded-xl border transition-all hover:shadow-md ${
                      card.count > 0 ? lc.card : "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${card.count > 0 ? lc.dot : "bg-green-500"}`} />
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${card.count > 0 ? lc.badge : "bg-green-100 text-green-800 border-green-200"}`}>
                        {card.count > 0 ? (card.level === "danger" ? "危険" : card.level === "warning" ? "要確認" : "軽微") : "OK"}
                      </span>
                    </div>
                    <p className={`text-lg font-extrabold ${card.count > 0 ? "text-gray-900" : "text-green-700"}`}>
                      {card.count}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{card.label}</p>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            品質データを取得できませんでした
          </div>
        )}
      </section>

      {/* ===== 3. 問い合わせ ===== */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="問い合わせ"
            description="ユーザーからの問い合わせ状況です"
          />
          <Link href="/admin/ops/inquiries" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
            すべて見る &rarr;
          </Link>
        </div>

        {inquiries ? (
          <div className="bg-white rounded-xl border border-gray-200">
            {/* ステータス別件数 */}
            {inquiries.summary && (
              <div className="flex gap-4 px-5 py-3 border-b border-gray-100">
                {[
                  { key: "open", label: "未対応", color: "text-red-600" },
                  { key: "in_progress", label: "対応中", color: "text-yellow-600" },
                  { key: "on_hold", label: "保留", color: "text-gray-500" },
                  { key: "resolved", label: "解決済み", color: "text-green-600" },
                ].map(s => (
                  <div key={s.key} className="text-center">
                    <p className={`text-lg font-extrabold ${s.color}`}>{inquiries.summary[s.key] || 0}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 最新の問い合わせ */}
            <div className="p-4">
              {inquiries.inquiries?.length > 0 ? (
                <div className="space-y-2">
                  {inquiries.inquiries.slice(0, 5).map(inq => (
                    <Link key={inq.id} href={`/admin/ops/inquiries?id=${inq.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        inq.status === "open" ? "bg-red-100 text-red-800" :
                        inq.status === "in_progress" ? "bg-yellow-100 text-yellow-800" :
                        inq.status === "resolved" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {inq.status === "open" ? "未対応" : inq.status === "in_progress" ? "対応中" : inq.status === "resolved" ? "解決" : inq.status}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">{INQUIRY_TYPE[inq.inquiry_type] || inq.inquiry_type}</span>
                      <span className="text-xs text-gray-800 font-bold truncate flex-1">{inq.subject}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{inq.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{formatDate(inq.created_at)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">問い合わせはありません</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            問い合わせデータを取得できませんでした
          </div>
        )}
      </section>

      {/* ===== 4. データ同期状況 ===== */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="データ同期状況"
            description="各カテゴリの自動データ取得の設定と最終実行結果です"
          />
          <Link href="/admin/ops/cron-settings" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
            設定変更 &rarr;
          </Link>
        </div>

        {cronSettings?.settings ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">カテゴリ</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">状態</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">最終実行</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">結果</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">取得件数</th>
                </tr>
              </thead>
              <tbody>
                {cronSettings.settings.map(s => (
                  <tr key={s.domain_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-800">{s.label}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.enabled ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {s.last_run_at ? formatDate(s.last_run_at) : "未実行"}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.last_run_result ? (
                        <span className={`text-[10px] font-bold ${
                          s.last_run_result === "success" ? "text-green-600" : "text-red-600"
                        }`}>
                          {s.last_run_result === "success" ? "成功" : "失敗"}
                        </span>
                      ) : <span className="text-[10px] text-gray-400">--</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 font-bold">
                      {s.last_run_items != null ? `${s.last_run_items}件` : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            同期設定データを取得できませんでした
          </div>
        )}
      </section>

      {/* ===== 5. 今日の活動サマリー ===== */}
      {analytics?.actionCounts?.length > 0 && (
        <section className="mb-6">
          <SectionHeader
            title="アクション別内訳"
            description="期間中のユーザー行動を種類別に集計したものです"
          />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap gap-2">
              {analytics.actionCounts.map(a => (
                <div key={a.action_type} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-600">{ACTION_LABELS[a.action_type] || a.action_type}</span>
                  <span className="text-xs font-bold text-gray-900">{a.cnt.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <h2 className="text-sm font-extrabold text-gray-900">{title}</h2>
      <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

function RankNumber({ rank }) {
  const bg = rank <= 3 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500";
  return (
    <span className={`w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold shrink-0 ${bg}`}>
      {rank}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-56 mb-8" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
        {Array(6).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-20" />)}
      </div>
      <div className="h-48 bg-white rounded-xl border mb-8" />
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {Array(7).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-24" />)}
      </div>
      <div className="h-48 bg-white rounded-xl border mb-8" />
      <div className="h-48 bg-white rounded-xl border" />
    </div>
  );
}

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
