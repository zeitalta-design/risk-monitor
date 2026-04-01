"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

/**
 * Phase229: ログイン画面（改善版）
 * - 管理者ログインの信頼感
 * - レート制限エラー表示
 * - アクセス拒否時のリダイレクト対応
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded w-32 mx-auto" />
        <div className="h-6 bg-gray-200 rounded w-24 mx-auto" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?next= (risk-watch系) / ?redirect= (既存) 両方対応
  const nextParam = searchParams.get("next");
  const redirectParam = searchParams.get("redirect");
  const redirectTo = nextParam || redirectParam || "/";
  const denied = searchParams.get("denied") === "1";
  // ウォッチ系ページからのリダイレクト判定
  const isWatchContext = nextParam && (nextParam.startsWith("/risk") || nextParam.startsWith("/gyosei"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    denied ? "このページにアクセスするにはログインが必要です" : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "ログインに失敗しました");
        return;
      }

      // 管理者の場合は管理画面へ
      if (data.user?.role === "admin" && redirectTo === "/") {
        router.push("/admin/ops");
      } else {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image
              src={siteConfig.logoImage}
              alt={siteConfig.siteName}
              width={140}
              height={42}
              className="h-10 w-auto mx-auto"
              priority
            />
          </Link>
        </div>

        <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">
          ログイン
        </h1>
        {isWatchContext ? (
          <p className="text-xs text-center mb-6 px-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-1.5 text-[11px] font-medium">
              👁 ウォッチ登録・リスク監視にはログインが必要です
            </span>
          </p>
        ) : (
          <p className="text-xs text-gray-500 text-center mb-6">
            アカウント情報を入力してください
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
        >
          {/* エラー表示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <svg
                className="w-4 h-4 mt-0.5 shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="8文字以上"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <p className="text-sm text-gray-500">
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:underline font-medium"
            >
              パスワードを忘れた方
            </Link>
          </p>
          <p className="text-sm text-gray-500">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-blue-600 hover:underline font-medium">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
