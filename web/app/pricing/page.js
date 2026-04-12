import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import PremiumBadge from "@/components/PremiumBadge";
import { PLAN_FEATURES } from "@/lib/tier-config";

/**
 * Phase104: 料金ページ /pricing
 *
 * 無料 vs プレミアムの比較表。
 * プレミアムは「準備中」表示。
 */

export const metadata = {
  title: "料金プラン | Risk Monitor",
  description:
    "Risk Monitorの無料プランとプレミアムプランの機能比較。大会の保存・比較・通知など、無料で始められます。",
};

export default function PricingPage() {
  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "料金プラン" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">料金プラン</h1>
        <p className="text-sm text-gray-500">
          基本機能は無料でお使いいただけます
        </p>
      </div>

      {/* プランカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* 無料プラン */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">無料プラン</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ¥0
              <span className="text-sm font-normal text-gray-500 ml-1">
                / 月
              </span>
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            大会探し・保存・比較・通知の基本機能をすべて無料で
          </p>
          <Link
            href="/signup"
            className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            無料で始める
          </Link>
        </div>

        {/* プレミアムプラン */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-6 relative">
          <div className="absolute -top-3 right-4">
            <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              準備中
            </span>
          </div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              プレミアム
              <PremiumBadge />
            </h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              —
              <span className="text-sm font-normal text-gray-500 ml-1">
                / 月
              </span>
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            大会管理をさらに快適に。上限拡張・高度な通知・データ出力
          </p>
          <button
            disabled
            className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed"
          >
            準備中 — 後日お知らせします
          </button>
        </div>
      </div>

      {/* 機能比較表 */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">
          機能比較
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* ヘッダー */}
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
            <div className="p-3 text-xs font-bold text-gray-500">機能</div>
            <div className="p-3 text-xs font-bold text-gray-700 text-center border-l border-gray-200">
              無料
            </div>
            <div className="p-3 text-xs font-bold text-purple-700 text-center border-l border-gray-200">
              プレミアム
            </div>
          </div>

          {/* 行 */}
          {PLAN_FEATURES.map((feat, i) => (
            <div
              key={feat.key}
              className={`grid grid-cols-3 ${
                i < PLAN_FEATURES.length - 1
                  ? "border-b border-gray-100"
                  : ""
              }`}
            >
              <div className="p-3 text-sm text-gray-700">{feat.label}</div>
              <div className="p-3 text-sm text-gray-600 text-center border-l border-gray-100">
                {feat.free}
              </div>
              <div className="p-3 text-sm text-purple-700 font-medium text-center border-l border-gray-100">
                {feat.premium}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">
          よくある質問
        </h2>
        <div className="space-y-4">
          <FaqItem
            q="無料プランで十分ですか？"
            a="はい。大会の検索・保存・比較・通知など、基本的な機能はすべて無料でお使いいただけます。多くのランナーにとって、無料プランで十分な機能を提供しています。"
          />
          <FaqItem
            q="プレミアムプランはいつ開始しますか？"
            a="現在準備中です。開始時期が決まりましたら、登録ユーザーの方にお知らせいたします。"
          />
          <FaqItem
            q="データはどこに保存されますか？"
            a="基本的なデータ（保存・比較・メモなど）はお使いのブラウザに保存されます。会員登録すると、デバイス間でのデータ共有が可能になります。"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-6 border-t border-gray-100">
        <p className="text-sm text-gray-500 mb-4">
          まずは無料プランで大会探しを始めましょう
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            無料で始める
          </Link>
          <Link
            href="/benefits"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            会員メリットを見る →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-1">Q. {q}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
    </div>
  );
}
