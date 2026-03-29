import { NextResponse } from "next/server";

/**
 * メンテナンスモード middleware
 *
 * MAINTENANCE_PATHS に列挙されたパスのみ 503 を返す。
 * それ以外のページ・API・静的ファイル・管理画面は一切影響しない。
 *
 * ロールバック: このファイルを削除（または MAINTENANCE_ENABLED = false）して再デプロイ。
 */

// ──────────────────────────────────────
// メンテナンス ON/OFF スイッチ
// ──────────────────────────────────────
const MAINTENANCE_ENABLED = true;

// ──────────────────────────────────────
// 停止対象パス（完全一致）
// ──────────────────────────────────────
const MAINTENANCE_PATHS = new Set([
  // "/" はドメイン入口として公開再開
  "/marathon",
  "/trail",
  "/cycling",
  "/triathlon",
  "/walking",
  "/golf",
  "/swimming",
  "/squash",
  "/workshop",
  "/search",
  "/entry-deadlines",
  "/marathon/theme/beginner",
  "/marathon/theme/sightseeing",
  "/marathon/theme/family",
  "/marathon/prefecture/tokyo",
  "/marathon/prefecture/kanagawa",
  "/marathon/prefecture/osaka",
  "/marathon/prefecture/chiba",
  "/marathon/prefecture/saitama",
  "/marathon/distance/full",
  "/marathon/distance/half",
  "/marathon/distance/10km",
  "/marathon/month/4",
  "/marathon/month/5",
  "/marathon/month/6",
  "/marathon/month/10",
  "/marathon/month/11",
]);

// ──────────────────────────────────────
// メンテナンス HTML
// ──────────────────────────────────────
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>メンテナンス中 | 大会ナビ</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans",
                   "Noto Sans JP", sans-serif;
      background: #f7f8fa;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 520px;
      padding: 48px 24px;
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: #e8edf4;
      border-radius: 16px;
      margin-bottom: 24px;
    }
    .icon svg { width: 32px; height: 32px; color: #4874b8; }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    p {
      font-size: 15px;
      line-height: 1.8;
      color: #666;
    }
    .brand {
      margin-top: 40px;
      font-size: 13px;
      color: #aaa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M11.42 15.17l-5.07-5.07M15.17 11.42l5.07-5.07M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" />
      </svg>
    </div>
    <h1>大会ナビは現在メンテナンス中です</h1>
    <p>
      現在、対象ページは一時的に公開を停止しています。<br>
      ご不便をおかけし申し訳ありません。再開までしばらくお待ちください。
    </p>
    <div class="brand">大会ナビ — taikainavi.jp</div>
  </div>
</body>
</html>`;

// ──────────────────────────────────────
// Middleware 本体
// ──────────────────────────────────────
export function middleware(request) {
  if (!MAINTENANCE_ENABLED) return NextResponse.next();

  // パスを正規化（末尾スラッシュ除去、ただし "/" 自体は除く）
  let pathname = request.nextUrl.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // 完全一致チェック
  if (!MAINTENANCE_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "86400",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

// ──────────────────────────────────────
// matcher: 静的ファイル・API・_next は除外
// ──────────────────────────────────────
export const config = {
  matcher: [
    /*
     * _next/static, _next/image, favicon.ico, api/, public assets を除外
     * それ以外のページリクエストのみ middleware を実行
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|hero/|icons/|og/|screenshots/).*)",
  ],
};
