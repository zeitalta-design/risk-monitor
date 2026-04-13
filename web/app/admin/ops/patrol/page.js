"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * Phase240: 巡回パトロール（改善版）
 * - 再取得が本当に動く状態
 * - 失敗理由の可視化
 * - 未解決項目の表示
 * - 手動編集導線
 * - patrol_status管理
 */

const LEVEL_CONFIG = {
  danger: { label: "危険", dot: "bg-red-500", badge: "bg-red-100 text-red-800 border-red-200", card: "border-red-300 bg-red-50" },
  warning: { label: "要確認", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", card: "border-yellow-300 bg-yellow-50" },
  info: { label: "軽微", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-800 border-blue-200", card: "border-gray-200 bg-white" },
};

const STATUS_CONFIG = {
  UPDATED: { label: "更新成功", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: "✅" },
  PARTIAL: { label: "一部更新", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: "⚠️" },
  NO_CHANGE: { label: "変更なし", color: "text-gray-600", bg: "bg-gray-50 border-gray-200", icon: "➖" },
  MANUAL_REQUIRED: { label: "手動対応必要", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: "✋" },
  FAILED: { label: "失敗", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: "❌" },
};

const FAILURE_MESSAGES = {
  NO_SOURCE_URL: "元URLが未登録",
  FETCH_FAILED: "HTML取得に失敗",
  UNSUPPORTED_SOURCE: "対応外のURL",
  PARSE_EMPTY: "情報を抽出できず",
  NO_MISSING_FIELDS_FILLED: "欠損項目は埋まらず",
  DB_UPDATE_FAILED: "DB更新に失敗",
  RACES_NOT_FOUND: "種目取得できず",
  REFETCH_EXCLUDED: "再取得対象外",
  UNKNOWN_ERROR: "不明なエラー",
};

export default function PatrolPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [refetching, setRefetching] = useState(false);
  const [refetchingId, setRefetchingId] = useState(null);
  const [refetchResult, setRefetchResult] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  // 行ごとの再取得結果
  const [rowResults, setRowResults] = useState({});

  useEffect(() => {
    fetchPatrolData();
  }, []);

  const fetchPatrolData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ops/patrol");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("巡回パトロールデータ取得エラー:", err);
      setData({ issueCards: [], totalActive: 0, error: "取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssue = useCallback(async (issueKey) => {
    setSelectedIssue(issueKey);
    setEventsLoading(true);
    setSelectedIds(new Set());
    setRefetchResult(null);
    setRowResults({});
    try {
      const res = await fetch(`/api/admin/ops/patrol?issue=${issueKey}`);
      const json = await res.json();
      setEvents(json.events || []);
      const card = data?.issueCards?.find((c) => c.key === issueKey);
      setSelectedCard(card || null);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [data]);

  // 単体再取得
  const refetchSingle = useCallback(async (eventId) => {
    setRefetchingId(eventId);
    setRowResults((prev) => ({ ...prev, [eventId]: null }));
    try {
      const res = await fetch("/api/admin/ops/patrol/refetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_ids: [eventId] }),
      });
      const result = await res.json();
      if (res.ok && result.results) {
        const r = result.results[0];
        setRowResults((prev) => ({ ...prev, [eventId]: r }));

        // 成功時: リスト＆カード再取得
        if (r.status === "UPDATED" || r.status === "PARTIAL") {
          showFeedback("success", `再取得成功: ${formatChanges(r)}`);
        } else if (r.status === "NO_CHANGE") {
          showFeedback("info", "すべての項目が登録済みです");
        } else if (r.status === "MANUAL_REQUIRED") {
          showFeedback("warning", `手動対応が必要: ${r.remaining_missing?.join(", ") || "不明"}`);
        } else {
          showFeedback("error", r.failure_message || "再取得に失敗しました");
        }

        // サーバーデータを再読込して整合を合わせる
        await reloadAfterRefetch();
      } else {
        showFeedback("error", result.error || "再取得に失敗しました");
      }
    } catch {
      showFeedback("error", "再取得に失敗しました（通信エラー）");
    } finally {
      setRefetchingId(null);
    }
  }, [selectedIssue]);

  // 一括再取得
  const refetchBulk = useCallback(async (ids) => {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0) return;

    setRefetching(true);
    setRefetchResult(null);
    setRowResults({});
    try {
      const res = await fetch("/api/admin/ops/patrol/refetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_ids: targetIds }),
      });
      const result = await res.json();
      if (res.ok && result.results) {
        setRefetchResult(result);
        setSelectedIds(new Set());

        // 行ごとの結果をマッピング
        const newRowResults = {};
        for (const r of result.results) {
          newRowResults[r.event_id] = r;
        }
        setRowResults(newRowResults);

        const s = result.summary;
        const parts = [];
        if (s.updated > 0) parts.push(`更新${s.updated}件`);
        if (s.partial > 0) parts.push(`一部更新${s.partial}件`);
        if (s.no_change > 0) parts.push(`変更なし${s.no_change}件`);
        if (s.manual_required > 0) parts.push(`手動対応${s.manual_required}件`);
        if (s.failed > 0) parts.push(`失敗${s.failed}件`);

        const hasSuccess = s.updated > 0 || s.partial > 0;
        const hasFail = s.failed > 0 || s.manual_required > 0;
        showFeedback(
          hasSuccess && !hasFail ? "success" : hasSuccess ? "warning" : "error",
          `一括再取得完了: ${parts.join(" / ")}`
        );

        // サーバーデータを再読込
        await reloadAfterRefetch();
      } else {
        showFeedback("error", result.error || "一括再取得に失敗しました");
      }
    } catch {
      showFeedback("error", "一括再取得に失敗しました（通信エラー）");
    } finally {
      setRefetching(false);
    }
  }, [selectedIds, selectedIssue]);

  // 再取得後にデータを再読込
  const reloadAfterRefetch = useCallback(async () => {
    // まずカード件数を更新
    const patrolRes = await fetch("/api/admin/ops/patrol");
    const patrolJson = await patrolRes.json();
    setData(patrolJson);

    // 次にリスクデータ一覧を再読込
    if (selectedIssue) {
      const issueRes = await fetch(`/api/admin/ops/patrol?issue=${selectedIssue}`);
      const issueJson = await issueRes.json();
      setEvents(issueJson.events || []);
      // カード情報更新
      const card = patrolJson?.issueCards?.find((c) => c.key === selectedIssue);
      setSelectedCard(card || null);
    }
  }, [selectedIssue]);

  // 全選択 / 解除
  const toggleSelectAll = useCallback(() => {
    const refetchable = events.filter((e) => e.source_url && e.patrol_status !== "refetch_excluded");
    if (selectedIds.size === refetchable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(refetchable.map((e) => e.id)));
    }
  }, [events, selectedIds]);

  // パトロールアクション
  const handlePatrolAction = useCallback(async (eventId, action, note) => {
    try {
      const res = await fetch("/api/admin/ops/patrol", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, action, note }),
      });
      const result = await res.json();
      if (res.ok) {
        showFeedback("success", result.message);
        // 一覧から除外されるアクションの場合
        if (["toggle_active", "dismiss", "exclude_refetch"].includes(action)) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
        }
        fetchPatrolData();
      } else {
        showFeedback("error", result.error);
      }
    } catch {
      showFeedback("error", "操作に失敗しました");
    }
  }, [fetchPatrolData]);

  const showFeedback = (type, message) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 8000);
  };

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState message="データを取得できませんでした" />;

  const { issueCards = [], totalActive = 0, error: apiError } = data;
  const totalIssues = issueCards.reduce((sum, c) => sum + (c.count || 0), 0);

  if (apiError && issueCards.length === 0) return <ErrorState message={apiError} />;

  const isRefetchable = selectedCard?.refetchable;
  const refetchableEvents = events.filter((e) => e.source_url && e.patrol_status !== "refetch_excluded");

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">巡回パトロール</h1>
        <p className="text-sm text-gray-500 mt-1">
          公開データ {totalActive} 件 · 要確認 {totalIssues} 件
        </p>
      </div>

      {/* 問題種別カード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {issueCards.map((card) => {
          const lc = LEVEL_CONFIG[card.level];
          const active = selectedIssue === card.key;
          return (
            <button
              key={card.key}
              onClick={() => card.count > 0 && loadIssue(card.key)}
              disabled={card.count === 0}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50"
                  : card.count > 0
                    ? `${lc.card} hover:shadow-md cursor-pointer`
                    : "border-gray-200 bg-gray-50 opacity-60 cursor-default"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${card.count > 0 ? lc.dot : "bg-green-500"}`} />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${card.count > 0 ? lc.badge : "bg-green-100 text-green-800 border-green-200"}`}>
                  {card.count > 0 ? lc.label : "問題なし"}
                </span>
                {card.refetchable && card.count > 0 && (
                  <span className="text-[10px] text-blue-600 font-bold">再取得可</span>
                )}
              </div>
              <p className={`text-2xl font-extrabold ${card.count > 0 ? "text-gray-900" : "text-green-700"}`}>
                {card.count}
                <span className="text-sm font-bold text-gray-500 ml-1">件</span>
              </p>
              <p className="text-xs text-gray-600 mt-1 font-medium">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* 問題一覧テーブル */}
      {selectedIssue && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* ヘッダー */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-gray-900">
                {selectedCard?.label || selectedIssue}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {events.length} 件のリスク情報が該当（最大100件表示）
                {refetchableEvents.length < events.length && isRefetchable && (
                  <span className="ml-2 text-orange-600">
                    (うち再取得可能 {refetchableEvents.length} 件)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 一括再取得ボタン */}
              {isRefetchable && refetchableEvents.length > 0 && (
                <>
                  {selectedIds.size > 0 ? (
                    <button
                      onClick={() => refetchBulk()}
                      disabled={refetching}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {refetching ? (
                        <><span className="animate-spin inline-block">⏳</span> 再取得中...</>
                      ) : (
                        <>選択した{selectedIds.size}件を再取得</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => refetchBulk(refetchableEvents.map((e) => e.id))}
                      disabled={refetching}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {refetching ? (
                        <><span className="animate-spin inline-block">⏳</span> 再取得中...</>
                      ) : (
                        <>全{refetchableEvents.length}件を一括再取得</>
                      )}
                    </button>
                  )}
                </>
              )}
              {/* 過去リスク情報一括アーカイブ */}
              {selectedIssue === "past_archived" && events.length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm(`${events.length}件のリスク情報を非公開にしますか？`)) return;
                    try {
                      const res = await fetch("/api/admin/ops/patrol", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "archive_past",
                          event_ids: events.map((e) => e.id),
                        }),
                      });
                      const result = await res.json();
                      if (res.ok) {
                        showFeedback("success", result.message);
                        await reloadAfterRefetch();
                      } else {
                        showFeedback("error", result.error);
                      }
                    } catch {
                      showFeedback("error", "一括非公開に失敗しました");
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 font-bold transition-colors flex items-center gap-1.5"
                >
                  全{events.length}件を非公開
                </button>
              )}
              <button
                onClick={() => { setSelectedIssue(null); setEvents([]); setRefetchResult(null); setSelectedIds(new Set()); setRowResults({}); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold"
              >
                閉じる
              </button>
            </div>
          </div>

          {/* アクションフィードバック */}
          {actionFeedback && (
            <FeedbackBar feedback={actionFeedback} onClose={() => setActionFeedback(null)} />
          )}

          {/* 一括再取得結果の詳細パネル */}
          {refetchResult && (
            <RefetchResultPanel result={refetchResult} onClose={() => setRefetchResult(null)} />
          )}

          {eventsLoading ? (
            <div className="p-8 text-center text-gray-400">読み込み中…</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-green-700 font-bold">この問題に該当するリスク情報はありません</p>
              <p className="text-xs text-gray-500 mt-1">再取得または手動編集で解消されました</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {isRefetchable && (
                      <th className="text-center px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.size > 0 && selectedIds.size === refetchableEvents.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">データ名</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">種目</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">開催日</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">都道府県</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">最終更新</th>
                    <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs min-w-[200px]">操作 / 結果</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <EventRow
                      key={ev.id}
                      ev={ev}
                      isRefetchable={isRefetchable}
                      selectedIds={selectedIds}
                      setSelectedIds={setSelectedIds}
                      refetchingId={refetchingId}
                      refetchSingle={refetchSingle}
                      rowResult={rowResults[ev.id]}
                      onAction={handlePatrolAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 選択前のガイド */}
      {!selectedIssue && (
        totalIssues === 0 ? (
          <div className="bg-green-50 rounded-xl border border-green-200 p-8 text-center">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-green-800 font-extrabold">現在、要確認のリスク情報はありません</p>
            <p className="text-sm text-green-600 mt-1">すべての品質チェックをパスしています</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-gray-600 font-bold">問題カードをクリックすると該当リスク情報が表示されます</p>
            <p className="text-sm text-gray-400 mt-1">
              「再取得可」マーク付きカードは一括再取得が可能です
            </p>
          </div>
        )
      )}
    </div>
  );
}

/**
 * リスクデータ行コンポーネント
 */
function EventRow({ ev, isRefetchable, selectedIds, setSelectedIds, refetchingId, refetchSingle, rowResult, onAction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isExcluded = ev.patrol_status === "refetch_excluded";
  const isManualReview = ev.patrol_status === "manual_review";
  const canRefetch = isRefetchable && ev.source_url && !isExcluded;
  const sc = rowResult ? STATUS_CONFIG[rowResult.status] || STATUS_CONFIG.FAILED : null;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 ${
        sc ? (rowResult.status === "UPDATED" ? "bg-green-50/50" :
              rowResult.status === "PARTIAL" ? "bg-yellow-50/50" :
              rowResult.status === "FAILED" || rowResult.status === "MANUAL_REQUIRED" ? "bg-red-50/30" : "") : ""
      }`}>
        {isRefetchable && (
          <td className="text-center px-3 py-2.5">
            {canRefetch ? (
              <input
                type="checkbox"
                checked={selectedIds.has(ev.id)}
                onChange={() => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(ev.id)) next.delete(ev.id);
                    else next.add(ev.id);
                    return next;
                  });
                }}
                className="rounded border-gray-300"
              />
            ) : (
              <span className="text-gray-300 text-xs" title={isExcluded ? "再取得対象外" : "元URLなし"}>—</span>
            )}
          </td>
        )}
        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{ev.id}</td>
        <td className="px-4 py-2.5 max-w-[250px]">
          <div className="font-bold text-gray-800 truncate">{ev.title}</div>
          {/* パトロール状態バッジ */}
          {isExcluded && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 font-bold">対象外</span>
          )}
          {isManualReview && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded border border-orange-200 font-bold">手動確認</span>
          )}
          {/* 直近の再取得ログ */}
          {ev.last_refetch && !rowResult && (
            <LastRefetchBadge log={ev.last_refetch} />
          )}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-600">{ev.sport_type || "—"}</td>
        <td className="px-4 py-2.5 text-xs">
          {ev.event_date ? (
            <span className={isDatePast(ev.event_date) ? "text-red-600 font-bold" : "text-gray-700"}>
              {ev.event_date}
            </span>
          ) : (
            <span className="text-red-500 font-bold">未設定</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-600">
          {ev.prefecture || <span className="text-red-500 font-bold">未設定</span>}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(ev.updated_at)}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 再取得ボタン */}
            {canRefetch && (
              <button
                onClick={() => refetchSingle(ev.id)}
                disabled={refetchingId === ev.id}
                className="text-[11px] px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-bold border border-green-200 transition-colors disabled:opacity-50"
                title={`元URL: ${ev.source_url}`}
              >
                {refetchingId === ev.id ? "取得中…" : "再取得"}
              </button>
            )}
            {/* 編集ボタン（常に表示） */}
            <Link
              href={`/admin/marathon-details/${ev.id}`}
              className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition-colors"
            >
              編集
            </Link>
            {/* 失敗/手動対応時は「手動編集へ」を強調表示 */}
            {rowResult && (rowResult.status === "MANUAL_REQUIRED" || rowResult.status === "FAILED") && (
              <Link
                href={`/admin/marathon-details/${ev.id}`}
                className="text-[11px] px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-bold transition-colors animate-pulse"
              >
                手動編集へ →
              </Link>
            )}
            {/* メニュー */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-[11px] px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold border border-gray-200 transition-colors"
              >
                ▼
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-48 py-1">
                  <Link
                    href={`/admin/marathon-details/import?eventId=${ev.id}`}
                    className="block px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 font-medium"
                  >
                    📥 URL取込で更新
                  </Link>
                  {ev.source_url && (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      🌐 元URL を開く
                    </a>
                  )}
                  <Link
                    href={`/${ev.sport_type || "marathon"}/${ev.id}`}
                    target="_blank"
                    className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    🔗 公開ページを確認
                  </Link>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => { onAction(ev.id, "flag_review"); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-xs text-orange-700 hover:bg-orange-50 font-medium"
                  >
                    ✋ 手動確認が必要
                  </button>
                  {!isExcluded ? (
                    <button
                      onClick={() => { onAction(ev.id, "exclude_refetch"); setMenuOpen(false); }}
                      className="block w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 font-medium"
                    >
                      🚫 再取得対象外にする
                    </button>
                  ) : (
                    <button
                      onClick={() => { onAction(ev.id, "reset_patrol_status"); setMenuOpen(false); }}
                      className="block w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 font-medium"
                    >
                      ↩️ 対象外を解除
                    </button>
                  )}
                  <button
                    onClick={() => { onAction(ev.id, "dismiss"); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50 font-medium"
                  >
                    ✅ 解消済み（一覧から除外）
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => { onAction(ev.id, "toggle_active"); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50 font-medium"
                  >
                    🔒 非公開に切替
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
      {/* 再取得結果行 */}
      {rowResult && (
        <tr className={`border-b border-gray-100 ${sc?.bg || "bg-gray-50"}`}>
          <td colSpan={isRefetchable ? 8 : 7} className="px-4 py-2">
            <RowResultDetail result={rowResult} eventId={ev.id} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * 行内の再取得結果表示
 */
function RowResultDetail({ result }) {
  const sc = STATUS_CONFIG[result.status] || STATUS_CONFIG.FAILED;

  return (
    <div className="text-xs space-y-1">
      {/* ステータス */}
      <div className="flex items-center gap-2">
        <span className="font-bold">{sc.icon} {sc.label}</span>
        {result.failure_message && (
          <span className={`${sc.color}`}>— {result.failure_message}</span>
        )}
        {result.failure_reason && (
          <span className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded text-gray-500 border border-gray-200">
            {FAILURE_MESSAGES[result.failure_reason] || result.failure_reason}
          </span>
        )}
      </div>

      {/* 変更内容 */}
      {result.changes && result.changes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.changes.map((ch, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded border border-green-200">
              <span className="font-bold text-gray-700">{ch.field}:</span>
              <span className="text-red-400 line-through">{ch.from}</span>
              <span className="text-gray-400">→</span>
              <span className="text-green-700 font-bold">{ch.to}</span>
            </span>
          ))}
        </div>
      )}

      {/* 未解決項目 */}
      {result.remaining_missing && result.remaining_missing.length > 0 && (
        <div className="text-orange-700">
          <span className="font-bold">未解決:</span> {result.remaining_missing.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * 直近の再取得ログバッジ
 */
function LastRefetchBadge({ log }) {
  if (!log) return null;
  const sc = STATUS_CONFIG[log.status];
  if (!sc) return null;

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <span className={`text-[10px] ${sc.color}`}>
        {sc.icon} 前回: {sc.label}
      </span>
      {log.remaining_missing && (
        <span className="text-[10px] text-orange-600">
          (未解決: {log.remaining_missing})
        </span>
      )}
      <span className="text-[10px] text-gray-400">
        {formatDate(log.created_at)}
      </span>
    </div>
  );
}

/**
 * フィードバックバー
 */
function FeedbackBar({ feedback, onClose }) {
  const config = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div className={`px-5 py-3 text-sm font-bold flex items-center justify-between border-b ${config[feedback.type] || config.info}`}>
      <span>{feedback.message}</span>
      <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100 ml-4">✕</button>
    </div>
  );
}

/**
 * 一括再取得結果パネル
 */
function RefetchResultPanel({ result, onClose }) {
  const { summary, results } = result;

  return (
    <div className="border-b border-gray-200 bg-blue-50">
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <h4 className="font-extrabold text-blue-900 text-sm">一括再取得結果</h4>
          <div className="flex gap-3 text-xs flex-wrap">
            {summary.updated > 0 && (
              <span className="text-green-700 font-bold">✅ 更新 {summary.updated}件</span>
            )}
            {summary.partial > 0 && (
              <span className="text-yellow-700 font-bold">⚠️ 一部 {summary.partial}件</span>
            )}
            {summary.no_change > 0 && (
              <span className="text-gray-600 font-bold">➖ 変更なし {summary.no_change}件</span>
            )}
            {summary.manual_required > 0 && (
              <span className="text-orange-700 font-bold">✋ 手動 {summary.manual_required}件</span>
            )}
            {summary.failed > 0 && (
              <span className="text-red-700 font-bold">❌ 失敗 {summary.failed}件</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-blue-600 hover:text-blue-800 font-bold">
          閉じる
        </button>
      </div>

      {/* 失敗・手動対応が必要なもののみ詳細表示 */}
      {results.some((r) => r.status === "FAILED" || r.status === "MANUAL_REQUIRED") && (
        <div className="px-5 pb-3 max-h-60 overflow-y-auto">
          <p className="text-xs font-bold text-red-800 mb-2">以下のリスク情報は手動対応が必要です:</p>
          <div className="space-y-1.5">
            {results.filter((r) => r.status === "FAILED" || r.status === "MANUAL_REQUIRED").map((r) => (
              <div key={r.event_id} className="text-xs bg-white rounded-lg px-3 py-2 border border-red-100 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-gray-800">#{r.event_id} {r.title}</span>
                  <span className="ml-2 text-red-600">{r.failure_message}</span>
                  {r.remaining_missing?.length > 0 && (
                    <span className="ml-2 text-orange-600">(未解決: {r.remaining_missing.join(", ")})</span>
                  )}
                </div>
                <Link
                  href={`/admin/marathon-details/${r.event_id}`}
                  className="text-[11px] px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-bold transition-colors whitespace-nowrap"
                >
                  手動編集 →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">巡回パトロール</h1>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-red-800 font-extrabold">{message || "要確認リスク情報データの取得に失敗しました"}</p>
        <p className="text-sm text-red-600 mt-2">ページを再読み込みするか、時間をおいてお試しください</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array(9).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-28" />)}
      </div>
    </div>
  );
}

function isDatePast(dateStr) {
  return new Date(dateStr) < new Date();
}

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

function formatChanges(result) {
  if (!result.changes || result.changes.length === 0) return "変更なし";
  return result.changes.map((c) => `${c.field}: ${c.to}`).join(", ");
}
