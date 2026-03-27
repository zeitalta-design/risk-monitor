export const metadata = {
  title: "食品リコール監視 — 食品リコール・自主回収情報を検索",
  description: "食品のリコール・自主回収情報を食品カテゴリ、リスクレベル、原因別に検索。最新のリコール情報をリアルタイムで監視。",
  openGraph: {
    title: "食品リコール監視",
    description: "食品のリコール・自主回収情報を食品カテゴリ、リスクレベル、原因別に検索。",
  },
  robots: { index: true, follow: true },
};

export default function FoodRecallLayout({ children }) {
  return children;
}
