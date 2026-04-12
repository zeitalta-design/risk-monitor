import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "Risk Monitor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { id } = await params;

  let title = "マラソン大会";
  let subtitle = "";
  try {
    const db = getDb();
    const event = db.prepare("SELECT title, prefecture, event_date FROM events WHERE id = ?").get(id);
    if (event) {
      title = event.title;
      const parts = [];
      if (event.event_date) {
        const d = new Date(event.event_date);
        parts.push(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
      }
      if (event.prefecture) parts.push(event.prefecture);
      subtitle = parts.join("  ");
    }
  } catch {}

  // タイトルが長い場合は切り詰め
  const displayTitle = title.length > 30 ? title.slice(0, 28) + "..." : title;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: "100%",
            wordBreak: "break-word",
          }}
        >
          {displayTitle}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.8)",
              marginTop: 20,
            }}
          >
            {subtitle}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            大
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Risk Monitor — taikainavi.jp
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
