"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getLicenseTypeLabel,
  getLicenseTypeIcon,
  getWasteCategoryLabel,
  getRiskLevel,
  getPenaltyTypeLabel,
  getPenaltyTypeSeverity,
  getStatusBadge,
  formatDate,
} from "@/lib/sanpai-config";

const sanpaiDomain = getDomain("sanpai");

// ─── 処分履歴タイムライン ─────────────────────

function PenaltyTimeline({ penalties }) {
  if (!penalties || penalties.length === 0) {
    return (
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">処分履歴</h2>
        <p className="text-sm text-gray-500">行政処分の記録はありません。</p>
      </section>
    );
  }

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-4">処分履歴タイムライン</h2>
      <div className="relative">
        {/* タイムラインの縦線 */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {penalties.map((p, i) => {
            const severity = getPenaltyTypeSeverity(p.penalty_type);
            let dotColor = "bg-gray-400";
            if (severity >= 5) dotColor = "bg-red-500";
            else if (severity >= 4) dotColor = "bg-amber-500";
            else if (severity >= 3) dotColor = "bg-blue-500";
            else if (severity >= 2) dotColor = "bg-yellow-500";

            let borderColor = "border-gray-200";
            if (severity >= 5) borderColor = "border-red-200";
            else if (severity >= 4) borderColor = "border-amber-200";
            else if (severity >= 3) borderColor = "border-blue-200";

            return (
              <div key={p.id || i} className="relative pl-10">
                {/* タイムラインのドット */}
                <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full ${dotColor} ring-2 ring-white`} />

                <div className={`border ${borderColor} rounded-lg p-4`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-500">{formatDate(p.penalty_date)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      severity >= 5 ? "bg-red-100 text-red-700" :
                      severity >= 4 ? "bg-amber-100 text-amber-700" :
                      severity >= 3 ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {getPenaltyTypeLabel(p.penalty_type)}
                    </span>
                    {p.authority_name && (
                      <span className="text-xs text-gray-500">{p.authority_name}</span>
                    )}
                  </div>

                  {p.summary && (
                    <p className="text-sm text-gray-700 leading-relaxed">{p.summary}</p>
                  )}

                  {p.disposition_period && (
                    <p className="text-xs text-gray-500 mt-2">処分期間: {p.disposition_period}</p>
                  )}

                  {p.source_url && (
                    <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                      情報元を見る →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── リスクサマリー ─────────────────────

function RiskSummary({ item, penalties }) {
  const risk = getRiskLevel(item.risk_level);
  const penaltyCount = penalties?.length || 0;

  const typeCounts = {};
  (penalties || []).forEach((p) => {
    const label = getPenaltyTypeLabel(p.penalty_type);
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  });

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-3">リスク概要</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            risk.value === "critical" ? "text-red-600" :
            risk.value === "high" ? "text-amber-600" :
            risk.value === "medium" ? "text-blue-600" :
            "text-gray-600"
          }`}>
            {risk.label}
          </div>
          <div className="text-xs text-gray-500 mt-1">リスクレベル</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{penaltyCount}</div>
          <div className="text-xs text-gray-500 mt-1">処分件数</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{formatDate(item.latest_penalty_date)}</div>
          <div className="text-xs text-gray-500 mt-1">直近処分日</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{getStatusBadge(item.status).label}</div>
          <div className="text-xs text-gray-500 mt-1">事業者状態</div>
        </div>
      </div>

      {Object.keys(typeCounts).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeCounts).map(([label, count]) => (
              <span key={label} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                {label}: {count}件
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── キー情報バー ─────────────────────

function SanpaiInfoBanner({ item, penalties }) {
  const risk = getRiskLevel(item.risk_level);
  const sb = getStatusBadge(item.status);
  const penaltyCount = penalties?.length || 0;
  // risk.value: "critical"→red, "high"→amber, "medium"→blue, "low"→green
  const accent = risk.value === "critical" ? "#DC2626" : risk.value === "high" ? "#D97706" : risk.value === "medium" ? "#2563EB" : "#16A34A";
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">リスク</span>
            <span className={`font-bold ${risk.value === "critical" ? "text-red-600" : risk.value === "high" ? "text-amber-600" : risk.value === "medium" ? "text-blue-600" : "text-gray-700"}`}>{risk.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">ステータス</span>
            <span className="font-medium text-gray-800">{sb.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">処分件数</span>
            <span className={`font-bold ${penaltyCount > 0 ? "text-amber-700" : "text-gray-700"}`}>{penaltyCount}件</span>
          </div>
          {item.latest_penalty_date && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">直近処分日</span>
              <span className="font-medium text-gray-800">{item.latest_penalty_date}</span>
            </div>
          )}
          {item.prefecture && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">所在地</span>
              <span className="font-medium text-gray-700">{[item.prefecture, item.city].filter(Boolean).join(" ")}</span>
            </div>
          )}
          {(item.source_url || item.detail_url) && (
            <div className="ml-auto">
              <a href={item.source_url || item.detail_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
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

// ─── メインページ ─────────────────────

export default function SanpaiDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/sanpai/${slug}`);
        if (!res.ok) { setItem(null); return; }
        const data = await res.json();
        setItem(data.item || null);
        setPenalties(data.penalties || []);
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
            <p className="text-gray-500 mb-4">事業者情報が見つかりません</p>
            <Link href="/sanpai" className="btn-primary inline-block">事業者一覧へ</Link>
          </div>
        }
      />
    );
  }

  const risk = getRiskLevel(item.risk_level);
  const sb = getStatusBadge(item.status);

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/sanpai" className="hover:text-blue-600">産廃処分ウォッチ</Link><span>/</span><span>{item.company_name}</span></>}
      icon={getLicenseTypeIcon(item.license_type)}
      title={item.company_name}
      subtitle={[item.prefecture, item.city].filter(Boolean).join(" ")}
      meta={
        <>
          <span className={`badge ${risk.color}`}>{risk.label}</span>
          <span className={`badge ${sb.color}`}>{sb.label}</span>
          <span className="badge badge-blue">{getLicenseTypeLabel(item.license_type)}</span>
          {item.penalty_count > 0 && <span className="text-xs text-gray-500">処分{item.penalty_count}件</span>}
        </>
      }
      actions={
        <>
          {sanpaiDomain && <DomainFavoriteButton itemId={item.id} domain={sanpaiDomain} variant="button" />}
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/sanpai" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      {/* キー情報バー */}
      <SanpaiInfoBanner item={item} penalties={penalties} />

      {/* リスク概要 */}
      <RiskSummary item={item} penalties={penalties} />

      {/* 処分履歴タイムライン */}
      <PenaltyTimeline penalties={penalties} />

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["事業者名", item.company_name],
              ["法人番号", item.corporate_number],
              ["所在地", [item.prefecture, item.city].filter(Boolean).join(" ")],
              ["許可種別", <>{getLicenseTypeIcon(item.license_type)} {getLicenseTypeLabel(item.license_type)}</>],
              ["廃棄物区分", getWasteCategoryLabel(item.waste_category)],
              ["事業区域", item.business_area],
              ["ステータス", <span key="s" className={`badge ${sb.color}`}>{sb.label}</span>],
              ["リスクレベル", <span key="r" className={`badge ${risk.color}`}>{risk.label}</span>],
            ].filter(([, v]) => v != null && v !== "" && v !== "—").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 備考 */}
      {item.notes && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">備考</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.notes}</p>
        </section>
      )}

      {/* 参照リンク */}
      {(item.source_url || item.detail_url) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">参照リンク</h2>
          <div className="space-y-2">
            {item.source_url && (
              <div>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  {item.source_name ? `${item.source_name}を見る` : "情報元を見る"} →
                </a>
              </div>
            )}
            {item.detail_url && (
              <div>
                <a href={item.detail_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  詳細ページを見る →
                </a>
              </div>
            )}
          </div>
        </section>
      )}
    </DomainDetailPage>
  );
}
