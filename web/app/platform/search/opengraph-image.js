import { createPlatformOgImage } from "@/lib/platform-og";

export const runtime = "nodejs";
export const alt = "横断検索 — 全ドメインのデータをキーワードで検索";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createPlatformOgImage({
    title: "横断検索",
    subtitle: "全ドメインのデータをキーワードで一括検索",
    icon: "🔍",
  });
}
