"use client";

/**
 * ウォッチ通知一覧ページ（Phase J-11）
 *
 * bell dropdown (`WatchNotificationDropdown`) と同じ `/api/watch-notifications`
 * を読んで、あとから見返しやすい一覧として描画する。
 *
 * - フィルタ: すべて / 未読 / 有望案件 (deal_score)
 * - 当日 (JST) の daily cron 由来 deal_score 通知は上部に「今日の有望案件まとめ」
 *   として集約表示。それ以外は通常リスト。
 * - 既存 `/api/watch-notifications/read` / `read-all` を再利用して個別・全件既読。
 *
 * 既存 `/notifications` (sports-event / user_key 系) とは別系統のため分離。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import {
  isDailyDigestItem,
  digestCountLabel,
  domainBadgeClass,
  extractOrgFromTitle,
} from "@/lib/watch-notifications-ui";

const LIMIT = 30;

const STATUS_TABS = [
  { key: "all",    label: "すべて",   apiStatus: "all",    apiType: null },
  { key: "unread", label: "未読",     apiStatus: "unread", apiType: null },
  { key: "deal",   label: "有望案件",  apiStatus: "all",    apiType: "deal_score" },
  { key: "saved",  label: "保存案件",  apiStatus: "all",    apiType: "saved_deal_update" },
];

function formatDate(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return String(s).slice(0, 10);
}

export default function WatchNotificationsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [actioning, setActioning] = useState(false);
  // Phase M-5: 通知は Pro 限定機能
  const [isPro, setIsPro] = useState(null); // null=unknown, true/false

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => { if (!cancelled) setIsPro(!!d?.user?.isPro); })
      .catch(() => !cancelled && setIsPro(false));
    return () => { cancelled = true; };
  }, []);

  // ─── fetch（filter 切替時は cursor リセット） ──
  const fetchItems = useCallback(async (filterKey, cursor = null) => {
    const def = STATUS_TABS.find((t) => t.key === filterKey) || STATUS_TABS[0];
    const params = new URLSearchParams({
      status: def.apiStatus,
      limit:  String(LIMIT),
    });
    if (def.apiType) params.set("type", def.apiType);
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/watch-notifications?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }, []);

  useEffect(() => {
    // Phase M-5: 非 Pro は一覧を読まない（表示側も CTA に差し替え済み）
    if (isPro === false) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchItems(activeFilter)
      .then((d) => {
        if (cancelled) return;
        setItems(d.items || []);
        setNextCursor(d.nextCursor || null);
      })
      .catch((e) => { if (!cancelled) setError(e.message || "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFilter, fetchItems, isPro]);

  async function handleLoadMore() {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const d = await fetchItems(activeFilter, nextCursor);
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...(d.items || []).filter((x) => !seen.has(x.id))];
      });
      setNextCursor(d.nextCursor || null);
    } catch {
      // silent: user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  // ─── 既読操作（/api/watch-notifications/read{,-all}） ──
  function applyLocalRead(idSet) {
    const readAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (idSet.has(n.id) && !n.isRead ? { ...n, isRead: true, readAt } : n)),
    );
  }
  async function markIdsRead(ids) {
    const idSet = new Set((ids || []).filter((x) => Number.isInteger(x) && x > 0));
    if (idSet.size === 0) return;
    applyLocalRead(idSet); // optimistic
    try {
      await fetch("/api/watch-notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...idSet] }),
      });
    } catch { /* next fetch で自然整合 */ }
  }
  async function markAllRead() {
    if (actioning) return;
    setActioning(true);
    try {
      const res = await fetch("/api/watch-notifications/read-all", { method: "POST" });
      if (!res.ok) return;
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: now })));
    } finally {
      setActioning(false);
    }
  }

  // Phase J-12: digest 一括既読はサーバー側の条件指定 UPDATE を呼ぶ。
  //   表示中の digest items は optimistic に既読表示にし、ページング外の
  //   当日 daily 行もサーバー側で同じ UPDATE で一緒に既読化される。
  async function markDailyDigestRead() {
    const now = new Date();
    setItems((prev) =>
      prev.map((n) => (isDailyDigestItem(n, now) && !n.isRead ? { ...n, isRead: true, readAt: now.toISOString() } : n)),
    );
    try {
      await fetch("/api/watch-notifications/read-daily-digest", { method: "POST" });
    } catch { /* next fetch で自然整合 */ }
  }

  function handleRowClick(n) {
    if (!n.isRead) markIdsRead([n.id]);
    if (n.sourceUrl) router.push(n.sourceUrl);
  }

  const now = new Date();
  const digestItems  = items.filter((n) => isDailyDigestItem(n, now));
  const regularItems = items.filter((n) => !isDailyDigestItem(n, now));
  const unreadCount  = items.filter((n) => !n.isRead).length;

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">ウォッチ通知一覧</h1>
          <div className="flex items-center gap-3">
            <Link href="/saved-deals" className="text-xs text-gray-500 hover:text-blue-600">
              ★ 保存した案件 →
            </Link>
            <Link href="/admin/watchlist" className="text-xs text-gray-500 hover:text-blue-600">
              ウォッチリスト →
            </Link>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          ウォッチ対象と保存案件からの通知を見返せます。
        </p>

        {/* Phase M-5: 非 Pro は upgrade CTA のみ表示して以降の一覧 / アクションを出さない */}
        {isPro === false && (
          <div className="card p-10 text-center">
            <h2 className="text-lg font-bold text-gray-900 mb-2">通知は Pro 機能です</h2>
            <p className="text-sm text-gray-600 mb-5">
              締切・状況変化・有望案件の通知をお使いいただくには<br />
              入札ナビ Pro へのアップグレードが必要です。
            </p>
            <Link
              href="/pricing"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
            >
              アップグレード →
            </Link>
          </div>
        )}

        {/* フィルタ + 一括操作（Pro のみ） */}
        {isPro !== false && <>
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveFilter(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    activeFilter === t.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={actioning}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  すべて既読
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 本文 */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-6 text-sm text-red-600">
            通知の取得に失敗しました: {error}
          </div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-gray-500">
              {activeFilter === "unread" ? "未読の通知はありません" : "通知はまだありません"}
            </p>
            {activeFilter !== "unread" && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link href="/nyusatsu" className="text-sm text-blue-600 hover:underline">
                  案件を探す →
                </Link>
                <Link href="/admin/watchlist" className="text-sm text-blue-600 hover:underline">
                  ウォッチを設定 →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            {digestItems.length > 0 && (
              <DailyDigestSection
                items={digestItems}
                onClick={handleRowClick}
                onMarkAllRead={markDailyDigestRead}
              />
            )}

            {regularItems.length > 0 && (
              <ul className="space-y-2">
                {regularItems.map((n) => (
                  <li key={n.id}>
                    <ListRow n={n} onClick={handleRowClick} onToggleRead={() => markIdsRead([n.id])} />
                  </li>
                ))}
              </ul>
            )}

            {nextCursor && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? "読み込み中..." : "もっと見る"}
                </button>
              </div>
            )}
          </>
        )}
        </>}
      </div>
    </AuthGuard>
  );
}

