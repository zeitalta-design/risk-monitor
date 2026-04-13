export const metadata = {
  title: "運営管理",
  robots: { index: false, follow: false },
};

/**
 * 運営管理画面レイアウト
 * サイドバーは親の admin/layout.js で表示されるため、ここではchildrenのみ
 */
export default function OpsLayout({ children }) {
  return children;
}
