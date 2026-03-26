import { createPlatformOgImage } from "@/lib/platform-og";

export const runtime = "nodejs";
export const alt = "データプラットフォーム — 複数ドメインのデータを横断的に検索・比較";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createPlatformOgImage({
    title: "データプラットフォーム",
    subtitle: "複数ドメインのデータを横断的に検索・比較",
    icon: "🌐",
  });
}
