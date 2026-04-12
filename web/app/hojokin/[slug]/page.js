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
  getTargetLabel,
  getStatusLabel,
  getStatusColor,
  formatAmount,
  formatDeadline,
} from "@/lib/hojokin-config";

const hojokinDomain = getDomain("hojokin");

// ─── キー情報バー ─────────────────────

function HojokinInfoBanner({ item }) {
  const statusColor = getStatusColor(item.status);
  const accent = statusColor?.includes("green") ? "#16A34A" : statusColor?.includes("red") ? "#DC2626" : statusColor?.includes("amber") ? "#D97706" : "#2563EB";
  const deadline = item.deadline ? new Date(item.deadline) : null;
  const now = new Date();
  const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && !isPast && daysLeft <= 7;
  const isSoon = daysLeft !== null && !isPast && daysLeft <= 30;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {item.provider_name && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">提供主体</span>
              <span className="font-bold text-gray-900">{item.provider_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">募集状況</span>
            <span className="font-bold text-gray-900">{getStatusLabel(item.status)}</span>
          </div>
          {item.max_amount != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">補助上限</span>
              <span className="font-bold text-gray-900">{formatAmount(item.max_amount)}</span>
            </div>
          )}
          {item.deadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">公募締切</span>
              <span className={`font-bold ${isPast ? "text-gray-400" : isUrgent ? "text-red-600" : isSoon ? "text-amber-600" : "text-gray-900"}`}>
                {formatDeadline(item.deadline)}{daysLeft !== null && !isPast ? ` (残${daysLeft}日)` : isPast ? " (締切済)" : ""}
              </span>
            </div>
          )}
          {item.target_type && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">対象者</span>
              <span className="font-medium text-gray-800">{getTargetLabel(item.target_type)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HojokinDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hojokin/${slug}`);
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
            <p className="text-gray-500 mb-4">制度が見つかりません</p>
            <Link href="/hojokin" className="btn-primary inline-block">補助金一覧へ</Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/hojokin" className="hover:text-blue-600">補助金ナビ</Link><span>/</span><span>{item.title}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={item.provider_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className={`badge ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
          <span className="text-sm text-gray-600">上限 {formatAmount(item.max_amount)}</span>
        </>
      }
      actions={
        <>
          {hojokinDomain && <DomainFavoriteButton itemId={item.id} domain={hojokinDomain} variant="button" />}
          <DomainCompareButton domainId="hojokin" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/hojokin" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      <HojokinInfoBanner item={item} />

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">制度概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["提供主体", item.provider_name],
              ["支援カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["対象者", getTargetLabel(item.target_type)],
              ["補助上限額", <span key="amt" className="font-medium">{formatAmount(item.max_amount)}</span>],
              ["補助率", item.subsidy_rate || "—"],
              ["公募締切", formatDeadline(item.deadline)],
              ["募集状況", <span key="st" className={`badge ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>],
            ].map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DomainDetailPage>
  );
}
