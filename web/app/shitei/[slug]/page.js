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
