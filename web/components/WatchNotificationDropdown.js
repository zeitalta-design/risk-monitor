"use client";

/**
 * ウォッチ通知ドロップダウン
 *
 * - タブ（未読 / すべて）切替
 * - 一覧取得・もっと見る・個別既読・全件既読
 * - status ごとに独立キャッシュ（タブ往復で不要 fetch を避ける）
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isDailyDigestItem,
  digestCountLabel,
  domainBadgeClass,
  extractOrgFromTitle,
} from "@/lib/watch-notifications-ui";

const TABS = [
  { key: "unread", label: "未読" },
  { key: "all",    label: "すべて" },
];

const LIMIT = 20;
const UNREAD_CHANGED_EVENT = "watch-notifications:unread-changed";

// PC / mobile 両方の Bell に unread 変化を伝播する軽量イベント。
// グローバル state は入れず、window dispatch で済ませる。
function dispatchUnreadChanged(detail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(UNREAD_CHANGED_EVENT, { detail }));
  } catch { /* IE 等のない環境は諦める */ }
}
const emptyTab = () => ({ items: [], nextCursor: null, loaded: false, loading: false, error: null });

// Phase J-11: digest 判定ロジックは dropdown と一覧ページで共通化
// (`@/lib/watch-notifications-ui`)。

