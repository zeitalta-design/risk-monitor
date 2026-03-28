"use client";
import { useState, useEffect } from "react";

/**
 * Phase228: スクレイピング監視ページ
 * - ソース別ヘルス一覧
 * - 失敗中ソースの上部固定表示
 * - 直近巡回ログ一覧
 * - 手動再実行ボタンの土台
 */

const HEALTH_CONFIG = {
  healthy: { label: "正常", dot: "bg-green-500", bg: "bg-green-50 border-green-200", text: "text-green-800" },
  warning: { label: "注意", dot: "bg-yellow-500", bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-800" },
  critical: { label: "異常", dot: "bg-red-500", bg: "bg-red-50 border-red-200", text: "text-red-800" },
  running: { label: "実行中", dot: "bg-blue-500 animate-pulse", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  unknown: { label: "未実行", dot: "bg-gray-400", bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
};

const STATUS_LABELS = {
  success: { label: "成功", style: "bg-green-100 text-green-800" },
  failed: { label: "失敗", style: "bg-red-100 text-red-800" },
  running: { label: "実行中", style: "bg-blue-100 text-blue-800" },
};

export default function ScrapingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSource, setExpandedSource] = useState(null);
  const [runningSource, setRunningSource] = useState(null);
  const [runResult, setRunResult] = useState(null);

  function fetchData() {
    fetch("/api/admin/ops/scraping")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);

  async function handleManualRun(sourceSlug) {
    setRunningSource(sourceSlug);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/ops/scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceSlug }),
      });
      const result = await res.json();
      setRunResult({ source: sourceSlug, ...result });
      // データ再取得
      fetchData();
    } catch (err) {
      setRunResult({ source: sourceSlug, success: false, error: err.message });
    } finally {
      setRunningSource(null);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="p-8 text-center text-gray-500">データを取得できませんでした</div>;

  const { sources, summary } = data;
  const criticalSources = sources.filter((s) => s.health === "critical" || s.health === "warning");

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">スクレイピング監視</h1>
        <p className="text-sm text-gray-500 mt-1">
          {summary.totalSources} ソース · 直近7日間 {summary.totalLogs} 回実行
        </p>
      </div>

      {/* 実行結果通知 */}
      {runResult && (
        <div className={`mb-6 border rounded-xl px-5 py-4 flex items-center justify-between ${
          runResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
        }`}>
          <div>
            <p className={`font-bold text-sm ${runResult.success ? "text-green-800" : "text-red-800"}`}>
              {runResult.success ? "✅ 再実行が完了しました" : "❌ 再実行に失敗しました"}
              {runResult.source && ` (${runResult.source})`}
            </p>
            {runResult.output && (
              <pre className="text-xs mt-1 text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {runResult.output.split("\n").slice(-5).join("\n")}
              </pre>
            )}
            {runResult.error && !runResult.success && (
              <p className="text-xs mt-1 text-red-600">{runResult.error}</p>
            )}
          </div>
          <button
            onClick={() => setRunResult(null)}
            className="text-gray-400 hover:text-gray-600 shrink-0 ml-4"
          >✕</button>
        </div>
      )}

      {/* 異常ソース上部固定 */}
      {criticalSources.length > 0 && (
        <div className="mb-6 space-y-3">
          {criticalSources.map((src) => {
            const hc = HEALTH_CONFIG[src.health];
            return (
              <div key={src.slug} className={`border rounded-xl px-5 py-4 ${hc.bg}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${hc.dot}`} />
                  <span className={`font-extrabold ${hc.text}`}>
                    {src.name}: {src.health === "critical"
                      ? `${src.consecutiveFails}回連続で巡回に失敗しています`
                      : "直近の巡回で失敗が発生しました"}
                  </span>
                </div>
                {src.lastRun?.error_summary && (
                  <p className="text-sm mt-2 ml-6 opacity-80">{src.lastRun.error_summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ソース別ヘルスカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sources.map((src) => {
          const hc = HEALTH_CONFIG[src.health];
          const expanded = expandedSource === src.slug;

          return (
            <div key={src.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* ヘッダー */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${hc.dot}`} />
                  <div>
                    <h3 className="font-extrabold text-gray-900">{src.name}</h3>
                    <p className="text-xs text-gray-500">{src.description}{src.schedule && ` · 自動巡回: ${src.schedule}`}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${hc.bg} ${hc.text}`}>
                  {hc.label}
                </span>
              </div>

              {/* 統計 */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <StatBox label="成功" value={src.weekStats.totalSuccess} />
                  <StatBox label="失敗" value={src.weekStats.totalFail} alert={src.weekStats.totalFail > 0} />
                  <StatBox label="新規検出" value={src.weekStats.totalNew} />
                  <StatBox label="更新" value={src.weekStats.totalUpdate} />
                </div>

                {/* 最終実行 */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    <span className="font-bold text-gray-600">最終巡回:</span>{" "}
                    {src.lastRun ? formatDateTime(src.lastRun.finished_at || src.lastRun.started_at) : "未実行"}
                  </p>
                  <p>
                    <span className="font-bold text-gray-600">掲載大会数:</span> {src.eventCount} 件
                  </p>
                  {src.consecutiveFails > 0 && (
                    <p className="text-red-600 font-bold">
                      連続失敗: {src.consecutiveFails} 回
                    </p>
                  )}
                </div>

                {/* 操作ボタン */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setExpandedSource(expanded ? null : src.slug)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold transition-colors"
                  >
                    {expanded ? "ログを閉じる" : "巡回ログを見る"}
                  </button>
                  <button
                    onClick={() => handleManualRun(src.slug)}
                    disabled={runningSource !== null}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                      runningSource === src.slug
                        ? "border-blue-400 text-blue-700 bg-blue-100 animate-pulse"
                        : runningSource !== null
                        ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                        : "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    {runningSource === src.slug ? "実行中…" : "手動再実行"}
                  </button>
                </div>
              </div>

              {/* 巡回ログ展開 */}
              {expanded && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-2 font-extrabold text-gray-500">日時</th>
                        <th className="text-left px-4 py-2 font-extrabold text-gray-500">種別</th>
                        <th className="text-left px-4 py-2 font-extrabold text-gray-500">結果</th>
                        <th className="text-right px-4 py-2 font-extrabold text-gray-500">成功/失敗</th>
                        <th className="text-right px-4 py-2 font-extrabold text-gray-500">新規</th>
                      </tr>
                    </thead>
                    <tbody>
                      {src.recentLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                            巡回ログがありません
                          </td>
                        </tr>
                      ) : (
                        src.recentLogs.map((log) => {
                          const sl = STATUS_LABELS[log.status] || { label: log.status, style: "bg-gray-100" };
                          return (
                            <tr key={log.id} className="border-t border-gray-100">
                              <td className="px-4 py-2 text-gray-600">{formatDateTime(log.started_at)}</td>
                              <td className="px-4 py-2 text-gray-600">{log.job_type}</td>
                              <td className="px-4 py-2">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${sl.style}`}>{sl.label}</span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="text-green-700">{log.success_count}</span>
                                {" / "}
                                <span className={log.fail_count > 0 ? "text-red-600 font-bold" : "text-gray-500"}>{log.fail_count}</span>
                              </td>
                              <td className="px-4 py-2 text-right text-blue-700 font-bold">{log.new_count}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, alert }) {
  return (
    <div className={`text-center p-2 rounded-lg ${alert ? "bg-red-50" : "bg-gray-50"}`}>
      <p className={`text-xl font-extrabold ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => <div key={i} className="bg-white rounded-xl border h-64" />)}
      </div>
    </div>
  );
}

function formatDateTime(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
