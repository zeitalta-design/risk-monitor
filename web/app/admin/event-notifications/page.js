"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

const STATUS_LABELS = {
  pending: { label: "待機中", className: "bg-yellow-100 text-yellow-800" },
  sent: { label: "送信済", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-800" },
  skipped: { label: "スキップ", className: "bg-gray-100 text-gray-600" },
};

const TYPE_LABELS = {
  entry_opened: "受付開始",
  entry_almost_full: "残りわずか",
  entry_closed: "受付終了",
  entry_closed_before_open: "受付終了(未開始)",
  urgency_upgraded: "緊急度上昇",
};

export default function AdminEventNotificationsPage() {
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [tab, setTab] = useState("overview");
  const [manualEventId, setManualEventId] = useState("");
  const [manualChangeType, setManualChangeType] = useState("entry_opened");
  const [manualResult, setManualResult] = useState(null);
  const [manualRunning, setManualRunning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/event-notifications");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setNotifications(data.recentNotifications || []);
        setBatches(data.recentBatches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDispatch() {
    if (dispatching) return;
    setDispatching(true);
    setDispatchResult(null);
    try {
      const res = await fetch("/api/admin/event-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch", limit: 100 }),
      });
      const data = await res.json();
      setDispatchResult(data);
      fetchData();
    } catch (err) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setDispatching(false);
    }
  }

  async function handleManualGenerate(dryRun = false) {
    if (!manualEventId || manualRunning) return;
    setManualRunning(true);
    setManualResult(null);
    try {
      const res = await fetch(`/api/admin/events/${manualEventId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeType: manualChangeType,
          force: true,
          dryRun,
        }),
      });
      const data = await res.json();
      setManualResult(data);
      if (!dryRun) fetchData();
    } catch (err) {
      setManualResult({ success: false, error: err.message });
    } finally {
      setManualRunning(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return dateStr.replace("T", " ").slice(0, 19);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">通知管理</h1>
          <button
            onClick={handleDispatch}
            disabled={dispatching}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {dispatching ? "送信中..." : "待機中の通知を送信"}
          </button>
        </div>

        {/* 送信結果 */}
        {dispatchResult && (
          <div
            className={`mb-4 p-4 rounded-lg text-sm ${
              dispatchResult.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {dispatchResult.message || dispatchResult.error || "完了"}
          </div>
        )}

        {/* KPIカード */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard label="全件" value={stats.total} />
            <KpiCard label="待機中" value={stats.pending} color="yellow" />
            <KpiCard label="送信済" value={stats.sent} color="green" />
            <KpiCard label="失敗" value={stats.failed} color="red" />
            <KpiCard label="スキップ" value={stats.skipped} color="gray" />
            <KpiCard label="本日作成" value={stats.today_created} color="blue" />
            <KpiCard label="本日送信" value={stats.today_sent} color="emerald" />
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-2 mb-4 border-b">
          {[
            { key: "overview", label: "概要" },
            { key: "notifications", label: "通知一覧" },
            { key: "batches", label: "バッチ一覧" },
            { key: "manual", label: "手動生成" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <>
            {/* 概要タブ */}
            {tab === "overview" && (
              <div className="space-y-6">
                {/* 種別内訳 */}
                {stats?.byType && stats.byType.length > 0 && (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      種別 x ステータス内訳
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-2 pr-4">種別</th>
                            <th className="py-2 pr-4">ステータス</th>
                            <th className="py-2">件数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byType.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 pr-4">
                                {TYPE_LABELS[row.notification_type] ||
                                  row.notification_type}
                              </td>
                              <td className="py-2 pr-4">
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="py-2 font-medium">{row.cnt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 最近の通知 */}
                <NotificationTable
                  notifications={notifications}
                  title="最近の通知 (直近20件)"
                />

                {/* 最近のバッチ */}
                <BatchTable batches={batches} title="最近のバッチ (直近10件)" />
              </div>
            )}

            {/* 通知一覧タブ */}
            {tab === "notifications" && (
              <NotificationTable
                notifications={notifications}
                title="通知一覧"
              />
            )}

            {/* バッチ一覧タブ */}
            {tab === "batches" && (
              <BatchTable batches={batches} title="バッチ一覧" />
            )}

            {/* 手動生成タブ */}
            {tab === "manual" && (
              <div className="bg-white rounded-lg border p-6 max-w-xl">
                <h3 className="font-semibold text-gray-900 mb-4">
                  手動通知生成
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      データID
                    </label>
                    <input
                      type="number"
                      value={manualEventId}
                      onChange={(e) => setManualEventId(e.target.value)}
                      placeholder="例: 123"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      変化種別
                    </label>
                    <select
                      value={manualChangeType}
                      onChange={(e) => setManualChangeType(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {Object.entries(TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleManualGenerate(true)}
                      disabled={manualRunning || !manualEventId}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                    >
                      プレビュー (DryRun)
                    </button>
                    <button
                      onClick={() => handleManualGenerate(false)}
                      disabled={manualRunning || !manualEventId}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {manualRunning ? "生成中..." : "通知を生成"}
                    </button>
                  </div>
                </div>

                {manualResult && (
                  <div
                    className={`mt-4 p-4 rounded-lg text-sm ${
                      manualResult.success
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(manualResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "default" }) {
  const colorClasses = {
    default: "bg-white",
    yellow: "bg-yellow-50",
    green: "bg-green-50",
    red: "bg-red-50",
    gray: "bg-gray-50",
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
  };
  return (
    <div className={`${colorClasses[color]} rounded-lg border p-3`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value ?? 0}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const def = STATUS_LABELS[status] || {
    label: status,
    className: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${def.className}`}
    >
      {def.label}
    </span>
  );
}

function NotificationTable({ notifications, title }) {
  if (!notifications || notifications.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">
        通知データがありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs">
              <th className="px-4 py-2">作成日時</th>
              <th className="px-4 py-2">リスク情報</th>
              <th className="px-4 py-2">ユーザー</th>
              <th className="px-4 py-2">種別</th>
              <th className="px-4 py-2">チャンネル</th>
              <th className="px-4 py-2">ステータス</th>
              <th className="px-4 py-2">タイトル</th>
              <th className="px-4 py-2">エラー</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {n.created_at?.replace("T", " ").slice(0, 16)}
                </td>
                <td className="px-4 py-2">
                  <a
                    href={`/marathon/${n.event_id}`}
                    className="text-blue-600 hover:underline"
                    target="_blank"
                    rel="noopener"
                  >
                    {n.event_title || `#${n.event_id}`}
                  </a>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {n.user_key}
                </td>
                <td className="px-4 py-2 text-xs">
                  {TYPE_LABELS[n.notification_type] || n.notification_type}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {n.channel}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={n.status} />
                </td>
                <td className="px-4 py-2 text-xs max-w-xs truncate">
                  {n.title}
                </td>
                <td className="px-4 py-2 text-xs text-red-600 max-w-xs truncate">
                  {n.error_message || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchTable({ batches, title }) {
  if (!batches || batches.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">
        バッチデータがありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs">
              <th className="px-4 py-2">作成日時</th>
              <th className="px-4 py-2">リスク情報</th>
              <th className="px-4 py-2">変化種別</th>
              <th className="px-4 py-2">before → after</th>
              <th className="px-4 py-2">対象数</th>
              <th className="px-4 py-2">送信済</th>
              <th className="px-4 py-2">失敗</th>
              <th className="px-4 py-2">スキップ</th>
              <th className="px-4 py-2">trigger_key</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {b.created_at?.replace("T", " ").slice(0, 16)}
                </td>
                <td className="px-4 py-2">
                  <a
                    href={`/marathon/${b.event_id}`}
                    className="text-blue-600 hover:underline"
                    target="_blank"
                    rel="noopener"
                  >
                    {b.event_title || `#${b.event_id}`}
                  </a>
                </td>
                <td className="px-4 py-2 text-xs">
                  {TYPE_LABELS[b.change_type] || b.change_type}
                </td>
                <td className="px-4 py-2 text-xs">
                  <span className="text-gray-500">{b.before_status || "?"}</span>
                  <span className="mx-1">→</span>
                  <span className="font-medium">{b.after_status || "?"}</span>
                </td>
                <td className="px-4 py-2 text-center">{b.total_targets}</td>
                <td className="px-4 py-2 text-center text-green-600">
                  {b.total_sent || b.sent_count || 0}
                </td>
                <td className="px-4 py-2 text-center text-red-600">
                  {b.total_failed || b.failed_count || 0}
                </td>
                <td className="px-4 py-2 text-center text-gray-500">
                  {b.total_skipped || 0}
                </td>
                <td className="px-4 py-2 text-[10px] text-gray-400 max-w-xs truncate">
                  {b.trigger_key}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