export default function WatchNotificationDropdown({ onClose, onHasUnreadChange }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("unread");
  const [cache, setCache] = useState({ unread: emptyTab(), all: emptyTab() });
  const [loadingMore, setLoadingMore] = useState(false);

  // タブ初回 fetch（React strict mode の二重実行では dropdown 親側の open 制御で
  // そもそも二重マウントが発生しないので、安全装置としての mounted ref は使わない。
  // AbortController で多重 fetch を捨てればよい。）
  const loadTab = useCallback(async (tab) => {
    setCache((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true, error: null } }));
    try {
      const res = await fetch(`/api/watch-notifications?status=${tab}&limit=${LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setCache((prev) => ({
        ...prev,
        [tab]: {
          items:      d.items || [],
          nextCursor: d.nextCursor || null,
          loaded:     true,
          loading:    false,
          error:      null,
        },
      }));
    } catch (e) {
      setCache((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], loading: false, error: e.message || "error" },
      }));
    }
  }, []);

  useEffect(() => {
    const t = cache[activeTab];
    if (!t.loaded && !t.loading && !t.error) loadTab(activeTab);
  }, [activeTab, cache, loadTab]);

  // もっと見る
  async function loadMore() {
    if (loadingMore) return;
    const t = cache[activeTab];
    if (!t.nextCursor) return;
    setLoadingMore(true);
    try {
      const url = `/api/watch-notifications?status=${activeTab}&limit=${LIMIT}&cursor=${encodeURIComponent(t.nextCursor)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setCache((prev) => {
        const existing = prev[activeTab];
        const existingIds = new Set(existing.items.map((i) => i.id));
        const fresh = (d.items || []).filter((i) => !existingIds.has(i.id));
        return {
          ...prev,
          [activeTab]: {
            ...existing,
            items:      [...existing.items, ...fresh],
            nextCursor: d.nextCursor || null,
          },
        };
      });
    } catch {
      // silent fail, user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  // 既読化（optimistic、ids 配列）。単体既読・digest 一括既読の共通経路。
  function markIdsReadLocal(ids) {
    const idSet = new Set((ids || []).filter((x) => Number.isInteger(x) && x > 0));
    if (idSet.size === 0) return;
    const readAt = new Date().toISOString();
    setCache((prev) => {
      const update = (t) => ({
        ...t,
        items: t.items.map((n) => (idSet.has(n.id) && !n.isRead ? { ...n, isRead: true, readAt } : n)),
      });
      return { unread: update(prev.unread), all: update(prev.all) };
    });
    // 未読タブで残件 0 なら bell ドット消す（pre-update cache を参照するが id を除外判定なので OK）
    const stillUnread = cache.unread.items.some((n) => !idSet.has(n.id) && !n.isRead);
    if (!stillUnread) {
      onHasUnreadChange?.(false);
      dispatchUnreadChanged({ count: 0, hasUnread: false });
    }

    // fire-and-forget API 呼び出し。失敗しても UI 崩さない（次回取得で自然整合）
    fetch("/api/watch-notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...idSet] }),
    }).catch(() => {});
  }
  function markReadLocal(id) { markIdsReadLocal([id]); }

  // Phase J-12: digest 一括既読はサーバー側で条件指定 UPDATE に切り替え。
  //   表示中の digest items も optimistic に既読表示にする（ページング外の
  //   当日 daily 行はサーバー側で一緒に既読化される）。
  function markDailyDigestRead() {
    const readAt = new Date().toISOString();
    setCache((prev) => {
      const update = (t) => ({
        ...t,
        items: t.items.map((n) => (isDailyDigestItem(n, new Date()) && !n.isRead ? { ...n, isRead: true, readAt } : n)),
      });
      return { unread: update(prev.unread), all: update(prev.all) };
    });
    const stillUnread = cache.unread.items.some((n) => !isDailyDigestItem(n, new Date()) && !n.isRead);
    if (!stillUnread) {
      onHasUnreadChange?.(false);
      dispatchUnreadChanged({ count: 0, hasUnread: false });
    }
    fetch("/api/watch-notifications/read-daily-digest", { method: "POST" }).catch(() => {});
  }

  // 行クリック
  function handleRowClick(n) {
    if (!n.isRead) markReadLocal(n.id);
    if (n.sourceUrl) {
      onClose?.();
      router.push(n.sourceUrl);
    }
  }

  // 全件既読
  async function markAllRead() {
    try {
      const res = await fetch("/api/watch-notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      return; // 失敗時は UI 変更なし
    }
    const now = new Date().toISOString();
    setCache((prev) => {
      const update = (t) => ({
        ...t,
        items: t.items.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: now })),
      });
      return { unread: update(prev.unread), all: update(prev.all) };
    });
    onHasUnreadChange?.(false);
    dispatchUnreadChanged({ count: 0, hasUnread: false });
  }

  const tab = cache[activeTab];
  const hasAnyUnreadInTab = tab.items.some((n) => !n.isRead);

  // Phase J-9: 当日 daily の deal_score 通知は digest セクションにまとめ、
  // 通常リストからは外す（同じ通知の二重表示を避ける）。
  const now = new Date();
  const digestItems = tab.items.filter((n) => isDailyDigestItem(n, now));
  const regularItems = tab.items.filter((n) => !isDailyDigestItem(n, now));

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
      role="dialog"
      aria-label="ウォッチ通知"
    >
      {/* ヘッダ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">通知</h3>
        <button
          onClick={markAllRead}
          disabled={!hasAnyUnreadInTab}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          すべて既読
        </button>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-100 bg-gray-50/50" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === t.key
                ? "text-blue-700 border-b-2 border-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 本文 */}
      <div className="max-h-[420px] overflow-y-auto">
        {tab.loading && !tab.loaded && <DropdownSkeleton />}
        {tab.error && (
          <div className="p-6 text-center text-xs text-gray-600">
            <p className="mb-2 text-red-500">通知の取得に失敗しました</p>
            <button
              onClick={() => loadTab(activeTab)}
              className="text-blue-600 hover:underline"
            >
              再読み込み
            </button>
          </div>
        )}
        {!tab.loading && !tab.error && tab.items.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            {activeTab === "unread" ? "未読の通知はありません" : "通知はまだありません"}
          </div>
        )}

        {/* Phase J-9/J-10/J-12: 今日の有望案件まとめ（daily cron で insert された当日分） */}
        {digestItems.length > 0 && (
          <DailyDigestPanel
            items={digestItems}
            onClick={handleRowClick}
            onMarkAllRead={markDailyDigestRead}
          />
        )}

        {regularItems.length > 0 && (
          <ul>
            {regularItems.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} onClick={handleRowClick} />
              </li>
            ))}
            {tab.nextCursor && (
              <li className="border-t border-gray-100">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-xs text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {loadingMore ? "読み込み中..." : "もっと見る"}
                </button>
              </li>
            )}
          </ul>
        )}
        {/* digest のみで regular が空のとき「もっと見る」を維持する */}
        {regularItems.length === 0 && digestItems.length > 0 && tab.nextCursor && (
          <div className="border-t border-gray-100">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-xs text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {loadingMore ? "読み込み中..." : "もっと見る"}
            </button>
          </div>
        )}
      </div>

      {/* Phase J-11: 通知一覧ページへの導線 */}
      <div className="border-t border-gray-100 bg-gray-50/50">
        <Link
          href="/watch-notifications"
          onClick={() => onClose?.()}
          className="block w-full py-2 text-center text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
        >
          すべて見る →
        </Link>
      </div>
    </div>
  );
}

