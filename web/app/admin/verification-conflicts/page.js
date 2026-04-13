"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

const LEVEL_LABELS = {
  0: { label: "問題なし", className: "bg-green-100 text-green-800" },
  1: { label: "軽微", className: "bg-gray-100 text-gray-600" },
  2: { label: "要確認", className: "bg-yellow-100 text-yellow-800" },
  3: { label: "矛盾あり", className: "bg-red-100 text-red-800" },
};

const STATUS_LABELS = {
  verified: { label: "検証済", className: "bg-green-100 text-green-800" },
  conflict: { label: "矛盾あり", className: "bg-red-100 text-red-800" },
  single_source: { label: "単一ソース", className: "bg-gray-100 text-gray-600" },
  unverified: { label: "未検証", className: "bg-yellow-100 text-yellow-800" },
};

export default function AdminVerificationConflictsPage() {
  const [stats, setStats] = useState(null);
  const [sourceLinkStats, setSourceLinkStats] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [multiSource, setMultiSource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [tab, setTab] = useState("overview");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verification-conflicts");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setSourceLinkStats(data.sourceLinkStats);
        setConflicts(data.recentConflicts || []);
        setMultiSource(data.multiSourceEvents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunVerification(options = {}) {
    if (running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/verification-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10, ...options }),
      });
      const data = await res.json();
      setRunResult(data);
      fetchData();
    } catch (err) {
      setRunResult({ success: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }

  async function handleViewDetail(eventId) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/verify-sources`);
      const data = await res.json();
      if (data.success) {
        setDetail(data);
        setTab("detail");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleVerifySingle(eventId) {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/verify-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setRunResult(data.success ? { success: true, message: `ID:${eventId} 検証完了` } : data);
      if (data.success) {
        setDetail(data);
        setTab("detail");
      }
      fetchData();
    } catch (err) {
      setRunResult({ success: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return dateStr.replace("T", " ").slice(0, 16);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">相互検証 / 矛盾管理</h1>
          <div className="flex gap-2">
            <button
              onClick={() => handleRunVerification({ conflictOnly: true })}
              disabled={running}
              className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
            >
              矛盾のみ再検証
            </button>
            <button
              onClick={() => handleRunVerification()}
              disabled={running}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {running ? "検証中..." : "一括検証 (10件)"}
            </button>
          </div>
        </div>

        {runResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            runResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {runResult.message || `検証: ${runResult.verified || 0}件, 矛盾: ${runResult.conflicts || 0}件`}
            {runResult.error && ` エラー: ${runResult.error}`}
          </div>
        )}

        {/* KPIカード */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard label="矛盾あり" value={stats.conflict_count} color="red" />
            <KpiCard label="Level 3" value={stats.level3} color="red" />
            <KpiCard label="Level 2" value={stats.level2} color="yellow" />
            <KpiCard label="検証済" value={stats.verified} color="green" />
            <KpiCard label="単一ソース" value={stats.single_source} color="gray" />
            <KpiCard label="未検証" value={stats.unverified} color="blue" />
            <KpiCard label="ソースリンク" value={sourceLinkStats?.total_links || 0} />
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-2 mb-4 border-b">
          {[
            { key: "overview", label: "概要" },
            { key: "conflicts", label: "矛盾一覧" },
            { key: "multi", label: "複数ソースリスク情報" },
            { key: "detail", label: "詳細" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
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
            {tab === "overview" && (
              <div className="space-y-6">
                <ConflictTable
                  events={conflicts}
                  title="最近の矛盾"
                  onView={handleViewDetail}
                  onVerify={handleVerifySingle}
                  running={running}
                />
                <MultiSourceTable
                  events={multiSource}
                  title="複数ソースリスク情報"
                  onView={handleViewDetail}
                  onVerify={handleVerifySingle}
                  running={running}
                />
              </div>
            )}

            {tab === "conflicts" && (
              <ConflictTable
                events={conflicts}
                title="矛盾ありのリスク情報"
                onView={handleViewDetail}
                onVerify={handleVerifySingle}
                running={running}
              />
            )}

            {tab === "multi" && (
              <MultiSourceTable
                events={multiSource}
                title="複数ソースを持つリスク情報"
                onView={handleViewDetail}
                onVerify={handleVerifySingle}
                running={running}
              />
            )}

            {tab === "detail" && (
              <DetailPanel detail={detail} loading={detailLoading} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "default" }) {
  const colors = {
    default: "bg-white", red: "bg-red-50", yellow: "bg-yellow-50",
    green: "bg-green-50", gray: "bg-gray-50", blue: "bg-blue-50",
  };
  return (
    <div className={`${colors[color]} rounded-lg border p-3`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value ?? 0}</div>
    </div>
  );
}

function LevelBadge({ level }) {
  const def = LEVEL_LABELS[level] || LEVEL_LABELS[0];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${def.className}`}>{def.label}</span>;
}

