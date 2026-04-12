import Link from "next/link";

/**
 * Phase234: 初回ユーザー導線 — 使い方ステップガイド
 *
 * 4ステップで「大会を探す→詳細を見る→保存する→エントリーする」の流れを案内。
 * トップページ下部に配置。
 */

const STEPS = [
  {
    step: 1,
    title: "大会を探す",
    description: "距離・地域・日程で全国の大会を検索",
    icon: "🔍",
    href: "/marathon",
    cta: "大会を検索",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    step: 2,
    title: "詳細を確認",
    description: "種目・参加費・コース情報をチェック",
    icon: "📋",
    href: "/marathon",
    cta: null,
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  {
    step: 3,
    title: "保存して比較",
    description: "気になる大会を保存・比較して絞り込み",
    icon: "⭐",
    href: "/benefits",
    cta: "会員機能を見る",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    step: 4,
    title: "エントリー",
    description: "公式サイトからお申し込み",
    icon: "🏃",
    href: null,
    cta: null,
    color: "bg-green-50 border-green-200 text-green-700",
  },
];

export default function HowToUseSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-gray-900">Risk Monitorの使い方</h2>
        <p className="text-sm text-gray-500 mt-1">4つのステップで大会選びがかんたんに</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className={`rounded-xl border p-5 ${item.color} relative`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-bold opacity-60">STEP {item.step}</span>
            </div>
            <h3 className="text-sm font-bold mb-1">{item.title}</h3>
            <p className="text-xs opacity-80 leading-relaxed">{item.description}</p>
            {item.cta && item.href && (
              <Link
                href={item.href}
                className="inline-block mt-3 text-xs font-semibold underline opacity-80 hover:opacity-100 transition-opacity"
              >
                {item.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
