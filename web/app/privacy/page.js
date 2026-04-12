import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "Risk Monitor（リスク監視・公開データ横断検索サービス）のプライバシーポリシーです。取得する情報・利用目的・安全管理について定めています。",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        プライバシーポリシー
      </h1>
      <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年3月28日</p>

      <div className="prose-custom space-y-8">
        {/* ── 前文 ── */}
        <section>
          <p className="text-sm text-gray-600 leading-relaxed">
            Risk Monitor運営者（以下「運営者」）は、Webサービス「Risk Monitor」（以下「本サービス」）を
            ご利用いただくユーザーの個人情報およびプライバシーの保護を重要な責務と考えています。
            本プライバシーポリシー（以下「本ポリシー」）は、本サービスにおける情報の取得・利用・管理・提供について定めるものです。
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            本サービスは、外部の大会情報掲載サイトで公開されている情報を収集・整理し、
            スポーツ大会の検索・比較・通知を支援するサービスです。
            本ポリシーは、この特性を踏まえて策定しています。
          </p>
        </section>

        {/* ── 1. 取得する情報 ── */}
        <section>
          <h2>1. 取得する情報</h2>
          <p>
            本サービスでは、サービスの提供・改善のために、以下の情報を取得・保存することがあります。
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
                  <td className="py-2 pr-4">メールアドレス・ユーザー名・パスワード</td>
                  <td className="py-2">アカウント認証、ログイン管理、通知の送信</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">お気に入り登録した大会</td>
                  <td className="py-2">お気に入り機能の提供、関連する通知の送信</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">保存した検索条件（種目・地域・距離等）</td>
                  <td className="py-2">保存検索機能の提供、条件一致の通知</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">マイカレンダーへの登録・メモ</td>
                  <td className="py-2">マイカレンダー機能の提供、締切通知</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">通知設定（種類・タイミング・有効/無効）</td>
                  <td className="py-2">通知機能の提供・制御</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">お問い合わせ内容（氏名・メールアドレス・本文）</td>
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
                  <td className="py-2 pr-4">大会ページの閲覧履歴</td>
                  <td className="py-2">人気指数の算出、おすすめ機能の改善</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">検索キーワード・検索条件の利用履歴</td>
                  <td className="py-2">検索機能の改善、トレンド分析</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">外部サイトへの遷移（クリック）履歴</td>
                  <td className="py-2">サービス改善、送客実績の把握</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">アクセスログ（IPアドレス、アクセス日時、リファラー）</td>
                  <td className="py-2">不正アクセスの検知・防止、障害対応</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">セッション情報（Cookie）</td>
                  <td className="py-2">ログイン状態の維持</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （3）端末・技術情報
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
                  <td className="py-2 pr-4">ブラウザの種類・バージョン</td>
                  <td className="py-2">表示の最適化、不具合調査</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">OS・端末の種類</td>
                  <td className="py-2">表示の最適化、利用環境の統計分析</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">画面解像度</td>
                  <td className="py-2">レスポンシブ対応の改善</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 2. 利用目的 ── */}
        <section>
          <h2>2. 利用目的</h2>
          <p>
            運営者は、取得した情報を以下の目的の範囲内で利用します。
            利用目的を変更する場合は、本ポリシーを更新のうえ、適切な方法でお知らせします。
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>サービスの提供</strong>
              <br />
              <span className="text-gray-600">
                大会検索・比較・お気に入り・マイカレンダー・保存検索などの各機能の提供、
                およびアカウントの認証・管理
              </span>
            </li>
            <li>
              <strong>通知の送信</strong>
              <br />
              <span className="text-gray-600">
                エントリー締切通知、保存検索条件に一致する大会の通知、
                お気に入り大会の更新通知、その他ユーザーが設定した通知の送信
              </span>
            </li>
            <li>
              <strong>サービスの改善・分析</strong>
              <br />
              <span className="text-gray-600">
                大会ページの閲覧傾向・検索キーワードの分析による機能改善、
                人気指数・ランキングの算出、利用統計の作成
              </span>
            </li>
            <li>
              <strong>不正利用の検知・防止</strong>
              <br />
              <span className="text-gray-600">
                不正アクセス、Bot・スクレイピング、その他利用規約に違反する行為の検知・対処
              </span>
            </li>
            <li>
              <strong>お問い合わせへの対応</strong>
              <br />
              <span className="text-gray-600">
                ユーザーからのお問い合わせへの回答、本人確認、対応記録の管理
              </span>
            </li>
            <li>
              <strong>重要なお知らせの送信</strong>
              <br />
              <span className="text-gray-600">
                サービスの変更・メンテナンス・障害情報、利用規約やプライバシーポリシーの
                重要な変更など、サービス運営上必要な連絡
              </span>
            </li>
            <li>
              <strong>広告・マーケティング（将来）</strong>
              <br />
              <span className="text-gray-600">
                広告配信の最適化、アフィリエイトリンク経由の送客実績の把握。
                導入時には本ポリシーを更新します
              </span>
            </li>
          </ol>
        </section>

        {/* ── 3. 第三者提供 ── */}
        <section>
          <h2>3. 情報の第三者提供</h2>

          <h3 className="text-sm font-semibold text-gray-700 mt-3 mb-2">
            （1）原則
          </h3>
          <p>
            運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー本人の同意がある場合</li>
            <li>法令に基づく開示要請がある場合</li>
            <li>
              人の生命・身体・財産の保護に必要な場合で、
              本人の同意を得ることが困難な場合
            </li>
            <li>
              公衆衛生の向上または児童の健全な育成推進に特に必要な場合で、
              本人の同意を得ることが困難な場合
            </li>
            <li>
              国の機関もしくは地方公共団体またはその委託を受けた者が
              法令の定める事務を遂行することに協力する必要がある場合
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （2）業務委託先への提供
          </h3>
          <p>
            運営者は、サービス提供に必要な範囲で、以下の業務を外部に委託する場合があります。
            委託先には必要最小限の情報のみ提供し、適切な管理を求めます。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>メール送信サービス</strong>:
              通知メール・お知らせの送信（送信先メールアドレス、メール本文）
            </li>
            <li>
              <strong>ホスティング・インフラサービス</strong>:
              サーバーの運用・保守（サーバー上に保存されたデータ全般）
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （3）統計データの利用
          </h3>
          <p>
            個人を特定できない形に加工した統計データ（利用動向、アクセス傾向、大会の人気度等）については、
            サービス改善や分析レポートの目的で第三者に提供する場合があります。
          </p>
        </section>

        {/* ── 4. 外部サービスの利用 ── */}
        <section>
          <h2>4. 外部サービスの利用</h2>
          <p>
            本サービスでは、以下の外部サービスを利用しているか、
            または将来的に利用する可能性があります。
            各サービスにおける情報の取扱いについては、
            各サービスのプライバシーポリシーをご確認ください。
          </p>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700">カテゴリ</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700">サービス例</th>
                  <th className="text-left py-2 font-semibold text-gray-700">送信される情報</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">アクセス解析</td>
                  <td className="py-2 pr-4">Google Analytics 等</td>
                  <td className="py-2">閲覧ページ、アクセス日時、端末情報、IPアドレス（匿名化）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">メール送信</td>
                  <td className="py-2 pr-4">SMTP / 外部メールAPI</td>
                  <td className="py-2">送信先メールアドレス、メール本文</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">ホスティング / CDN</td>
                  <td className="py-2 pr-4">Vercel, Cloudflare 等</td>
                  <td className="py-2">リクエスト情報（IPアドレス、URLパス等）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">広告配信（将来）</td>
                  <td className="py-2 pr-4">Google AdSense 等</td>
                  <td className="py-2">Cookie、閲覧履歴、端末情報</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4">運営通知</td>
                  <td className="py-2 pr-4">Slack</td>
                  <td className="py-2">お問い合わせ内容（運営内部での共有、個人情報は最小限）</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ 上記はサービス例であり、実際に利用するサービスは変更される場合があります。
            新たな外部サービスを導入する場合は、本ポリシーを更新します。
          </p>
        </section>

        {/* ── 5. Cookie・トラッキング ── */}
        <section>
          <h2>5. Cookieおよびトラッキング技術</h2>

          <h3 className="text-sm font-semibold text-gray-700 mt-3 mb-2">
            （1）Cookieの使用目的
          </h3>
          <p>本サービスでは、以下の目的でCookieを使用しています。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>セッションCookie</strong>:
              ログイン状態の維持に使用します。ブラウザを閉じると自動的に削除されます。
            </li>
            <li>
              <strong>機能性Cookie（将来）</strong>:
              ユーザーの表示設定（テーマ・並び順等）の保持に使用する場合があります。
            </li>
            <li>
              <strong>分析用Cookie（将来）</strong>:
              アクセス解析ツールの導入時に、利用状況の統計分析に使用する場合があります。
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （2）Cookieの拒否・削除
          </h3>
          <p>
            ブラウザの設定により、Cookieの受入れを拒否したり、保存済みのCookieを削除することができます。
            ただし、Cookieを無効にした場合、ログイン機能をはじめとする一部の機能が正常に動作しなくなります。
          </p>
          <p className="text-sm text-gray-500 mt-1">
            設定方法はご利用のブラウザのヘルプページをご参照ください
            （例: Chrome → 設定 → プライバシーとセキュリティ → Cookie）。
          </p>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （3）Do Not Track
          </h3>
          <p>
            一部のブラウザには「Do Not Track（DNT）」シグナルを送信する機能がありますが、
            現時点では本サービスはDNTシグナルに対応していません。
          </p>
        </section>

        {/* ── 6. データの保存と安全管理 ── */}
        <section>
          <h2>6. データの保存と安全管理</h2>

          <h3 className="text-sm font-semibold text-gray-700 mt-3 mb-2">
            （1）保存期間
          </h3>
          <p>取得した情報は、以下の期間保存します。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>アカウント情報・ユーザーデータ</strong>（お気に入り、保存検索、カレンダー、メモ等）:
              アカウント削除の依頼があるまで
            </li>
            <li>
              <strong>アクセスログ</strong>:
              取得後90日間（不正利用の調査・障害対応のため）
            </li>
            <li>
              <strong>行動データ</strong>（閲覧履歴、検索履歴等）:
              取得後12ヶ月間（統計分析・サービス改善のため。個人を特定できない形に加工したデータは期間の制限なく保持する場合があります）
            </li>
            <li>
              <strong>お問い合わせ情報</strong>:
              対応完了後1年間
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （2）安全管理措置
          </h3>
          <p>
            運営者は、取得した情報の漏洩・紛失・改ざん等を防止するため、
            以下の安全管理措置を講じています。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>パスワードのハッシュ化保存（平文では保存しません）</li>
            <li>通信経路の暗号化（HTTPS/TLS）</li>
            <li>データベースへのアクセス制御（管理者のみ）</li>
            <li>サーバー・ソフトウェアのセキュリティアップデートの適用</li>
            <li>定期的なセキュリティ対策の見直し</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            （3）免責
          </h3>
          <p>
            運営者は情報の安全管理に最善を尽くしますが、
            インターネット上のデータ送信・保存において完全な安全性を技術的に保証することはできません。
            万が一、情報の漏洩等が発生した場合は、速やかに影響範囲の調査・対応を行い、
            必要に応じてユーザーへ通知します。
          </p>
        </section>

        {/* ── 7. ユーザーの権利 ── */}
        <section>
          <h2>7. ユーザーの権利</h2>
          <p>
            ユーザーは、自己の個人情報について、以下の権利を有します。
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>開示</strong>:
              運営者が保有するご自身の個人情報の内容について、開示を求めることができます。
              お問い合わせフォームまたはメールにてご連絡ください。
            </li>
            <li>
              <strong>訂正</strong>:
              登録情報に誤りがある場合、マイページから随時修正できます。
              マイページで修正できない項目については、お問い合わせにて対応します。
            </li>
            <li>
              <strong>削除</strong>:
              アカウントの削除を希望される場合は、お問い合わせ先までご連絡ください。
              アカウントに関連するすべてのユーザーデータ（お気に入り、保存検索、カレンダー、メモ等）を削除します。
              <strong>削除後のデータ復旧はできません。</strong>
            </li>
            <li>
              <strong>利用停止</strong>:
              通知メールの受信を停止する場合は、設定画面から随時変更できます。
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            ※ 開示・削除のご依頼にあたっては、ご本人確認をさせていただく場合があります。
            なお、法令に基づき保存が求められる情報については、削除に応じられない場合があります。
          </p>
        </section>

        {/* ── 8. 未成年者の利用 ── */}
        <section>
          <h2>8. 未成年者の利用</h2>
          <p>
            本サービスは年齢制限を設けていませんが、
            16歳未満の方がアカウント登録その他の個人情報の入力を行う場合は、
            保護者の同意を得たうえでご利用ください。
          </p>
          <p>
            保護者の方からお子様の個人情報の削除依頼があった場合は、
            速やかに対応いたします。
          </p>
        </section>

        {/* ── 9. ポリシーの変更 ── */}
        <section>
          <h2>9. ポリシーの変更</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              運営者は、法令の改正、サービス内容の変更、
              または情報の取扱いに関する運用の変更に伴い、
              本ポリシーを改定する場合があります。
            </li>
            <li>
              重要な変更を行う場合（取得する情報の種類の追加、利用目的の変更、
              第三者提供先の追加等）は、本サービス上での告知、またはメールによる通知など、
              適切な方法で事前にお知らせするよう努めます。
            </li>
            <li>
              変更後のポリシーは、本サービス上に掲載した時点から効力を生じます。
              変更後に本サービスを継続してご利用いただいた場合、
              変更後のポリシーに同意いただいたものとみなします。
            </li>
          </ol>
        </section>

        {/* ── 10. お問い合わせ ── */}
        <section>
          <h2>10. お問い合わせ</h2>
          <p>
            本ポリシーに関するご質問、個人情報の開示・訂正・削除のご依頼、
            その他プライバシーに関するご相談は、以下までご連絡ください。
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
          <p className="text-xs text-gray-500 mt-2">
            ※ お問い合わせへの回答には数日いただく場合があります。
          </p>
        </section>

        {/* ── 附則 ── */}
        <section>
          <h2>附則</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>2026年3月15日 制定</li>
            <li>2026年3月28日 全面改定</li>
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
