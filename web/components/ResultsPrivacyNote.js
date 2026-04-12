"use client";

import { useState } from "react";

/**
 * Phase156: 匿名性ポリシーUI
 *
 * 結果ページやMy Resultsに表示する、プライバシー方針の説明コンポーネント。
 * 折りたたみ式で詳細説明を表示。
 */

export default function ResultsPrivacyNote({ variant = "public" }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-gray-400 text-sm">🔒</span>
        <span className="text-xs font-medium text-gray-600">プライバシーについて</span>
        <span className="text-xs text-gray-400 ml-auto">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-xs text-gray-500 leading-relaxed">
          {variant === "public" ? (
            <>
              <p>
                Risk Monitorでは、大会結果のプライバシー保護を最優先としています。
              </p>
              <ul className="space-y-1.5 pl-4">
                <li className="list-disc">
                  公開結果ページでは<strong className="text-gray-700">個人名は一切表示されません</strong>。
                  ゼッケン番号のみが識別子として使用されます。
                </li>
                <li className="list-disc">
                  氏名による検索機能は提供していません。
                </li>
                <li className="list-disc">
                  個人の結果が検索エンジンに個人名で表示されることはありません。
                </li>
                <li className="list-disc">
                  ログインユーザーはゼッケン番号で自分の結果を紐付け、
                  個人の記録として管理できます。この紐付け情報は本人にのみ表示されます。
                </li>
              </ul>
              <p className="text-gray-400 pt-1">
                結果データの取り扱いに関するご質問は、お問い合わせフォームよりご連絡ください。
              </p>
            </>
          ) : (
            <>
              <p>
                My Resultsはあなただけの記録管理ページです。
              </p>
              <ul className="space-y-1.5 pl-4">
                <li className="list-disc">
                  紐付けた結果は<strong className="text-gray-700">あなたのアカウントにのみ</strong>表示されます。
                </li>
                <li className="list-disc">
                  他のユーザーがあなたの結果一覧や自己ベストを閲覧することはできません。
                </li>
                <li className="list-disc">
                  公開結果ページでは、あなたの記録はゼッケン番号でのみ表示され、
                  アカウントとの関連は公開されません。
                </li>
                <li className="list-disc">
                  紐付けはいつでも解除できます。
                </li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
