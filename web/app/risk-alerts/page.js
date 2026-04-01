"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ACTION_LABELS = {
  license_revocation: "許可取消",
  business_suspension: "業務停止",
  improvement_order: "指示処分",
  warning: "警告",
  guidance: "指導",
  other: "その他",
};

const ACTION_COLORS = {
  license_revocation: "bg-red-50 text-red-700 border-red-200",
  business_suspension: "bg-amber-50 text-amber-700 border-amber-200",
  improvement_order: "bg-blue-50 text-blue-700 border-blue-200",
  warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
  guidance: "bg-green-50 text-green-700 border-green-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function RiskAlertsPage() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/risk-alerts");
      if (res.status === 401) {
        window.location.href = "/login?next=/risk-alerts";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markOne = useCallback(async (id) => {
    try {
      await fetch("/api/risk-alerts/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: 1 } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAll = useCallback(async () => {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    try {
      await fetch("/api/risk-alerts/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
      setUnreadCount(0);
    } catch {}
    setMarking(false);
  }, [marking, unreadCount]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ヘッダー */}
        <div className="mb-6">
          <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
            <Link href="/" className="hover:text-blue-600 transition-colors">トップ</Link>
            <span>/</span>
            <Link href="/risk-watch" className="hover:text-blue-600 transition-colors">リスク監視</Link>
            <span>/</span>
            <span className="text-gray-600">リスク通知</span>
          </nav>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                リスク通知
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">
                監視中の事業者に関する行政処分の新着通知です。
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                disabled={marking}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                {marking ? "処理中…" : "すべて既読にする"}
              </button>
            )}
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中…</div>
        )}

        {/* 空状態 */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="text-4xl mb-4">🔔</div>
            <h2 className="text-lg font-bold text-gray-700 mb-2">通知はありません</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
              監視中の事業者に新しい行政処分が追加されると、ここに通知が表示されます。
            </p>
            <Link
              href="/risk-watch"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              リスク監視を確認する
            </Link>
          </div>
        )}

        {/* 通知一覧 */}
        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const isUnread = item.is_read === 0;
              const actionColor = ACTION_COLORS[item.action_type] || ACTION_COLORS.other;
              const actionLabel = ACTION_LABELS[item.action_type] || item.action_type;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border p-4 transition-all ${
                    isUnread
                      ? "border-blue-200 shadow-sm"
                      : "border-gray-200 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 未読インジケーター */}
                    <div className="flex-shrink-0 mt-1.5">
                      {isUnread ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-200" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* タイトル */}
                      <p className={`text-sm font-medium mb-1 ${isUnread ? "text-gray-900" : "text-gray-500"}`}>
                        {item.title}
                      </p>

                      {/* バッジ + 日付 */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${actionColor}`}>
                          {actionLabel}
                        </span>
                        {item.action_date && (
                          <span className="text-[11px] text-gray-400">{item.action_date}</span>
                        )}
                        <span className="text-[11px] text-gray-300">
                          {item.created_at ? item.created_at.slice(0, 10) : ""}
                        </span>
                      </div>

                      {/* body */}
                      {item.body && (
                        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">
                          {item.body}
                        </p>
                      )}

                      {/* 導線 */}
                      <div className="flex items-center gap-4 text-xs">
                        {item.action_id && (
                          <Link
                            href={`/gyosei-shobun?id=${item.action_id}`}
                            className="text-blue-600 hover:underline"
                            onClick={() => isUnread && markOne(item.id)}
                          >
                            行政処分を見る →
                          </Link>
                        )}
                        <Link
                          href={`/gyosei-shobun?organization=${encodeURIComponent(item.organization_name)}`}
                          className="text-gray-400 hover:text-blue-600 hover:underline"
                          onClick={() => isUnread && markOne(item.id)}
                        >
                          {item.organization_name} の処分一覧 →
                        </Link>
                      </div>
                    </div>

                    {/* 個別既読ボタン */}
                    {isUnread && (
                      <button
                        onClick={() => markOne(item.id)}
                        className="flex-shrink-0 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-blue-200 hover:text-blue-500 transition-colors"
                        title="既読にする"
                      >
                        既読
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 未読/既読サマリー */}
        {!loading && items.length > 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {items.length} 件中 {unreadCount} 件未読
          </p>
        )}

      </div>
    </div>
  );
}
