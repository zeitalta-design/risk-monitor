"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order: "改善命令",
  warning: "指示・警告",
  guidance: "指導・勧告",
  other: "その他",
};
const ACTION_COLORS = {
  license_revocation: "text-red-700 bg-red-50",
  business_suspension: "text-orange-700 bg-orange-50",
  improvement_order: "text-amber-700 bg-amber-50",
  warning: "text-blue-700 bg-blue-50",
  guidance: "text-gray-700 bg-gray-50",
};
const INDUSTRY_LABELS = {
  construction: "建設業",
  real_estate: "宅建業",
  architecture: "建築士",
  transport: "運送業",
};

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/watchlist");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Watchlist fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleRemove(item) {
    if (!confirm(`「${item.organization_name}」のウォッチを解除しますか？`)) return;
    try {
      await fetch("/api/admin/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      fetchItems();
    } catch (err) {
      console.error("Remove watch error:", err);
    }
  }

  async function handleMarkSeen(item) {
    try {
      await fetch(`/api/admin/watchlist/${item.id}/seen`, { method: "POST" });
      fetchItems();
    } catch (err) {
      console.error("Mark seen error:", err);
    }
  }

  async function handleMarkAllSeen() {
    try {
      await fetch("/api/admin/watchlist/seen", { method: "POST" });
      fetchItems();
    } catch (err) {
      console.error("Mark all seen error:", err);
    }
  }

  async function handleNotify(dryRun) {
    setNotifying(true);
    setNotifyResult(null);
    try {
      const res = await fetch("/api/admin/watchlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setNotifyResult(data);
      if (!dryRun) fetchItems();
    } catch (err) {
      setNotifyResult({ success: false, error: err.message });
    } finally {
      setNotifying(false);
    }
  }

  const newCount = items.filter((i) => i.has_new).length;
  const pendingNotifyCount = items.filter((i) => i.has_pending_notification).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            👁 ウォッチリスト
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length}件登録中
            {newCount > 0 && (
              <span className="ml-2 text-red-600 font-bold">（{newCount}件 新着あり）</span>
            )}
            {pendingNotifyCount > 0 && (
              <span className="ml-2 text-blue-600">（{pendingNotifyCount}件 未通知）</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {newCount > 0 && (
            <button onClick={handleMarkAllSeen} className="text-xs text-gray-500 hover:text-blue-600 border rounded-lg px-3 py-1.5">
              すべて確認済みにする
            </button>
          )}
          <button
            onClick={() => handleNotify(true)}
            disabled={notifying}
            className="text-xs text-gray-500 hover:text-blue-600 border rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {notifying ? "確認中..." : "通知チェック（dry run）"}
          </button>
          {pendingNotifyCount > 0 && (
            <button
              onClick={() => {
                if (!confirm(`${pendingNotifyCount}件の未通知ウォッチについてメール通知を送信しますか？`)) return;
                handleNotify(false);
              }}
              disabled={notifying}
              className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {notifying ? "送信中..." : "通知送信"}
            </button>
          )}
        </div>
      </div>

      {/* 通知結果 */}
      {notifyResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${notifyResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {notifyResult.dryRun ? (
            <p>
              <strong>[dry run]</strong> 通知対象: {notifyResult.usersNotified || 0}ユーザー / {notifyResult.watchesNotified || 0}ウォッチ
              {notifyResult.details?.map((d, i) => (
                <span key={i} className="block ml-4 text-xs text-gray-600">
                  → {d.email}: {d.watchCount}件 ({d.subject})
                </span>
              ))}
            </p>
          ) : notifyResult.success ? (
            <p>送信完了: {notifyResult.emailsSent}通送信</p>
          ) : (
            <p>エラー: {notifyResult.error || `${notifyResult.emailsFailed}件失敗`}</p>
          )}
          <button onClick={() => setNotifyResult(null)} className="text-xs underline mt-1">閉じる</button>
        </div>
      )}

      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">👁</div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">ウォッチ登録がありません</h2>
          <p className="text-sm text-gray-500 mb-4">
            行政処分一覧で気になる企業の「ウォッチ」ボタンを押すと、<br />
            ここに表示されます。
          </p>
          <Link href="/admin/gyosei-shobun" className="text-sm text-blue-600 hover:underline">
            行政処分一覧を見る →
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left text-xs font-bold text-gray-500">企業名</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">業種</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">都道府県</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分件数</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">最新処分日</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">最新処分種別</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">状態</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">通知</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`border-b hover:bg-gray-50 ${item.has_new ? "bg-red-50/30" : ""}`}>
                  <td className="p-3 font-medium text-gray-900">
                    {item.latest_slug ? (
                      <Link href={`/gyosei-shobun/${item.latest_slug}`} className="hover:text-blue-600 hover:underline">
                        {item.organization_name}
                      </Link>
                    ) : (
                      item.organization_name
                    )}
                  </td>
                  <td className="p-3 text-gray-600">
                    {INDUSTRY_LABELS[item.industry] || item.industry || "—"}
                  </td>
                  <td className="p-3 text-gray-600">{item.prefecture || "—"}</td>
                  <td className="p-3 text-gray-900 font-medium">{item.action_count || 0}件</td>
                  <td className="p-3 text-gray-600">{item.latest_action_date?.substring(0, 10) || "—"}</td>
                  <td className="p-3">
                    {item.latest_action_type ? (
                      <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${ACTION_COLORS[item.latest_action_type] || ""}`}>
                        {ACTION_LABELS[item.latest_action_type] || item.latest_action_type}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3">
                    {item.has_new ? (
                      <button
                        onClick={() => handleMarkSeen(item)}
                        className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer"
                        title="クリックで確認済みにする"
                      >
                        新着
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">確認済み</span>
                    )}
                  </td>
                  <td className="p-3">
                    {item.has_pending_notification ? (
                      <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        未通知
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400" title={item.last_notified_action_date ? `最終通知: ${item.last_notified_action_date.substring(0, 10)}` : ""}>
                        {item.last_notified_action_date ? "通知済み" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/gyosei-shobun?keyword=${encodeURIComponent(item.organization_name)}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        処分一覧
                      </Link>
                      <button
                        onClick={() => handleRemove(item)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        解除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex gap-4">
        <Link href="/admin/gyosei-shobun" className="text-sm text-gray-500 hover:underline">
          ← 行政処分一覧
        </Link>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← 管理トップ
        </Link>
      </div>
    </div>
  );
}
