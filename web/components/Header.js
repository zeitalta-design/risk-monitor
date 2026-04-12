"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import { siteConfig } from "@/lib/site-config";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [riskUnreadCount, setRiskUnreadCount] = useState(0);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchRiskUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/risk-alerts");
      if (res.ok) {
        const data = await res.json();
        setRiskUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setUser(null);
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } catch {}
  }

  const pathname = usePathname();
  const isLoggedIn = user !== undefined && user !== null;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isLoggedIn) fetchRiskUnread();
  }, [isLoggedIn, fetchRiskUnread]);

  // 公開カテゴリナビ（6カテゴリ統一）
  const domainNavLinks = useMemo(() => [
    { href: "/gyosei-shobun", label: "行政処分", key: "gyosei-shobun" },
    { href: "/sanpai",        label: "産廃処分",   key: "sanpai" },
    { href: "/nyusatsu",      label: "入札",       key: "nyusatsu" },
    { href: "/shitei",        label: "指定管理",   key: "shitei" },
    { href: "/hojokin",       label: "補助金",     key: "hojokin" },
    { href: "/kyoninka",      label: "許認可",     key: "kyoninka" },
  ], []);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      {/* メインヘッダー */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* 左: ロゴ */}
        <Link href="/" className="flex items-center shrink-0 group gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1A3F6B] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-tight group-hover:opacity-80 transition-opacity" style={{ color: "#1A3F6B" }}>
            Risk Monitor
          </span>
        </Link>

        {/* 中央: ドメインナビ（PC） — 公開6カテゴリ */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="メインナビゲーション">
          <NavLink href="/gyosei-shobun" label="行政処分" active={pathname.startsWith("/gyosei-shobun")} />
          <NavLink href="/sanpai"        label="産廃処分"  active={pathname.startsWith("/sanpai")} />
          <NavLink href="/nyusatsu"      label="入札"      active={pathname.startsWith("/nyusatsu")} />
          <NavLink href="/shitei"        label="指定管理"  active={pathname.startsWith("/shitei")} />
          <NavLink href="/hojokin"       label="補助金"    active={pathname.startsWith("/hojokin")} />
          <NavLink href="/kyoninka"      label="許認可"    active={pathname.startsWith("/kyoninka")} />
        </nav>

        {/* 右: ユーザー導線（PC） */}
        <div className="hidden sm:flex items-center gap-2 text-sm">
          {isLoggedIn && (
            <>
              <HeaderIconLink href="/favorites" label="お気に入り">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </HeaderIconLink>
              <HeaderIconLink href="/saved-searches" label="保存検索">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </HeaderIconLink>
              {/* リスク監視アイコン（眼→/risk-watch）+ 未読バッジ（→/risk-alerts） */}
              <div className="relative">
                <Link
                  href="/risk-watch"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title="リスク監視"
                >
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                {riskUnreadCount > 0 && (
                  <Link
                    href="/risk-alerts"
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full hover:bg-red-600 transition-colors"
                    title="リスク通知を見る"
                  >
                    {riskUnreadCount > 9 ? "9+" : riskUnreadCount}
                  </Link>
                )}
              </div>
              <NotificationBell />
            </>
          )}
          {isAdmin && (
            <Link href="/admin/ops" className="text-gray-400 hover:text-gray-600 transition-colors font-medium text-[11px] border border-gray-200 rounded px-2 py-0.5">
              管理
            </Link>
          )}
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200">
            {user === undefined ? null : isLoggedIn ? (
              <>
                <span className="text-sm hidden md:inline text-gray-700 font-medium">
                  {user.name || user.email}
                </span>
                <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-red-500 transition-colors font-medium">
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-blue-600 transition-colors font-bold text-sm">
                  ログイン
                </Link>
                <Link href="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm shadow-sm">
                  会員登録
                </Link>
              </>
            )}
          </div>
        </div>

        {/* モバイルボタン群 */}
        <div className="flex sm:hidden items-center gap-2">
          {isLoggedIn && <NotificationBell />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-700"
            aria-label="メニュー"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {/* 公開カテゴリ */}
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider pt-1 pb-0.5">カテゴリ</p>
          {domainNavLinks.map((link) => (
            <MobileNavLink key={link.key} href={link.href} label={link.label} onClick={() => setMenuOpen(false)} />
          ))}
          {/* マイページ / 会員機能 */}
          <div className="my-2 border-t border-gray-100" />
          {isLoggedIn ? (
            <>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider pt-1 pb-0.5">マイページ</p>
              <MobileNavLink href="/risk-watch"   label={`ウォッチリスト${riskUnreadCount > 0 ? ` (${riskUnreadCount})` : ""}`} onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/risk-alerts"  label="リスク通知"    onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/favorites"    label="お気に入り"    onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/notifications" label="通知一覧"     onClick={() => setMenuOpen(false)} />
              {isAdmin && (
                <MobileNavLink href="/admin/ops" label="管理" onClick={() => setMenuOpen(false)} className="text-gray-400" />
              )}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">{user.name || user.email}</span>
                <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-600">
                  ログアウト
                </button>
              </div>
            </>
          ) : user === undefined ? null : (
            <div className="flex items-center gap-3 py-2">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">
                ログイン
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
                会員登録
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`px-3.5 py-2 text-sm font-bold rounded-lg transition-colors ${
        active
          ? "text-blue-700 bg-blue-50"
          : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

function HeaderIconLink({ href, label, children }) {
  return (
    <Link
      href={href}
      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title={label}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, label, onClick, className = "" }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-2.5 text-base font-medium text-gray-700 hover:text-blue-600 ${className}`}
    >
      {label}
    </Link>
  );
}
