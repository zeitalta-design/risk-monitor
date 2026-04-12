"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getFacilityCategoryLabel,
  getFacilityCategoryIcon,
  getRecruitmentStatusBadge,
  formatDate,
  getDaysUntilDeadline,
} from "@/lib/shitei-config";

const shiteiDomain = getDomain("shitei");

// ─── キー情報バー ─────────────────────

function ShiteiInfoBanner({ item }) {
  const sb = getRecruitmentStatusBadge(item.recruitment_status);
  const deadline = item.application_deadline ? new Date(item.application_deadline) : null;
  const now = new Date();
  const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && !isPast && daysLeft <= 7;
  const isSoon = daysLeft !== null && !isPast && daysLeft <= 30;
  const accent = sb.color?.includes("red") ? "#DC2626" : sb.color?.includes("green") ? "#16A34A" : sb.color?.includes("amber") ? "#D97706" : "#2563EB";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {item.municipality_name && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">発行元</span>
              <span className="font-bold text-gray-900">{item.municipality_name}</span>
            </div>
          )}
          {item.prefecture && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">地域</span>
              <span className="font-medium text-gray-800">{item.prefecture}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">募集状態</span>
            <span className="font-bold text-gray-900">{sb.label}</span>
          </div>
          {item.application_deadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">応募期限</span>
              <span className={`font-bold ${isPast ? "text-gray-400" : isUrgent ? "text-red-600" : isSoon ? "text-amber-600" : "text-gray-900"}`}>
                {formatDate(item.application_deadline)}{daysLeft !== null && !isPast ? ` (残${daysLeft}日)` : isPast ? " (期限切れ)" : ""}
              </span>
            </div>
          )}
          {(item.detail_url || item.source_url) && (
            <div className="ml-auto">
              <a href={item.detail_url || item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
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

// ─── 応募期限カウントダウン ─────────────────────

function DeadlineCountdown({ deadline }) {
  const d = getDaysUntilDeadline(deadline);
  if (!d) return null;

  let bgColor = "bg-gray-50 border-gray-200";
  let textColor = "text-gray-700";
  if (d.past) { bgColor = "bg-gray-50 border-gray-200"; textColor = "text-gray-400"; }
  else if (d.urgent) { bgColor = "bg-red-50 border-red-200"; textColor = "text-red-700"; }
  else if (d.days <= 14) { bgColor = "bg-amber-50 border-amber-200"; textColor = "text-amber-700"; }
  else { bgColor = "bg-green-50 border-green-200"; textColor = "text-green-700"; }

  return (
    <div className={`border rounded-lg p-4 ${bgColor} text-center`}>
      <div className={`text-2xl font-bold ${textColor}`}>{d.text}</div>
      <div className="text-xs text-gray-500 mt-1">応募期限: {formatDate(deadline)}</div>
    </div>
  );
}

// ─── 募集情報サマリー ─────────────────────

function RecruitmentSummary({ item }) {
  const sb = getRecruitmentStatusBadge(item.recruitment_status);

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-4">募集情報</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DeadlineCountdown deadline={item.application_deadline} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">募集状態:</span>
            <span className={`badge ${sb.color}`}>{sb.label}</span>
          </div>
          {item.application_start_date && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24">公募開始:</span>
              <span className="text-sm text-gray-900">{formatDate(item.application_start_date)}</span>
            </div>
          )}
          {item.application_deadline && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24">応募期限:</span>
              <span className="text-sm text-gray-900 font-bold">{formatDate(item.application_deadline)}</span>
            </div>
          )}
          {item.opening_date && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24">説明会:</span>
              <span className="text-sm text-gray-900">{formatDate(item.opening_date)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── メインページ ─────────────────────

export default function ShiteiDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shitei/${slug}`);
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
            <p className="text-gray-500 mb-4">公募案件が見つかりません</p>
            <Link href="/shitei" className="btn-primary inline-block">公募一覧へ</Link>
          </div>
        }
      />
    );
  }

  const sb = getRecruitmentStatusBadge(item.recruitment_status);

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/shitei" className="hover:text-blue-600">指定管理公募まとめ</Link><span>/</span><span className="truncate">{item.title}</span></>}
      icon={getFacilityCategoryIcon(item.facility_category)}
      title={item.title}
      subtitle={[item.municipality_name, item.facility_name].filter(Boolean).join(" — ")}
      meta={
        <>
          <span className={`badge ${sb.color}`}>{sb.label}</span>
          <span className="badge badge-blue">{getFacilityCategoryLabel(item.facility_category)}</span>
          {item.municipality_name && <span className="text-xs text-gray-500">{item.municipality_name}</span>}
        </>
      }
      actions={
        <>
          {shiteiDomain && <DomainFavoriteButton itemId={item.id} domain={shiteiDomain} variant="button" />}
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/shitei" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      {/* キー情報バー */}
      <ShiteiInfoBanner item={item} />

      {/* 募集情報サマリー */}
      <RecruitmentSummary item={item} />

      {/* 概要 */}
      {item.summary && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">概要</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.summary}</p>
        </section>
      )}

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["案件名", item.title],
              ["自治体", item.municipality_name],
              ["都道府県", item.prefecture],
              ["施設名", item.facility_name],
              ["施設種別", <>{getFacilityCategoryIcon(item.facility_category)} {getFacilityCategoryLabel(item.facility_category)}</>],
              ["公募開始日", formatDate(item.application_start_date)],
              ["応募期限", formatDate(item.application_deadline)],
              ["説明会日", formatDate(item.opening_date)],
              ["契約開始", formatDate(item.contract_start_date)],
              ["契約終了", formatDate(item.contract_end_date)],
              ["募集状態", <span key="s" className={`badge ${sb.color}`}>{sb.label}</span>],
            ].filter(([, v]) => v != null && v !== "" && v !== "—").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-32">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 応募資格 */}
      {item.eligibility && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">応募資格</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.eligibility}</p>
        </section>
      )}

      {/* 応募方法 */}
      {item.application_method && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">応募方法</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.application_method}</p>
        </section>
      )}

      {/* 備考 */}
      {item.notes && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">備考</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.notes}</p>
        </section>
      )}

      {/* 参照リンク */}
      {(item.detail_url || item.source_url) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">参照リンク</h2>
          <div className="space-y-2">
            {item.detail_url && (
              <a href={item.detail_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                公募詳細ページを見る →
              </a>
            )}
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                {item.source_name ? `${item.source_name}を見る` : "情報元を見る"} →
              </a>
            )}
          </div>
        </section>
      )}
    </DomainDetailPage>
  );
}
