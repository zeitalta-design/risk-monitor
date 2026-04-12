export const metadata = {
  title: "指定管理者データベース — 自治体の指定管理者・公募情報を横断検索 | Risk Monitor",
  description: "全国の自治体が公募する指定管理者制度・業務委託案件を施設種別、都道府県、募集状態別に横断検索。応募期限・募集状況をリアルタイムに確認。",
  openGraph: {
    title: "指定管理公募まとめ",
    description: "自治体の指定管理者・業務委託公募情報を横断検索。",
  },
  robots: { index: true, follow: true },
};

export default function ShiteiLayout({ children }) {
  return children;
}
