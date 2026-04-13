"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * Phase228: 運営ダッシュボード（司令塔ページ）
 * - 上部KPIカード群
 * - 今日の対応タスク（緊急/重要/通常）
 * - 重要アラート
 * - 3カラム（問い合わせ・スクレイピング・品質）
 * - 最新活動ログ
 */

const INQUIRY_TYPE_LABELS = {
  general: "一般",
  listing_request: "情報提供",
  correction: "情報修正",
  deletion: "削除依頼",
  bug_report: "不具合",
  organizer_apply: "その他",
};

const STATUS_STYLES = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  on_hold: "bg-gray-100 text-gray-700",
};

const PRIORITY_LABELS = {
  urgent: { label: "緊急", style: "text-red-600 font-extrabold" },
  high: { label: "高", style: "text-orange-600 font-bold" },
  normal: { label: "通常", style: "text-gray-500" },
  low: { label: "低", style: "text-gray-400" },
};

export default function OpsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/ops/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("取得失敗");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { kpi, alerts, tasks, recentInquiries, recentScraping, recentActivity } = data;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">運営ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          最終更新: {new Date(data.generatedAt).toLocaleString("ja-JP")}
        </p>
      </div>

      {/* KPIカード群 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="今日の閲覧" value={kpi.todayViews} icon="👁" />
        <KpiCard label="7日間の閲覧" value={kpi.weekViews} icon="📊" />
        <KpiCard label="今日の検索" value={kpi.todaySearches} icon="🔍" />
        <KpiCard label="外部クリック" value={kpi.todayExtClicks} icon="🔗" />
        <KpiCard label="公開中データ数" value={kpi.totalEvents} icon="🏃" />
        <KpiCard label="未対応問い合わせ" value={kpi.openInquiries} icon="📨"
          alert={kpi.openInquiries > 0} href="/admin/ops/inquiries?status=open" />
        <KpiCard label="巡回失敗" value={kpi.scrapingFails} icon="⚠️"
          alert={kpi.scrapingFails > 0} href="/admin/ops/scraping" />
        <KpiCard label="要確認データ" value={kpi.patrolIssues} icon="🔎"
          alert={kpi.patrolIssues > 0} href="/admin/ops/patrol" />
        <KpiCard label="本日更新" value={kpi.todayUpdated} icon="🔄" />
        <KpiCard label="本日新規検出" value={kpi.todayNew} icon="🆕" />
      </div>

      {/* 今日の対応タスク */}
      {tasks && tasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">今日の対応タスク</h2>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <TaskItem key={i} task={task} />
            ))}
          </div>
        </div>
      )}
      {tasks && tasks.length === 0 && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">✅</span>
            <p className="font-extrabold text-green-800 text-sm">対応が必要なタスクはありません</p>
          </div>
        </div>
      )}

      {/* 重要アラート */}
      {alerts.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="text-lg font-extrabold text-gray-900">重要アラート</h2>
          {alerts.map((alert, i) => (
            <AlertBanner key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* 3カラムセクション */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 未対応問い合わせ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900">未対応問い合わせ</h3>
            <Link href="/admin/ops/inquiries" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
              すべて見る →
            </Link>
          </div>
          <div className="p-5">
            {recentInquiries.length === 0 ? (
              <EmptyState message="未対応の問い合わせはありません" />
            ) : (
              <ul className="space-y-3">
                {recentInquiries.map((inq) => (
                  <li key={inq.id}>
                    <Link
                      href={`/admin/ops/inquiries?id=${inq.id}`}
                      className="block hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${STATUS_STYLES[inq.status] || "bg-gray-100"}`}>
                          {inq.status === "open" ? "未対応" : inq.status === "in_progress" ? "対応中" : inq.status}
                        </span>
                        {inq.priority && PRIORITY_LABELS[inq.priority] && (
                          <span className={`text-[10px] ${PRIORITY_LABELS[inq.priority].style}`}>
                            {PRIORITY_LABELS[inq.priority].label}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {INQUIRY_TYPE_LABELS[inq.inquiry_type] || inq.inquiry_type}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-800 truncate">{inq.subject}</p>
                      <p className="text-xs text-gray-500">{inq.name} · {formatDate(inq.created_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* スクレイピング状況 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900">スクレイピング状況</h3>
            <Link href="/admin/ops/scraping" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
              詳細 →
            </Link>
          </div>
          <div className="p-5">
            {recentScraping.length === 0 ? (
              <EmptyState message="スクレイピング実行履歴がありません" />
            ) : (
              <ul className="space-y-3">
                {recentScraping.map((log, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      log.status === "success" ? "bg-green-500" :
                      log.status === "failed" ? "bg-red-500" :
                      "bg-yellow-500"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800">{log.source_name}</p>
                      <p className="text-xs text-gray-500">
                        成功 {log.success_count} / 失敗 {log.fail_count} / 新規 {log.new_count}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {log.finished_at ? formatDate(log.finished_at) : "実行中"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 品質要確認 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900">品質要確認</h3>
            <Link href="/admin/ops/patrol" className="text-xs text-blue-600 hover:text-blue-800 font-bold">
              詳細 →
            </Link>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              <PatrolItem label="日付未設定" count={kpi.patrolIssues > 0 ? "あり" : "0件"} level={kpi.patrolIssues > 0 ? "danger" : "ok"} />
              <PatrolItem label="30日以上未更新" count={`${data.kpi.todayUpdated > 0 ? "更新あり" : "要確認"}`} level="info" />
              <PatrolItem label="公開中データ数" count={`${kpi.totalEvents}件`} level="ok" />
            </div>
          </div>
        </div>
      </div>

      {/* 最新活動ログ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-extrabold text-gray-900">今日の活動サマリー</h3>
        </div>
        <div className="p-5">
          {recentActivity.length === 0 ? (
            <EmptyState message="今日の活動ログはまだありません" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {recentActivity.map((act) => (
                <div key={act.action_type} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-extrabold text-gray-900">{act.count}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatActionType(act.action_type)}</p>
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

function TaskItem({ task }) {
  const priorityConfig = {
    urgent: {
      label: "緊急",
      bg: "bg-red-50 border-red-200 hover:bg-red-100",
      badge: "bg-red-600 text-white",
      dot: "bg-red-500 animate-pulse",
    },
    high: {
      label: "重要",
      bg: "bg-orange-50 border-orange-200 hover:bg-orange-100",
      badge: "bg-orange-500 text-white",
      dot: "bg-orange-500",
    },
    normal: {
      label: "通常",
      bg: "bg-gray-50 border-gray-200 hover:bg-gray-100",
      badge: "bg-gray-500 text-white",
      dot: "bg-gray-400",
    },
  };
  const pc = priorityConfig[task.priority] || priorityConfig.normal;

  return (
    <Link
      href={task.href}
      className={`flex items-center gap-4 border rounded-xl px-5 py-3.5 transition-colors ${pc.bg}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pc.dot}`} />
      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${pc.badge} shrink-0`}>
        {pc.label}
      </span>
      <span className="text-sm font-bold text-gray-800 flex-1">{task.label}</span>
      <span className="text-xs text-gray-500 shrink-0">{task.category}</span>
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function KpiCard({ label, value, icon, alert, href }) {
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${
        alert ? "border-red-300 bg-red-50" : "border-gray-200"
      } ${href ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <p className={`text-2xl font-extrabold ${alert ? "text-red-700" : "text-gray-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </Wrapper>
  );
}

function AlertBanner({ alert }) {
  const styles = {
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };
  const icons = { danger: "🚨", warning: "⚠️", info: "ℹ️" };

  return (
    <Link
      href={alert.href || "#"}
      className={`block border rounded-xl px-5 py-3.5 ${styles[alert.level]} hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{icons[alert.level]}</span>
        <div>
          <p className="font-extrabold text-sm">{alert.message}</p>
          {alert.detail && <p className="text-xs mt-0.5 opacity-80">{alert.detail}</p>}
        </div>
      </div>
    </Link>
  );
}

function PatrolItem({ label, count, level }) {
  const dot = level === "danger" ? "bg-red-500" : level === "warning" ? "bg-yellow-500" : level === "info" ? "bg-blue-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <span className="text-sm font-bold text-gray-900">{count}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-6">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="p-8 text-center">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
        <p className="text-red-800 font-extrabold mb-1">データの取得に失敗しました</p>
        <p className="text-red-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Array(10).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 h-64" />
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatActionType(type) {
  const map = {
    detail_view: "詳細閲覧",
    favorite_add: "お気に入り追加",
    favorite_remove: "お気に入り解除",
    entry_click: "エントリークリック",
    external_click: "外部リンク",
    search: "検索",
    filter_change: "フィルター変更",
    compare_add: "比較追加",
  };
  return map[type] || type;
}
