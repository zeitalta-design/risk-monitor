"use client";

/**
 * Phase78: 運用管理画面 — 募集状態モニタリングダッシュボード
 *
 * /admin/entry-status
 *
 * 表示内容:
 * - ステータス別件数
 * - 鮮度分布
 * - confidence 分布
 * - 直近の状態変化ログ
 * - 要確認（長時間未確認の受付中リスクデータ）
 * - バッチ実行ボタン
 */

import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  open: "bg-green-100 text-green-700",
  closing_soon: "bg-amber-100 text-amber-700",
  capacity_warning: "bg-orange-100 text-orange-700",
  full: "bg-red-100 text-red-700",
  closed: "bg-gray-200 text-gray-600",
  suspended: "bg-purple-100 text-purple-700",
  awaiting_update: "bg-slate-100 text-slate-500",
  unknown: "bg-gray-100 text-gray-500",
  unset: "bg-gray-50 text-gray-400",
};

const STATUS_LABELS = {
  open: "受付中",
  closing_soon: "締切間近",
  capacity_warning: "定員間近",
  full: "定員到達",
  closed: "募集終了",
  suspended: "一時停止",
  awaiting_update: "情報更新待ち",
  unknown: "要確認",
  unset: "未判定",
};

const UNKNOWN_REASON_LABELS = {
  no_source: "🔍 ソース未取得",
  ambiguous_text: "❓ 文言曖昧",
  stale_data: "⏳ 更新が古い",
  source_conflict: "⚡ 状態競合",
  pre_open: "🕐 受付開始前",
  fetch_error: "⚠️ 取得エラー",
  unset: "⚪ 未設定",
};

const SOURCE_TYPE_LABELS = {
  official: "🏢 公式サイト",
  runnet: "🏃 RUNNET",
  moshicom: "📋 MOSHICOM",
  other: "🔗 その他",
  unset: "⚪ 未設定",
};

