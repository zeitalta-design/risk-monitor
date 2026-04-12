export const metadata = {
  title: "許認可・登録事業者データベース — 許認可・登録事業者横断検索 | Risk Monitor",
  description: "建設業許可、宅建業など許認可・登録事業者情報を都道府県、許認可カテゴリ別に横断検索。事業者の保有許認可一覧を一目で確認。",
  openGraph: {
    title: "許認可検索",
    description: "許認可・登録事業者情報を都道府県、許認可カテゴリ別に横断検索。",
  },
  robots: { index: true, follow: true },
};

export default function KyoninkaLayout({ children }) {
  return children;
}