function VerifStatusBadge({ status }) {
  const def = STATUS_LABELS[status] || STATUS_LABELS.unverified;
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${def.className}`}>{def.label}</span>;
}

function ConflictTable({ events, title, onView, onVerify, running }) {
  if (!events || events.length === 0) {
    return <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">矛盾データなし</div>;
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
              <th className="px-4 py-2">リスク情報</th>
              <th className="px-4 py-2">開催日</th>
              <th className="px-4 py-2">受付状態</th>
              <th className="px-4 py-2">矛盾レベル</th>
              <th className="px-4 py-2">矛盾内容</th>
              <th className="px-4 py-2">検証日時</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <a href={`/marathon/${e.id}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                    {e.title?.slice(0, 30) || `#${e.id}`}
                  </a>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{e.event_date || "-"}</td>
                <td className="px-4 py-2 text-xs">{e.entry_status}</td>
                <td className="px-4 py-2"><LevelBadge level={e.verification_conflict_level} /></td>
                <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate">{e.verification_conflict_summary || "-"}</td>
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {e.verification_conflict_updated_at?.replace("T", " ").slice(0, 16) || "-"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => onView(e.id)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">詳細</button>
                    <button onClick={() => onVerify(e.id)} disabled={running} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">再検証</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MultiSourceTable({ events, title, onView, onVerify, running }) {
  if (!events || events.length === 0) {
    return <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">複数ソースリスク情報なし</div>;
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
              <th className="px-4 py-2">リスク情報</th>
              <th className="px-4 py-2">開催日</th>
              <th className="px-4 py-2">ソース数</th>
              <th className="px-4 py-2">ソース種別</th>
              <th className="px-4 py-2">検証状態</th>
              <th className="px-4 py-2">矛盾レベル</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <a href={`/marathon/${e.id}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                    {e.title?.slice(0, 30) || `#${e.id}`}
                  </a>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{e.event_date || "-"}</td>
                <td className="px-4 py-2 text-center font-medium">{e.source_count}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{e.source_types}</td>
                <td className="px-4 py-2"><VerifStatusBadge status={e.verification_status} /></td>
                <td className="px-4 py-2"><LevelBadge level={e.verification_conflict_level} /></td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => onView(e.id)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">詳細</button>
                    <button onClick={() => onVerify(e.id)} disabled={running} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">検証</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailPanel({ detail, loading }) {
  if (loading) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  if (!detail) return <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">リスク情報を選択してください</div>;

  const { event, sourceLinks, snapshots } = detail;

  return (
    <div className="space-y-4">
      {/* リスク情報 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">{event?.title || "リスク情報詳細"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500">開催日:</span> {event?.event_date || "-"}</div>
          <div><span className="text-gray-500">受付状態:</span> {event?.entry_status || "-"}</div>
          <div><span className="text-gray-500">検証状態:</span> <VerifStatusBadge status={event?.verification_status} /></div>
          <div><span className="text-gray-500">矛盾レベル:</span> <LevelBadge level={event?.verification_conflict_level} /></div>
        </div>
        {event?.verification_conflict_summary && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            {event.verification_conflict_summary}
          </div>
        )}
      </div>

      {/* ソースリンク */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">ソースリンク ({sourceLinks?.length || 0}件)</h4>
        {sourceLinks && sourceLinks.length > 0 ? (
          <div className="space-y-2">
            {sourceLinks.map((sl) => (
              <div key={sl.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  sl.source_type === "runnet" ? "bg-blue-100 text-blue-700" :
                  sl.source_type === "moshicom" ? "bg-purple-100 text-purple-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{sl.source_type}</span>
                {sl.is_primary ? <span className="text-xs text-green-600 font-medium">PRIMARY</span> : null}
                <a href={sl.source_url} className="text-blue-600 hover:underline text-xs truncate flex-1" target="_blank" rel="noopener">
                  {sl.source_url}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">ソースリンクなし</div>
        )}
      </div>

      {/* スナップショット比較 */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">最新スナップショット比較</h4>
        {snapshots && snapshots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs">
                  <th className="py-2 pr-4">項目</th>
                  {snapshots.map((s) => (
                    <th key={s.id} className="py-2 pr-4 font-medium">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.source_type === "runnet" ? "bg-blue-100 text-blue-700" :
                        s.source_type === "moshicom" ? "bg-purple-100 text-purple-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{s.source_type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="受付状態" snapshots={snapshots} field="entry_status" />
                <CompareRow label="締切日" snapshots={snapshots} field="entry_end_date" />
                <CompareRow label="開始日" snapshots={snapshots} field="entry_start_date" />
                <CompareRow label="開催日" snapshots={snapshots} field="event_date_text" />
                <CompareRow label="取得成功" snapshots={snapshots} field="is_success" />
                <CompareRow label="取得日時" snapshots={snapshots} field="checked_at" />
                <CompareRow label="エラー" snapshots={snapshots} field="error_message" />
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">スナップショットなし</div>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, snapshots, field }) {
  const values = snapshots.map((s) => {
    const v = s[field];
    if (v === null || v === undefined) return "-";
    if (field === "is_success") return v ? "OK" : "NG";
    if (field === "checked_at") return v?.replace("T", " ").slice(0, 16);
    return String(v);
  });

  // 差異があるか
  const uniqueValues = new Set(values.filter((v) => v !== "-"));
  const hasConflict = uniqueValues.size > 1;

  return (
    <tr className={`border-b border-gray-50 ${hasConflict ? "bg-amber-50" : ""}`}>
      <td className="py-2 pr-4 text-gray-500 text-xs font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-2 pr-4 text-xs ${hasConflict ? "font-medium text-amber-800" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
