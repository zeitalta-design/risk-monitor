import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "Risk Monitor（企業リスク監視プラットフォーム）のプライバシーポリシーです。取得する情報・利用目的・安全管理について定めています。",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        プライバシーポリシー
      </h1>
      <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年4月13日</p>

      <div className="prose-custom space-y-8">
        {/* ── 前文 ── */}
        <section>
          <p className="text-sm text-gray-600 leading-relaxed">
            Risk Monitor運営者（以下「運営者」）は、Webサービス「Risk Monitor」（以下「本サービス」）を
            ご利用いただくユーザーの個人情報およびプライバシーの保護を重要な責務と考えています。
            本プライバシーポリシー（以下「本ポリシー」）は、本サービスにおける個人情報等の取得・利用・管理・提供について定めるものです。
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            本サービスは、官公庁・地方自治体が公開している行政処分情報、産廃処分情報、入札情報、補助金情報等の公開データを収集・整理し、
            企業リスクを監視・可視化するための情報提供プラットフォームです。本ポリシーは、この特性を踏まえて策定しています。
          </p>
        </section>

        {/* ── 1. 取得する情報 ── */}
        <section>
          <h2>1. 取得する情報</h2>
          <p>
            本サービスでは、サービスの提供・改善のために以下の情報を取得・保存することがあります。
          </p>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （1）ユーザーが入力・登録する情報
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700">情報</th>
                  <th className="text-left py-2 font-semibold text-gray-700">主な利用目的</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">メールアドレス・パスワード</td>
                  <td className="py-2">アカウント認証、ログイン管理、通知送信</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">お気に入り企業</td>
                  <td className="py-2">お気に入り機能の提供、監視通知</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">保存した検索条件</td>
                  <td className="py-2">保存検索機能の提供、条件一致通知</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">マイメモ・ノート</td>
                  <td className="py-2">メモ機能の提供</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">通知設定</td>
                  <td className="py-2">通知機能の提供・制御</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">お問い合わせ内容</td>
                  <td className="py-2">お問い合わせへの対応・品質改善</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （2）自動的に取得する情報（行動データ）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700">情報</th>
                  <th className="text-left py-2 font-semibold text-gray-700">主な利用目的</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">ページ閲覧履歴</td>
                  <td className="py-2">サービス改善、おすすめ機能の強化</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">検索キーワード・検索条件</td>
                  <td className="py-2">検索機能の改善、トレンド分析</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">外部サイトへの遷移履歴</td>
                  <td className="py-2">サービス改善、利用動向の把握</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">アクセスログ（IPアドレス、日時等）</td>
                  <td className="py-2">不正アクセスの検知・防止、障害対応</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">Cookie・セッション情報</td>
                  <td className="py-2">ログイン状態の維持</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （3）端末・技術情報
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>ブラウザの種類・バージョン</li>
            <li>OS・端末の種類</li>
            <li>画面解像度</li>
          </ul>
          <p className="text-sm text-gray-500 mt-1">
            これらの情報は、表示の最適化や利用環境の統計分析のために使用します。
          </p>
        </section>

        {/* ── 2. 利用目的 ── */}
        <section>
          <h2>2. 利用目的</h2>
          <p>
            運営者は、取得した情報を以下の目的の範囲内で利用します。
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>サービスの提供・維持（アカウント管理、お気に入り機能、検索機能など）</li>
            <li>通知機能の提供（新着行政処分通知、監視企業アラート等）</li>
            <li>サービスの改善・分析（利用傾向分析、リスク評価ロジックの改善）</li>
            <li>不正利用の検知・防止</li>
            <li>お問い合わせへの対応</li>
            <li>重要なお知らせの送信（サービス変更、障害情報、規約変更等）</li>
          </ol>
        </section>

        {/* ── 3. 第三者提供 ── */}
        <section>
          <h2>3. 情報の第三者提供</h2>
          <p>
            運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー本人の同意がある場合</li>
            <li>法令に基づく開示要請がある場合</li>
            <li>人の生命・身体・財産の保護に必要な場合で、本人の同意を得ることが困難な場合</li>
            <li>国の機関または地方公共団体が法令の定める事務を遂行する場合</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            業務委託先への提供
          </h3>
          <p>
            サービス提供に必要な範囲で、以下の業務を外部に委託する場合があります。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>メール送信サービス（通知メールの送信）</li>
            <li>ホスティング・インフラサービス（Vercel等）</li>
          </ul>
          <p className="text-sm text-gray-500 mt-1">
            委託先に対しては、必要最小限の情報のみを提供し、適切な管理を求めます。
          </p>
        </section>

        {/* ── 4. 外部サービスの利用 ── */}
        <section>
          <h2>4. 外部サービスの利用</h2>
          <p>
            本サービスでは、以下の外部サービスを利用しています（または将来的に利用する可能性があります）。
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>ホスティング・CDN</strong>: Vercel</li>
            <li><strong>アクセス解析</strong>: Google Analytics 等（匿名化されたデータのみ）</li>
            <li><strong>メール送信</strong>: 外部メール配信サービス</li>
          </ul>
          <p className="text-sm text-gray-500 mt-2">
            各外部サービスのプライバシーポリシーについては、該当サービスにてご確認ください。
          </p>
        </section>

        {/* ── 5. Cookie・トラッキング ── */}
        <section>
          <h2>5. Cookieおよびトラッキング技術</h2>
          <p>
            本サービスでは、ログイン状態の維持を目的としたセッションCookieを使用しています。
          </p>
          <p className="mt-2">
            ブラウザの設定によりCookieを拒否することは可能ですが、その場合、一部の機能（ログイン等）が正常に動作しない場合があります。
          </p>
        </section>

        {/* ── 6. データの保存と安全管理 ── */}
        <section>
          <h2>6. データの保存と安全管理</h2>

          <h3 className="text-sm font-semibold text-gray-700 mt-3 mb-2">
            保存期間
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>アカウント情報・ユーザーデータ</strong>: アカウント削除まで</li>
            <li><strong>アクセスログ</strong>: 取得後90日間</li>
            <li><strong>行動データ（加工後）</strong>: 統計分析目的で一定期間保持</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            安全管理措置
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>パスワードのハッシュ化</li>
            <li>通信の暗号化（HTTPS）</li>
            <li>データベースへのアクセス制御</li>
            <li>定期的なセキュリティ対策の見直し</li>
          </ul>
        </section>

        {/* ── 7. ユーザーの権利 ── */}
        <section>
          <h2>7. ユーザーの権利</h2>
          <p>ユーザーは、以下の権利を有します。</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>開示・訂正・削除</strong>:
              ご自身の個人情報について開示、訂正、削除を請求できます。
            </li>
            <li>
              <strong>利用停止</strong>:
              通知メール等の受信を停止できます。
            </li>
            <li>
              <strong>アカウント削除</strong>:
              いつでもアカウントの削除を依頼できます（関連データも削除されます）。
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            ご依頼の際は、お問い合わせフォームよりご連絡ください。本人確認を行った上で対応いたします。
          </p>
        </section>

        {/* ── 8. 未成年者の利用 ── */}
        <section>
          <h2>8. 未成年者の利用</h2>
          <p>
            本サービスは幅広いユーザーを対象としていますが、16歳未満の方が個人情報を入力する場合は、
            保護者の同意を得た上でご利用ください。
          </p>
        </section>

        {/* ── 9. ポリシーの変更 ── */}
        <section>
          <h2>9. ポリシーの変更</h2>
          <p>
            運営者は、法令の改正やサービス内容の変更に伴い、本ポリシーを改定する場合があります。
          </p>
          <p className="mt-2">
            重要な変更がある場合は、本サービス上での告知等によりお知らせします。
          </p>
        </section>

        {/* ── 10. お問い合わせ ── */}
        <section>
          <h2>10. お問い合わせ</h2>
          <p>
            本ポリシーに関するご質問、個人情報の開示・訂正・削除のご依頼は、以下の方法でお問い合わせください。
          </p>
          <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm">
            <p className="font-semibold text-gray-700">Risk Monitor 運営者</p>
            <p className="text-gray-600 mt-1">
              <Link
                href="/contact"
                className="text-blue-600 hover:text-blue-800"
              >
                お問い合わせフォーム
              </Link>
              よりご連絡ください。
            </p>
          </div>
        </section>

        {/* ── 附則 ── */}
        <section>
          <h2>附則</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>2026年4月13日 制定・施行</li>
          </ul>
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
          href="/about-data"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          データについて →
        </Link>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
