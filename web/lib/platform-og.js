import { ImageResponse } from "next/og";

const SIZE = { width: 1200, height: 630 };

/**
 * /platform 系ページ共通の OGP 画像生成
 * @param {object} opts
 * @param {string} opts.title - メインタイトル
 * @param {string} opts.subtitle - サブタイトル
 * @param {string} opts.icon - 絵文字アイコン
 * @param {string} [opts.alt] - alt テキスト
 */
export function createPlatformOgImage({ title, subtitle, icon, alt }) {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* アイコン */}
        <div style={{ fontSize: 72, marginBottom: 24 }}>{icon}</div>

        {/* メインタイトル */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        {/* サブタイトル */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 500,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>

        {/* ブランド表記 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 48,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.08em",
            }}
          >
            スポログ データプラットフォーム
          </div>
        </div>
      </div>
    ),
    { ...SIZE }
  );
}

export const platformOgConfig = {
  size: SIZE,
  contentType: "image/png",
  runtime: "nodejs",
};
