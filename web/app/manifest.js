export default function manifest() {
  return {
    name: "Risk Monitor",
    short_name: "Risk Monitor",
    description: "企業リスク監視プラットフォーム — 行政処分・入札情報・補助金など業務で使える公開データを横断検索",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    // アイコン画像を作成後に差し替え
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