// 今日の有望案件まとめ（dropdown と揃えたセクション表示）
function DailyDigestSection({ items, onClick, onMarkAllRead }) {
  const unreadCount = items.filter((n) => !n.isRead).length;
  return (
    <section className="card mb-4 border-cyan-100 bg-cyan-50/30">
      <div className="px-4 pt-4 pb-2 flex items-center flex-wrap gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-100">
          今日のまとめ
        </span>
        <h2 className="text-sm font-bold text-gray-900">今日の有望案件まとめ</h2>
        <span className="text-xs text-gray-500 ml-auto tabular-nums">
          {digestCountLabel(items)}
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
      <ul className="px-2 pb-3">
        {items.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onClick(n)}
              className={`w-full text-left px-2 py-2 rounded hover:bg-white transition-colors flex items-start gap-2 ${
                n.isRead ? "text-gray-500" : "text-gray-900 font-medium"
              }`}
            >
              {!n.isRead && (
                <span className="mt-1.5 w-1.5 h-1.5 bg-cyan-500 rounded-full shrink-0" aria-hidden="true" />
              )}
              <span className={`text-sm leading-snug line-clamp-2 flex-1 min-w-0 ${n.isRead ? "ml-3" : ""}`}>
                {n.title}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                {formatDate(n.eventDate || n.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 通常行（realtime 含む非 digest）
function ListRow({ n, onClick, onToggleRead }) {
  const isClickable = !!n.sourceUrl;
  const readClass = n.isRead ? "opacity-70 bg-gray-50" : "border-l-4 border-blue-400 bg-white";
  return (
    <div className={`card transition-all ${readClass}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${domainBadgeClass(n.domain)}`}>
              {n.sourceLabel}
            </span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatDate(n.eventDate || n.createdAt)}
            </span>
            {n.frequency === "daily" && (
              <span className="text-[10px] text-gray-400">（日次）</span>
            )}
            {!n.isRead && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" aria-hidden="true" />
            )}
          </div>
          {isClickable ? (
            <button
              onClick={() => onClick(n)}
              className={`text-left text-sm leading-snug line-clamp-2 hover:text-blue-600 transition-colors ${
                n.isRead ? "text-gray-500" : "text-gray-900 font-medium"
              }`}
            >
              {n.title}
            </button>
          ) : (
            <p className={`text-sm leading-snug line-clamp-2 ${n.isRead ? "text-gray-500" : "text-gray-900 font-medium"}`}>
              {n.title}
            </p>
          )}
          {n.organizationName && n.organizationName !== extractOrgFromTitle(n.title) && (
            <p className="text-[11px] text-gray-400 mt-1 truncate">{n.organizationName}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          {isClickable && (
            <Link
              href={n.sourceUrl}
              onClick={() => { if (!n.isRead) onToggleRead?.(); }}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              詳細 →
            </Link>
          )}
          {!n.isRead && (
            <button
              onClick={() => onToggleRead?.()}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              既読にする
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
