"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif', background: "#f7f8fa", color: "#333", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "28rem", padding: "3rem 1.5rem" }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 1.5rem", background: "#fef2f2", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" fill="none" stroke="#ef4444" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
            サービスに問題が発生しています
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            大変申し訳ありません。現在サービスに問題が発生しています。<br />
            しばらく時間をおいてから再度アクセスしてください。
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{ padding: "0.75rem 1.5rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "0.75rem", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer" }}
            >
              再読み込み
            </button>
            <a
              href="/"
              style={{ padding: "0.75rem 1.5rem", background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: "0.75rem", fontWeight: 500, fontSize: "0.875rem", textDecoration: "none" }}
            >
              トップページへ
            </a>
          </div>
          {error?.digest && (
            <p style={{ fontSize: "0.625rem", color: "#9ca3af", marginTop: "2rem" }}>
              エラーID: {error.digest}
            </p>
          )}
          <p style={{ fontSize: "0.75rem", color: "#d1d5db", marginTop: "2.5rem" }}>
            Risk Monitor
          </p>
        </div>
      </body>
    </html>
  );
}
