export const metadata = {
  title: "補助金・支援制度データベース — 国・自治体の補助金・助成金を検索",
  description: "中小企業庁・厚生労働省・自治体等が提供する補助金・助成金・支援制度を業種、対象、募集状態別に検索できます。",
  openGraph: {
    title: "補助金・支援制度データベース",
    description: "国・自治体の補助金・助成金・支援制度を横断検索。",
  },
  robots: { index: true, follow: true },
};

export default function HojokinLayout({ children }) {
  return children;
}
