import { createPlatformOgImage } from "@/lib/platform-og";

export const runtime = "nodejs";
export const alt = "ダッシュボード — 統計・新着・ランキングを一覧";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createPlatformOgImage({
    title: "ダッシュボード",
    subtitle: "全ドメインの統計・新着・ランキングを一覧",
    icon: "📊",
  });
}