// Phase J-9/J-10: 当日分 daily digest の簡易まとめ表示。
//   - 件数ヘッダ（未読 N / 全 M 件）
//   - 「まとめて既読」: unread 分のみ markIdsReadLocal で既読化（既存 API 再利用）
//   - タイトル一覧はクリックで onClick (= handleRowClick) に委譲
//   既存 NotificationRow と同じ既読化・遷移フローを使うので read / sourceUrl は不変。
function DailyDigestPanel({ items, onClick, onMarkAllRead }) {
  const unreadCount = items.filter((n) => !n.isRead).length;
  const countLabel = digestCountLabel(items);
  return (
    <div className="border-b border-gray-100 bg-cyan-50/40">
      <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-100">
          今日のまとめ
        </span>
        <span className="text-xs font-bold text-gray-900">今日の有望案件まとめ</span>
        <span className="text-[11px] text-gray-500 ml-auto tabular-nums">
          {countLabel}
        </span>
      </div>
      {unreadCount > 0 && (
        <div className="px-4 pb-1 flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMarkAllRead?.(); }}
            className="text-[11px] text-cyan-700 hover:text-cyan-900 underline-offset-2 hover:underline"
          >
            まとめて既読
          </button>
        </div>
      )}
      <ul className="px-2 pb-2">
        {items.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onClick(n)}
              className={`w-full text-left px-2 py-1.5 rounded hover:bg-white transition-colors flex items-start gap-1.5 ${
                n.isRead ? "text-gray-500" : "text-gray-900 font-medium"
              }`}
            >
              {!n.isRead && (
                <span className="mt-1.5 w-1.5 h-1.5 bg-cyan-500 rounded-full shrink-0" aria-hidden="true" />
              )}
              <span className={`text-xs leading-snug line-clamp-2 flex-1 min-w-0 ${n.isRead ? "ml-3" : ""}`}>
                {n.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DropdownSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-3 bg-gray-100 rounded w-12" />
            <div className="h-3 bg-gray-100 rounded w-16" />
          </div>
          <div className="h-3 bg-gray-100 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function NotificationRow({ n, onClick }) {
  const isClickable = !!n.sourceUrl;
  const cursorClass = isClickable ? "cursor-pointer" : "cursor-default";
  const readBg = n.isRead ? "bg-white" : "bg-blue-50/40";
  return (
    <div
      onClick={() => onClick(n)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(n); }
      }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`px-4 py-2.5 border-b border-gray-50 ${readBg} ${cursorClass} ${isClickable ? "hover:bg-gray-50" : ""} transition-colors`}
    >
      <div className="flex items-start gap-2">
        {!n.isRead && (
          <span className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" aria-hidden="true" />
        )}
        <div className={`flex-1 min-w-0 ${n.isRead ? "ml-3" : ""}`}>
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${domainBadgeClass(n.domain)}`}>
              {n.sourceLabel}
            </span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatDate(n.eventDate || n.createdAt)}
            </span>
          </div>
          <p className={`text-xs leading-snug line-clamp-2 ${n.isRead ? "text-gray-500" : "text-gray-900 font-medium"}`}>
            {n.title}
          </p>
          {n.organizationName && n.organizationName !== extractOrgFromTitle(n.title) && (
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
              {n.organizationName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return String(s).slice(0, 10);
}