export default function AdminEntryStatusPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/official-status-summary");
      if (!res.ok) throw new Error("API error");
      setData(await res.json());
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runBatch() {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/cron/official-status-batch", { method: "POST" });
      const result = await res.json();
      setBatchResult(result);
      // リロード
      await loadData();
    } catch (err) {
      setBatchResult({ success: false, error: err.message });
    } finally {
      setBatchRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-4">🛠️ 募集状態モニタリング</h1>
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🛠️ 募集状態モニタリング</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            生成: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString("ja-JP") : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBatch}
            disabled={batchRunning}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {batchRunning ? "実行中..." : "一括更新実行"}
          </button>
          <button
            onClick={loadData}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔄
          </button>
        </div>
      </div>

      {/* バッチ結果 */}
      {batchResult && (
        <div className={`p-3 rounded-lg mb-6 text-sm ${batchResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {batchResult.success
            ? `✅ 更新完了: ${batchResult.updated}件更新, ${batchResult.changes}件の状態変化`
            : `❌ エラー: ${batchResult.error}`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ステータス別件数 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">📊 ステータス別件数</h2>
          <div className="space-y-2">
            {(data?.statusCounts || []).map((item) => (
              <div key={item.status} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${STATUS_COLORS[item.status] || STATUS_COLORS.unknown}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-400 rounded-full h-2"
                    style={{ width: `${Math.min((item.count / (data?.freshness?.total || 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-600 w-10 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 鮮度分布 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🕐 鮮度分布</h2>
          {data?.freshness && (
            <div className="space-y-2 text-sm">
              <Row label="合計" value={data.freshness.total} />
              <Row label="🟢 6時間以内" value={data.freshness.fresh_6h} color="text-green-700" />
              <Row label="🟡 6〜24時間" value={data.freshness.normal_24h} color="text-amber-700" />
              <Row label="🟠 24〜72時間" value={data.freshness.stale_72h} color="text-orange-700" />
              <Row label="🔴 72時間超" value={data.freshness.very_stale} color="text-red-700" />
              <Row label="⚪ 未確認" value={data.freshness.never_checked} color="text-gray-500" />
            </div>
          )}
        </div>

        {/* confidence 分布 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🎯 信頼度分布</h2>
          {data?.confidenceDist && (
            <div className="space-y-2 text-sm">
              <Row label="🟢 80〜100 (高)" value={data.confidenceDist.high} color="text-green-700" />
              <Row label="🟡 60〜79 (中)" value={data.confidenceDist.medium} color="text-amber-700" />
              <Row label="🟠 40〜59 (低)" value={data.confidenceDist.low} color="text-orange-700" />
              <Row label="⚪ 0〜39 / 未設定" value={data.confidenceDist.unknown} color="text-gray-500" />
            </div>
          )}
        </div>

        {/* 直近の状態変化 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🔄 直近の状態変化（24h）</h2>
          {(data?.recentChanges || []).length === 0 ? (
            <p className="text-xs text-gray-400">変化なし</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.recentChanges.map((c) => (
                <div key={c.id} className="text-xs border-b border-gray-50 pb-2">
                  <div className="font-medium text-gray-800 line-clamp-1">{c.event_title}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`px-1.5 py-0 rounded ${STATUS_COLORS[c.previous_status] || ""}`}>
                      {c.previous_label || c.previous_status}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className={`px-1.5 py-0 rounded ${STATUS_COLORS[c.new_status] || ""}`}>
                      {c.new_label || c.new_status}
                    </span>
                    <span className="text-gray-400 ml-auto">
                      {new Date(c.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase86: unknown 理由別件数 + ソース種別統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* unknown 理由別 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">❓ 要確認・理由別件数</h2>
          {(data?.unknownReasonCounts || []).length === 0 ? (
            <p className="text-xs text-gray-400">データなし</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.unknownReasonCounts.map((r) => (
                <Row key={r.reason} label={UNKNOWN_REASON_LABELS[r.reason] || r.reason} value={r.count} />
              ))}
            </div>
          )}
        </div>

        {/* ソース種別統計 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">📡 ソース種別統計</h2>
          {(data?.sourceTypeCounts || []).length === 0 ? (
            <p className="text-xs text-gray-400">データなし</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.sourceTypeCounts.map((s) => (
                <div key={s.source_type} className="flex items-center justify-between">
                  <span className="text-gray-600">{SOURCE_TYPE_LABELS[s.source_type] || s.source_type}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-800">{s.count}件</span>
                    <span className="text-xs text-gray-400">avg: {s.avg_confidence}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 要確認: 長時間未確認の受付中リスクデータ */}
      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">⚠️ 要確認: 長時間未確認の受付中リスクデータ</h2>
        {(data?.staleEvents || []).length === 0 ? (
          <p className="text-xs text-gray-400">すべて確認済みです</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-left py-2 pr-3">データ名</th>
                  <th className="text-left py-2 pr-3">ステータス</th>
                  <th className="text-left py-2 pr-3">信頼度</th>
                  <th className="text-left py-2 pr-3">理由</th>
                  <th className="text-left py-2 pr-3">最終確認</th>
                  <th className="text-left py-2">締切日</th>
                </tr>
              </thead>
              <tbody>
                {data.staleEvents.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-mono text-gray-400">{e.id}</td>
                    <td className="py-2 pr-3 text-gray-800 line-clamp-1 max-w-xs">{e.title}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0 rounded text-xs ${STATUS_COLORS[e.official_entry_status] || ""}`}>
                        {e.official_entry_status_label || e.official_entry_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono">{e.official_status_confidence ?? "-"}%</td>
                    <td className="py-2 pr-3 text-gray-400 text-xs">{UNKNOWN_REASON_LABELS[e.official_unknown_reason] || "-"}</td>
                    <td className="py-2 pr-3 text-gray-400">{e.official_checked_at || "未確認"}</td>
                    <td className="py-2 text-gray-400">{e.entry_end_date || "未定"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`font-mono font-medium ${color || "text-gray-800"}`}>{value ?? 0}</span>
    </div>
  );
}
