import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "お問い合わせ | Risk Monitor",
  description: "Risk Monitorへのお問い合わせ。掲載内容の修正・削除依頼、サービスに関するご質問はこちらからご連絡ください。",
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* ページタイトル */}
      <h1 className="text-2xl font-extrabold text-gray-900 mb-3">お問い合わせ</h1>

      {/* 本文 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 mb-8 space-y-5">
        <p className="text-sm text-gray-700 leading-relaxed">
          Risk Monitorをご利用いただきありがとうございます。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          掲載内容の修正依頼、削除依頼、サービスに関するお問い合わせは、以下のフォームよりご連絡ください。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Risk Monitorでは、公開されている大会情報をもとに情報を掲載しています。
          掲載内容に誤りがある場合や、掲載停止・削除をご希望の場合は、内容を確認のうえ迅速に対応いたします。
        </p>

        {/* ご連絡いただきたい内容 */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-2">ご連絡いただきたい内容</h2>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>大会名</li>
            <li>該当ページURL</li>
            <li>お問い合わせ内容（例：掲載修正、削除依頼、情報更新、その他）</li>
            <li>ご担当者名</li>
            <li>ご連絡先メールアドレス</li>
          </ul>
        </div>

        {/* ご注意 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-2">ご注意</h2>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>大会の最新情報は、必ず公式サイトをご確認ください。</li>
            <li>掲載画像等の著作権は各権利者に帰属します。</li>
            <li>内容確認のため、返信まで少しお時間をいただく場合があります。</li>
          </ul>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          安心してご利用いただけるサービス運営のため、順次対応してまいります。
        </p>
      </div>

      {/* お問い合わせフォーム */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">お問い合わせフォーム</h2>
      <ContactForm />

      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
