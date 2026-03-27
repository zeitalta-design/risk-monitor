import Link from "next/link";

export const metadata = {
  title: "掲載情報について",
  description:
    "大会ナビの掲載情報の取り扱い・更新方針・修正削除のご連絡について。",
};

export default function AboutDataPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        大会ナビの掲載情報について
      </h1>
      <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年3月28日</p>

      <div className="prose-custom space-y-8">
        <section>
          <p>
            大会ナビは、スポーツ大会の情報を探しやすく、比較しやすくするための案内サービスです。
          </p>
          <p>
            大会ごとの開催日、エリア、種目、締切日などの情報を整理し、
            利用者が自分に合った大会を見つけやすい形で掲載しています。
          </p>
        </section>

        <section>
          <h2>サービスの位置づけ</h2>
          <p>
            大会ナビは、大会情報の検索・比較を支援するサービスであり、
            大会の主催者または申込受付事業者ではありません。
          </p>
          <p>
            各大会への参加申込や最終的な参加判断にあたっては、
            必ず大会主催者または公式案内ページにて最新情報をご確認ください。
          </p>
        </section>

        <section>
          <h2>掲載情報の取り扱い</h2>
          <p>
            掲載情報については、正確かつ分かりやすい内容となるよう継続的に確認・更新を行っています。
            一方で、大会情報は主催者側の都合により変更されることがあり、
            反映までに時間差が生じる場合があります。
          </p>
          <p>
            そのため、以下の内容については、最新の公式案内をご確認いただくことをおすすめします。
          </p>
          <ul>
            <li>開催日・会場</li>
            <li>申込期間・締切</li>
            <li>参加費・定員</li>
            <li>種目・参加条件</li>
            <li>中止・延期・開催内容の変更</li>
          </ul>
        </section>

        <section>
          <h2>修正・削除のご連絡</h2>
          <p>
            掲載内容に誤りがある場合、または修正・削除をご希望の場合は、
            <Link
              href="/contact"
              className="text-blue-600 hover:text-blue-800"
            >
              お問い合わせフォーム
            </Link>
            よりご連絡ください。
            確認のうえ、適切に対応いたします。
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
        <Link
          href="/terms"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          利用規約 →
        </Link>
        <Link
          href="/privacy"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          プライバシーポリシー →
        </Link>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
