import { notFound } from "next/navigation";
import { getSportBySlug, buildSportMetadata } from "@/lib/sport-config";

/**
 * 動的スポーツルートのレイアウト
 *
 * /[sportSlug] にマッチするが、/marathon は既存静的ルートが優先される。
 * 既知スポーツ（enabled=false 含む）はページを表示する。
 * 未知のスラグのみ 404。
 */

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) return {};
  return buildSportMetadata(sportSlug);
}

export default async function SportLayout({ children, params }) {
  const { sportSlug } = await params;
  const sport = getSportBySlug(sportSlug);

  // 未知のスラグ → 404
  if (!sport) {
    notFound();
  }

  // 既知スポーツ（enabled=false 含む）→ ページ表示
  return children;
}
