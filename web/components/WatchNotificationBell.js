"use client";

/**
 * ウォッチ通知ベル — cross-domain 企業ウォッチ用の in-app 通知
 *
 * - /api/watch-notifications/* を参照
 * - 未読あり時に右上にドット表示
 * - クリックでドロップダウン開閉
 *
 * 既存 components/NotificationBell.js（sports-event 系汎用通知）とは別系統。
 *
 * PC / mobile の Bell 間の unread 状態同期:
 *   グローバル state / context は使わず、custom event
 *   "watch-notifications:unread-changed" を window で listen する。
 *   Dropdown が read / read-all 成功時に dispatch する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import WatchNotificationDropdown from "./WatchNotificationDropdown";

export const UNREAD_CHANGED_EVENT = "watch-notifications:unread-changed";

export default function WatchNotificationBell() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const rootRef = useRef(null);

  // mount 時に unread-count 専用エンドポイントで初期化
  const checkUnread = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/watch-notifications/unread-count", { signal });
      if (!res.ok) return;
      const d = await res.json();
      setHasUnread((d.count || 0) > 0);
    } catch { /* ignore 401 / abort */ }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    checkUnread(ac.signal);
    return () => ac.abort();
  }, [checkUnread]);

  // 他の Bell から発火された unread 変化イベントを受信して同期
  useEffect(() => {
    function onUnreadChanged(e) {
      const { hasUnread: next } = e.detail || {};
      if (typeof next === "boolean") setHasUnread(next);
    }
    window.addEventListener(UNREAD_CHANGED_EVENT, onUnreadChanged);
    return () => window.removeEventListener(UNREAD_CHANGED_EVENT, onUnreadChanged);
  }, []);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-50"
        aria-label="ウォッチ通知"
        aria-expanded={open}
        aria-haspopup="true"
        title="ウォッチ通知"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {hasUnread && (
          <span
            className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <WatchNotificationDropdown
          onClose={() => setOpen(false)}
          onHasUnreadChange={setHasUnread}
        />
      )}
    </div>
  );
}
