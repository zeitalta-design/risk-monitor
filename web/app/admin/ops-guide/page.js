"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase236: 改善ループ準備 — 運用ガイドダッシュボード
 *
 * 毎日見る指標 / 毎週改善 / KPI定義 を1画面で確認。
 * ライブデータと運用ルールを統合表示。
 */

const DAILY_CHECKS = [
  {
    label: "アクセス数（PV）",
    desc: "detail_viewの日次件数。急落・急伸を監視",
    api: "pageViews",
    icon: "👀",
  },
  {
    label: "エントリークリック",
    desc: "entry_click件数。CVに直結する最重要指標",
    api: "entryClicks",
    icon: "🔗",
  },
  {
    label: "お気に入り追加",
    desc: "favorite_add件数。ユーザーの関心度バロメーター",
    api: "favorites",
    icon: "⭐",
  },
  {
    label: "ユニークセッション",
    desc: "セッション数。訪問者の実質ボリューム",
    api: "uniqueSessions",
    icon: "👤",
  },
  {
    label: "新規ユーザー",
    desc: "会員登録数。グロース率の指標",
    api: "newUsers",
    icon: "🆕",
  },
];

const WEEKLY_TASKS = [
  {
    title: "検索クエリ分析",
    desc: "人気検索ワードと0件検索を確認。ニーズとギャップを把握",
    action: "/admin/analytics",
    actionLabel: "分析画面へ",
  },
  {
    title: "データ鮮度チェック",
    desc: "更新から30日以上経過したリスクデータ数を確認。再クロール優先度を決定",
    action: "/admin/quality",
    actionLabel: "品質管理へ",
  },
  {
    title: "口コミ確認",
    desc: "新着口コミの承認・非承認。不適切コンテンツのチェック",
    action: "/admin/reviews",
    actionLabel: "口コミ管理へ",
  },
  {
    title: "運営依頼対応",
    desc: "リスク情報運営からの情報修正依頼を確認・反映",
    action: "/admin/organizer-requests",
    actionLabel: "運営依頼へ",
  },
  {
    title: "人気リスクデータ分析",
    desc: "PV上位リスクデータの情報充実度を確認。写真・口コミ・詳細の補強",
    action: "/admin/event-metrics",
    actionLabel: "指標画面へ",
  },
  {
    title: "新規リスク情報追加",
    desc: "未登録の新リスク情報をスクレイピング or 手動追加。カバー率向上",
    action: "/admin/marathon-details/import",
    actionLabel: "取込画面へ",
  },
];

const KPI_DEFINITIONS = [
  {
    name: "月間PV",
    target: "1,000 → 10,000",
    formula: "detail_view件数 / 月",
    importance: "サイトの基礎トラフィック",
    priority: "最重要",
  },
  {
    name: "CVR（エントリー率）",
    target: "3% → 5%",
    formula: "entry_click / detail_view",
    importance: "ユーザー満足度・情報の有用性",
    priority: "最重要",
  },
  {
    name: "保存率",
    target: "5% → 10%",
    formula: "(save + favorite) / detail_view",
    importance: "再訪・エンゲージメントの先行指標",
    priority: "重要",
  },
  {
    name: "セッション深度",
    target: "2 → 4 ページ",
    formula: "totalActions / uniqueSessions",
    importance: "サイト回遊性・コンテンツ充実度",
    priority: "重要",
  },
  {
    name: "会員登録率",
    target: "1% → 3%",
    formula: "newUsers / uniqueSessions",
    importance: "LTV向上のファネル入口",
    priority: "中",
  },
  {
    name: "口コミ投稿率",
    target: "0.5% → 2%",
    formula: "newReviews / uniqueSessions",
    importance: "UGCコンテンツ＝SEO資産",
    priority: "中",
  },
  {
    name: "データカバー率",
    target: "80% → 95%",
    formula: "登録データ件数 / 実在データ件数",
    importance: "検索の網羅性",
    priority: "重要",
  },
];

const PRIORITY_COLORS = {
  最重要: "bg-red-50 text-red-700 border-red-200",
  重要: "bg-amber-50 text-amber-700 border-amber-200",
  中: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function OpsGuidePage() {
  const [liveKpi, setLiveKpi] = useState(null);

  useEffect(() => {
    fetch("/api/admin/analytics-summary?days=1")
      .then((r) => r.json())
      .then((d) => setLiveKpi(d.kpi))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        📋 運用ガイド
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        毎日チェックする指標・毎週の改善タスク・KPI定義
      </p>

      {/* ===== 毎日チェック ===== */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
            日
          </span>
          毎日チェックする指標
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {DAILY_CHECKS.map((item) => (
            <div
              key={item.api}
              className="bg-white rounded-xl border border-gray-100 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-bold text-gray-800">
                  {item.label}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {liveKpi ? (liveKpi[item.api] ?? 0).toLocaleString() : "—"}
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {item.desc}
              </p>
              {liveKpi && (
                <span className="text-[10px] text-gray-300 mt-1 block">
                  本日
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== 毎週改善 ===== */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">
            週
          </span>
          毎週の改善タスク
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WEEKLY_TASKS.map((task) => (
            <div
              key={task.title}
              className="bg-white rounded-xl border border-gray-100 p-4"
            >
              <h3 className="text-sm font-bold text-gray-800 mb-1">
                {task.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                {task.desc}
              </p>
              <a
                href={task.action}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                {task.actionLabel} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ===== KPI定義 ===== */}
      <section>
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
            K
          </span>
          KPI定義と目標
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  指標
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  優先度
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  算出方法
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  目標
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  意味
                </th>
              </tr>
            </thead>
            <tbody>
              {KPI_DEFINITIONS.map((kpi) => (
                <tr key={kpi.name} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-xs font-bold text-gray-800">
                    {kpi.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        PRIORITY_COLORS[kpi.priority] || ""
                      }`}
                    >
                      {kpi.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">
                    {kpi.formula}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {kpi.target}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {kpi.importance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 改善サイクル */}
      <section className="mt-10 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-3">
          🔄 改善サイクル
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            {
              step: "1. 計測",
              desc: "分析画面で主要KPIを確認",
              color: "bg-white",
            },
            {
              step: "2. 分析",
              desc: "数値の変化要因を特定",
              color: "bg-white",
            },
            {
              step: "3. 施策",
              desc: "最もインパクトが大きい改善を実行",
              color: "bg-white",
            },
            {
              step: "4. 検証",
              desc: "1週間後に効果を測定",
              color: "bg-white",
            },
          ].map((item) => (
            <div key={item.step} className={`${item.color} rounded-lg p-4`}>
              <div className="text-xs font-bold text-gray-800 mb-1">
                {item.step}
              </div>
              <p className="text-[11px] text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
