import { NextResponse } from "next/server";

/**
 * middleware — Edge Runtime互換版
 *
 * 1. /admin/ 配下 → セッションCookie有無チェック（署名検証はServer Componentに委譲）
 * 2. メンテナンスパス → 503
 *
 * Note: Edge Runtimeでは Node.js crypto が使えないため、
 *       HMAC署名検証は AdminGuard（クライアント）と requireAdminApi（サーバー）で実施。
 */

const SESSION_COOKIE = "mvp_session";

// ════════════════════════════════════════
// メンテナンスモード
// ════════════════════════════════════════

const MAINTENANCE_ENABLED = true;

const MAINTENANCE_PATHS = new Set([
  "/marathon", "/trail", "/cycling", "/triathlon", "/walking",
  "/golf", "/swimming", "/squash", "/workshop", "/search", "/entry-deadlines",
]);

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>メンテナンス中 | 大海ナビ</title>
  <style>
    body { font-family: sans-serif; background: #f7f8fa; color: #333; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
    .c { text-align: center; max-width: 520px; padding: 48px 24px; }
    h1 { font-size: 22px; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.8; color: #666; }
  </style>
</head>
<body>
  <div class="c">
    <h1>現在メンテナンス中です</h1>
    <p>対象ページは一時的に公開を停止しています。再開までしばらくお待ちください。</p>
  </div>
</body>
</html>`;

// ════════════════════════════════════════
// Middleware 本体
// ════════════════════════════════════════

export function middleware(request) {
  let pathname = request.nextUrl.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // 1. /admin/ 配下の認証保護（Cookie有無のみチェック）
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("denied", "1");
      return NextResponse.redirect(loginUrl);
    }
    // Cookie存在 → 通過（署名検証はAdminGuard/APIガードで実施）
    return NextResponse.next();
  }

  // 2. メンテナンスモード
  if (MAINTENANCE_ENABLED && MAINTENANCE_PATHS.has(pathname)) {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "86400",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return NextResponse.next();
}

// ════════════════════════════════════════
// matcher
// ════════════════════════════════════════

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|hero/|icons/|og/|screenshots/).*)",
  ],
};
