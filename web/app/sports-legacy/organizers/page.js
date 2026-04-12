import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

/**
 * Phase128: 大会運営向けランディングページ
 *
 * /organizers — 大会運営者にRisk Monitorの掲載メリットと価値を伝える
 * B2B的な落ち着いたトーン。Server Component（静的コンテンツ）。
 */

const BENEFITS = [
  {
    title: "全国のランナーに届く",
    description:
      "Risk Monitorには全国のランナーが大会を探しに訪れます。掲載情報が充実するほど、検索結果や関連大会として表示される機会が増えます。",
  },
  {
    title: "大会の反響が見える",
    description:
      "閲覧数、お気に入り登録数、比較された回数など、ランナーの関心をデータで確認できます。大会の認知度や注目度の把握にお役立てください。",
  },
  {
    title: "情報の正確性が信頼を生む",
    description:
      "正確な開催情報は、ランナーの安心感と信頼につながります。Risk Monitorでは情報の鮮度と正確性を重視し、運営者の方からの更新を歓迎しています。",
  },
  {
    title: "募集状況がリアルタイムに反映",
    description:
      "受付中・締切間近・定員到達などの状態が正しく表示されることで、ランナーが適切なタイミングで申込みできるようになります。",
  },
  {
    title: "大会の特徴が正しく伝わる",
    description:
      "初心者向け、景色が良い、記録を狙えるなど、大会の魅力を正確に伝えることで、大会に合ったランナーからのエントリーが見込めます。",
  },
  {
    title: "写真で大会の魅力が伝わる",
    description:
      "コースの景色、会場の雰囲気、スタート・フィニッシュの盛り上がりなど、写真があることで大会の魅力がより伝わりやすくなります。写真が充実した大会はランナーの関心を集めやすくなります。",
  },
];

const FEATURES_FOR_RUNNERS = [
  {
    title: "詳細な大会ページ",
    description: "種目・距離・参加費・タイムスケジュール・会場アクセスなどを一覧表示",
  },
  {
    title: "募集状況の可視化",
    description: "受付中/締切間近/満員など、エントリー状況をリアルタイムに表示",
  },
  {
    title: "比較・保存・通知",
    description: "気になる大会の比較、お気に入り保存、締切リマインダー通知に対応",
  },
  {
    title: "条件検索",
    description: "地域・距離・時期・テーマ別に大会を探せる多軸検索機能",
  },
];

const FUTURE_FEATURES = [
  "大会情報の直接編集（運営者ダッシュボード）",
  "募集状況のリアルタイム更新",
  "大会写真の直接アップロード・管理",
  "大会結果の掲載・管理",
  "大会ページのアクセス解析レポート",
  "注目度アップの有料プロモーション",
];

export default function OrganizersPage() {
  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "運営者の方へ" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヒーロー */}
      <div className="mb-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          大会運営者・主催者の方へ
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
          Risk Monitorは、全国のマラソン・トレイルランニング大会の情報を集約し、
          ランナーが最適な大会を見つけるための検索ポータルです。
          ランナーに正確な情報を届けるために、大会運営者の方のご協力をお待ちしています。
        </p>
      </div>

      {/* 掲載メリット */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">
          掲載のメリット
        </h2>
        <div className="space-y-4">
          {BENEFITS.map((benefit, i) => (
            <div key={i} className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
                {i + 1}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">{benefit.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 情報の正確性 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">
          情報の正確性について
        </h2>
        <div className="bg-gray-50 rounded-xl p-6 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Risk Monitorでは、複数の情報ソースを定期的に照合し、掲載データの正確性を維持しています。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "自動データ収集", detail: "RUNNET・moshicom等から定期取得" },
              { label: "多ソース照合", detail: "複数のデータソースを自動比較" },
              { label: "鮮度管理", detail: "情報の更新日・確認日を追跡" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-bold text-gray-700 mb-0.5">{item.label}</p>
                <p className="text-xs text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            しかし、自動収集だけではカバーしきれない情報もございます。
            運営者の方から直接いただく最新情報は、ランナーの信頼と安心に直結する大きな価値です。
          </p>
        </div>
      </section>

      {/* ランナーからの見え方 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">
          ランナーへの表示内容
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Risk Monitorでは、以下のような形でランナーに大会情報を届けています。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES_FOR_RUNNERS.map((feature) => (
            <div key={feature.title} className="p-4 bg-white border border-gray-100 rounded-xl">
              <h3 className="text-sm font-bold text-gray-700 mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 今後の機能 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">
          今後の機能予定
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          大会運営者の方にとって、より便利で価値のあるサービスを目指して開発を進めています。
        </p>
        <ul className="space-y-2">
          {FUTURE_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-gray-300 mt-0.5">-</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-400 mt-3">
          ※ 上記は予定であり、提供時期は未定です。
        </p>
      </section>

      {/* CTA */}
      <section className="bg-blue-50 rounded-xl p-8 text-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          大会情報の更新・修正をご希望の方へ
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto">
          掲載情報に誤りがある場合や、最新の情報に更新したい場合は、
          以下のフォームからリクエストをお送りください。
        </p>
        <Link
          href="/organizers/request-update"
          className="inline-block px-8 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          情報更新リクエストを送る
        </Link>
        <p className="text-xs text-gray-400 mt-4">
          通常2〜3営業日以内に確認いたします。
        </p>
      </section>

      {/* フッターリンク */}
      <div className="mt-12 pt-6 border-t border-gray-200 flex items-center gap-4">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
        <Link href="/about-data" className="text-sm text-gray-400 hover:text-gray-600">
          データについて
        </Link>
        <Link href="/contact" className="text-sm text-gray-400 hover:text-gray-600">
          お問い合わせ
        </Link>
      </div>
    </div>
  );
}
