export const metadata = {
  title: "産廃処分データベース — 産業廃棄物処理業者・行政処分情報を検索 | Risk Monitor",
  description: "産業廃棄物処理業者の行政処分情報を都道府県、許可種別、リスクレベル別に検索。処分履歴タイムラインで事業者のリスクを可視化。",
  openGraph: {
    title: "産廃処分ウォッチ",
    description: "産業廃棄物処理業者の行政処分情報を都道府県、許可種別、リスクレベル別に検索。",
  },
  robots: { index: true, follow: true },
};

export default function SanpaiLayout({ children }) {
  return children;
}
