import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { COPY } from "@/lib/membership-copy";

export const metadata = {
  title: "会員メリット | Risk Monitor",
  description:
    "Risk Monitorに無料会員登録すると、大会の保存・比較・通知・おすすめ・締切追跡・マイ大会管理が使えます。",
};

const BENEFITS = [
  {
    icon: "📌",
    title: "気になる大会を逃さない",
    description:
      "あとで見るに保存すれば、いつでも見返せます。締切が近づいたら自動でお知らせ。気になる大会を見逃しません。",
    link: "/saved",
    linkLabel: "あとで見る →",
    color: "blue",
  },
  {
    icon: "⚖️",
    title: "迷ったら並べて比較",
    description:
      "参加費・制限時間・アクセス・距離をひと目で比較。候補を並べて見れば、自分に合う大会がすぐ見つかります。",
    link: "/compare",
    linkLabel: "比較表を見る →",
    color: "indigo",
  },
  {
    icon: "🔔",
    title: "締切もうっかり防止",
    description:
      "保存した大会の募集開始・締切間近・定員間近・受付終了をリアルタイムでお知らせ。大事なタイミングを逃しません。",
    link: "/alerts",
    linkLabel: "通知を確認 →",
    color: "amber",
  },
  {
    icon: "🎯",
    title: "あなたにぴったりの大会",
    description:
      "走りたい距離・エリア・レベルを設定すれば、あなたに合った大会を自動で提案。新しい大会との出会いが広がります。",
    link: "/next-race",
    linkLabel: "おすすめを見る →",
    color: "green",
  },
  {
    icon: "📊",
    title: "募集状況をリアルタイム追跡",
    description:
      "公式サイトの受付状況を自動チェック。受付開始・定員残りわずか・締切変更などの情報をいち早くキャッチできます。",
    link: "/marathon",
    linkLabel: "大会を探す →",
    color: "purple",
  },
  {
    icon: "📋",
    title: "エントリーまで一元管理",
    description:
      "検討中・出場予定・エントリー済み — 大会ごとのステータスを管理。持ち物メモや当日スケジュールも記録できます。",
    link: "/my-events",
    linkLabel: "マイ大会 →",
    color: "rose",
  },
];

const COLOR_MAP = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  green: "bg-green-50 text-green-600 border-green-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};

const ICON_BG_MAP = {
  blue: "bg-blue-100",
  indigo: "bg-indigo-100",
  amber: "bg-amber-100",
  green: "bg-green-100",
  purple: "bg-purple-100",
  rose: "bg-rose-100",
};

export default function BenefitsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "会員メリット" },
        ]}
      />

      {/* ヒーロー */}
      <div className="text-center mt-6 mb-10">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          Risk Monitorでできること
        </h1>
        <p className="text-gray-600 text-sm lg:text-base max-w-2xl mx-auto leading-relaxed">
          無料会員登録で、大会探しから当日準備まですべてを一元管理。
          <br className="hidden sm:block" />
          あなたのマラソンライフをもっと便利に。
        </p>
      </div>

      {/* メリットグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${COLOR_MAP[b.color]}`}
          >
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-4 ${ICON_BG_MAP[b.color]}`}
            >
              {b.icon}
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              {b.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              {b.description}
            </p>
            <Link
              href={b.link}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              {b.linkLabel}
            </Link>
          </div>
        ))}
      </div>

      {/* 利用の流れ */}
      <div className="bg-gray-50 rounded-2xl p-6 lg:p-8 mb-10">
        <h2 className="text-lg font-bold text-gray-900 text-center mb-6">
          かんたん3ステップ
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "無料で会員登録",
              desc: "メールアドレスだけでOK。30秒で完了します。",
            },
            {
              step: "2",
              title: "プロフィール設定",
              desc: "走りたい距離・エリア・レベルを選ぶだけ。",
            },
            {
              step: "3",
              title: "大会を探す・管理する",
              desc: "おすすめ・保存・比較・通知で、ぴったりの大会に出会えます。",
            },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">
                {s.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pb-8">
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-bold text-base rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          無料で始める
        </Link>
        <p className="text-xs text-gray-400 mt-3">
          すでにアカウントをお持ちの方は
          <Link href="/login" className="text-blue-500 hover:underline ml-1">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
