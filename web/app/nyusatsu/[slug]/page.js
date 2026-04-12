"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getCategoryLabel,
  getCategoryIcon,
  getBiddingMethodLabel,
  formatBudget,
  formatDeadline,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");

// ─── キー情報バー ─────────────────────

function NyusatsuInfoBanner({ item }) {
  // 締切の緊急度でアクセントカラー決定
  // item.deadline が文字列 "YYYY-MM-DD" 形式を想定
  const deadline = item.deadline ? new Date(item.deadline) : null;
  const now = new Date();
  const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && !isPast && daysLeft <= 7;
  const isSoon = daysLeft !== null && !isPast && daysLeft <= 30;
  const accent = isPast ? "#9CA3AF" : isUrgent ? "#DC2626" : isSoon ? "#D97706" : "#2563EB";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {item.issuer_name && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">発注機関</span>
              <span className="font-bold text-gray-900">{item.issuer_name}</span>
            </div>
          )}
          {item.target_area && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">対象地域</span>
              <span className="font-medium text-gray-800">{item.target_area}</span>
            </div>
          )}
          {item.budget_amount != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">予算規模</span>
              <span className="font-bold text-gray-900">{formatBudget(item.budget_amount)}</span>
            </div>
          )}
          {item.deadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">締切</span>
              <span className={`font-bold ${isPast ? "text-gray-400" : isUrgent ? "text-red-600" : isSoon ? "text-amber-600" : "text-gray-900"}`}>
                {formatDeadline(item.deadline)}{daysLeft !== null && !isPast ? ` (残${daysLeft}日)` : isPast ? " (締切済)" : ""}
              </span>
            </div>
          )}
          {item.announcement_url && (
            <div className="ml-auto">
              <a href={item.announcement_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                原文ソース
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NyusatsuDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/nyusatsu/${slug}`);
        if (!res.ok) { setItem(null); return; }
        const data = await res.json();
        setItem(data.item || null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <DomainDetailPage loading />;

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">案件が見つかりません</p>
            <Link href="/nyusatsu" className="btn-primary inline-block">入札ナビ一覧へ</Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/nyusatsu" className="hover:text-blue-600">入札ナビ</Link><span>/</span><span>{item.title}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={item.issuer_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className="text-sm text-gray-600">{formatBudget(item.budget_amount)}</span>
          <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
        </>
      }
      actions={
        <>
          {nyusatsuDomain && <DomainFavoriteButton itemId={item.id} domain={nyusatsuDomain} variant="button" />}
          <DomainCompareButton domainId="nyusatsu" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/nyusatsu" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      <NyusatsuInfoBanner item={item} />

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">案件概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["発注機関", item.issuer_name],
              ["カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["対象地域", item.target_area],
              ["予算規模", <span key="b" className="font-medium">{formatBudget(item.budget_amount)}</span>],
              ["入札方式", getBiddingMethodLabel(item.bidding_method)],
              ["公告日", item.announcement_date ? formatDeadline(item.announcement_date) : null],
              ["締切日", formatDeadline(item.deadline)],
              ["契約期間", item.contract_period],
            ].filter(([, v]) => v != null && v !== "—" && v !== "").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 応募・参加条件 */}
      {item.qualification && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">応募・参加条件</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.qualification}</p>
        </section>
      )}

      {/* 履行・納入情報 */}
      {(item.delivery_location || item.contract_period) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">履行・納入情報</h2>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["履行場所", item.delivery_location],
                ["契約期間", item.contract_period],
              ].filter(([, v]) => v).map(([label, value], i, arr) => (
                <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                  <td className="py-3 text-gray-500 w-40">{label}</td>
                  <td className="py-3 text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 公告・資料 */}
      {(item.announcement_url || item.has_attachment) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">公告・資料</h2>
          <div className="space-y-2">
            {item.announcement_url && (
              <div>
                <a href={item.announcement_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  公告元サイトを見る →
                </a>
              </div>
            )}
            {item.has_attachment ? (
              <p className="text-sm text-green-700">📎 添付資料あり</p>
            ) : null}
          </div>
        </section>
      )}

      {/* 問い合わせ先 */}
      {item.contact_info && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">問い合わせ先</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.contact_info}</p>
        </section>
      )}

      {/* 関連導線 */}
      <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
        {item.category && (
          <Link href={`/nyusatsu/category/${item.category}`} className="block text-sm text-blue-600 hover:underline">
            {getCategoryIcon(item.category)} {getCategoryLabel(item.category)}の案件をもっと見る →
          </Link>
        )}
        {item.target_area && (
          <Link href={`/nyusatsu/area/${encodeURIComponent(item.target_area)}`} className="block text-sm text-blue-600 hover:underline">
            {item.target_area}の案件をもっと見る →
          </Link>
        )}
      </div>
    </DomainDetailPage>
  );
}
