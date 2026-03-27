"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

export default function GyoseiShobunDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/gyosei-shobun/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setItem)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">この行政処分情報は見つかりませんでした</p>
          <Link href="/gyosei-shobun" className="text-sm text-blue-600 hover:underline">一覧に戻る</Link>
        </div>
      </div>
    );
  }

  const actionType = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type);
  const industryInfo = gyoseiShobunConfig.industries.find((i) => i.slug === item.industry);
  const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-6 flex items-center gap-1.5">
          <Link href="/gyosei-shobun" className="hover:text-blue-600">行政処分DB</Link>
          <span>/</span>
          <span className="text-gray-900 truncate">{item.organization_name_raw}</span>
        </nav>

        {/* ヘッダー */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">{actionType?.icon || "📄"}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{item.organization_name_raw}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm px-3 py-1 rounded border font-medium ${tc.bg} ${tc.text} ${tc.border}`}>
                  {actionType?.label || item.action_type}
                </span>
                {industryInfo && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                    {industryInfo.icon} {industryInfo.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {item.summary && (
            <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
          )}
        </div>

        {/* 処分詳細 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">処分情報</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.action_date && (
              <div>
                <dt className="text-xs text-gray-500 mb-1">処分日</dt>
                <dd className="text-sm font-medium text-gray-900">{item.action_date}</dd>
              </div>
            )}
            {item.authority_name && (
              <div>
                <dt className="text-xs text-gray-500 mb-1">処分庁</dt>
                <dd className="text-sm font-medium text-gray-900">{item.authority_name}</dd>
              </div>
            )}
            {item.prefecture && (
              <div>
                <dt className="text-xs text-gray-500 mb-1">所在地</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {item.prefecture}{item.city ? ` ${item.city}` : ""}
                </dd>
              </div>
            )}
            {item.penalty_period && (
              <div>
                <dt className="text-xs text-gray-500 mb-1">処分期間</dt>
                <dd className="text-sm font-medium text-gray-900">{item.penalty_period}</dd>
              </div>
            )}
            {item.legal_basis && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500 mb-1">根拠法令</dt>
                <dd className="text-sm font-medium text-gray-900">{item.legal_basis}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 詳細本文 */}
        {item.detail && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">処分内容の詳細</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.detail}</p>
          </div>
        )}

        {/* ソース情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">情報ソース</h2>
          <div className="space-y-2">
            {item.source_name && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">出典:</span>
                <span className="text-sm text-gray-900">{item.source_name}</span>
              </div>
            )}
            {item.source_url && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">URL:</span>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate"
                >
                  {item.source_url}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 導線 */}
        <div className="flex justify-center py-4">
          <Link
            href="/gyosei-shobun"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            行政処分DB 一覧へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
