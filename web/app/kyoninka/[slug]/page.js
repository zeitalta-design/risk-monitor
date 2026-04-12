"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getLicenseFamilyLabel,
  getLicenseFamilyIcon,
  getLicenseTypeLabel,
  getRegistrationStatusBadge,
  getEntityStatusBadge,
  formatDate,
  isRegistrationValid,
} from "@/lib/kyoninka-config";

const kyoninkaDomain = getDomain("kyoninka");

// ─── キー情報バー ─────────────────────

function KyoninkaInfoBanner({ item, registrations }) {
  const sb = getEntityStatusBadge(item.entity_status);
  const activeCount = (registrations || []).filter(isRegistrationValid).length;
  const hasDisciplinary = (registrations || []).some((r) => r.disciplinary_flag === 1);
  const accent = hasDisciplinary ? "#DC2626" : sb.color?.includes("green") ? "#16A34A" : sb.color?.includes("red") ? "#DC2626" : "#2563EB";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(item.prefecture || item.city) && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">所在地</span>
              <span className="font-bold text-gray-900">{[item.prefecture, item.city].filter(Boolean).join(" ")}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">事業者状態</span>
            <span className="font-bold text-gray-900">{sb.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">許認可総数</span>
            <span className="font-bold text-gray-900">{registrations?.length || 0}件 / 有効{activeCount}件</span>
          </div>
          {hasDisciplinary && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold">⚠ 行政処分あり</span>
            </div>
          )}
          {item.source_url && (
            <div className="ml-auto">
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
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

// ─── 許認可一覧テーブル ─────────────────────

function RegistrationList({ registrations }) {
  if (!registrations || registrations.length === 0) {
    return (
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">保有許認可</h2>
        <p className="text-sm text-gray-500">登録されている許認可情報はありません。</p>
      </section>
    );
  }

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-4">保有許認可一覧</h2>
      <div className="space-y-4">
        {registrations.map((reg, i) => {
          const statusBadge = getRegistrationStatusBadge(reg.registration_status);
          const valid = isRegistrationValid(reg);
          const familyIcon = getLicenseFamilyIcon(reg.license_family);

          return (
            <div key={reg.id || i} className={`border rounded-lg p-4 ${valid ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{familyIcon}</span>
                  <span className="text-sm font-bold text-gray-900">{getLicenseFamilyLabel(reg.license_family)}</span>
                  {reg.license_type && (
                    <span className="text-xs text-gray-500">— {getLicenseTypeLabel(reg.license_family, reg.license_type)}</span>
                  )}
                </div>
                <span className={`badge ${statusBadge.color} shrink-0`}>{statusBadge.label}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {reg.registration_number && (
                  <div>
                    <span className="text-gray-500">登録番号: </span>
                    <span className="text-gray-900 font-mono">{reg.registration_number}</span>
                  </div>
                )}
                {reg.authority_name && (
                  <div>
                    <span className="text-gray-500">許可庁: </span>
                    <span className="text-gray-900">{reg.authority_name}</span>
                  </div>
                )}
                {reg.valid_from && (
                  <div>
                    <span className="text-gray-500">登録日: </span>
                    <span className="text-gray-900">{formatDate(reg.valid_from)}</span>
                  </div>
                )}
                {reg.valid_to && (
                  <div>
                    <span className="text-gray-500">有効期限: </span>
                    <span className={`${new Date(reg.valid_to) < new Date() ? "text-red-600 font-bold" : "text-gray-900"}`}>
                      {formatDate(reg.valid_to)}
                    </span>
                  </div>
                )}
                {reg.prefecture && (
                  <div>
                    <span className="text-gray-500">許可地域: </span>
                    <span className="text-gray-900">{reg.prefecture}</span>
                  </div>
                )}
                {reg.disciplinary_flag === 1 && (
                  <div>
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold">行政処分あり</span>
                  </div>
                )}
              </div>

              {(reg.source_url || reg.detail_url) && (
                <div className="mt-2 flex gap-3">
                  {reg.source_url && (
                    <a href={reg.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                      情報元 →
                    </a>
                  )}
                  {reg.detail_url && (
                    <a href={reg.detail_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                      詳細 →
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── 許認可サマリー ─────────────────────

function RegistrationSummary({ item, registrations }) {
  const sb = getEntityStatusBadge(item.entity_status);
  const activeCount = (registrations || []).filter(isRegistrationValid).length;
  const totalCount = registrations?.length || 0;
  const hasDisciplinary = (registrations || []).some((r) => r.disciplinary_flag === 1);

  // カテゴリ別内訳
  const familyCounts = {};
  (registrations || []).forEach((r) => {
    const label = getLicenseFamilyLabel(r.license_family);
    familyCounts[label] = (familyCounts[label] || 0) + 1;
  });

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-3">許認可概要</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
          <div className="text-xs text-gray-500 mt-1">許認可総数</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${activeCount > 0 ? "text-green-600" : "text-gray-400"}`}>{activeCount}</div>
          <div className="text-xs text-gray-500 mt-1">有効</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold ${sb.color.includes("green") ? "text-green-600" : "text-gray-600"}`}>{sb.label}</div>
          <div className="text-xs text-gray-500 mt-1">事業者状態</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold ${hasDisciplinary ? "text-red-600" : "text-gray-400"}`}>
            {hasDisciplinary ? "あり" : "なし"}
          </div>
          <div className="text-xs text-gray-500 mt-1">行政処分</div>
        </div>
      </div>

      {Object.keys(familyCounts).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            {Object.entries(familyCounts).map(([label, count]) => (
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

// ─── メインページ ─────────────────────

export default function KyoninkaDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/kyoninka/${slug}`);
        if (!res.ok) { setItem(null); return; }
        const data = await res.json();
        setItem(data.item || null);
        setRegistrations(data.registrations || []);
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
            <Link href="/kyoninka" className="btn-primary inline-block">事業者一覧へ</Link>
          </div>
        }
      />
    );
  }

  const sb = getEntityStatusBadge(item.entity_status);

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/kyoninka" className="hover:text-blue-600">許認可検索</Link><span>/</span><span>{item.entity_name}</span></>}
      icon={getLicenseFamilyIcon(item.primary_license_family)}
      title={item.entity_name}
      subtitle={[item.prefecture, item.city].filter(Boolean).join(" ")}
      meta={
        <>
          <span className={`badge ${sb.color}`}>{sb.label}</span>
          <span className="badge badge-blue">{getLicenseFamilyLabel(item.primary_license_family)}</span>
          {item.registration_count > 0 && <span className="text-xs text-gray-500">許認可{item.registration_count}件</span>}
          {item.corporate_number && <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">法人番号あり</span>}
        </>
      }
      actions={
        <>
          {kyoninkaDomain && <DomainFavoriteButton itemId={item.id} domain={kyoninkaDomain} variant="button" />}
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/kyoninka" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      {/* キー情報バー */}
      <KyoninkaInfoBanner item={item} registrations={registrations} />

      {/* 許認可サマリー */}
      <RegistrationSummary item={item} registrations={registrations} />

      {/* 保有許認可一覧 */}
      <RegistrationList registrations={registrations} />

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["事業者名", item.entity_name],
              ["法人番号", item.corporate_number],
              ["所在地", [item.prefecture, item.city, item.address].filter(Boolean).join(" ")],
              ["主要許認可", <>{getLicenseFamilyIcon(item.primary_license_family)} {getLicenseFamilyLabel(item.primary_license_family)}</>],
              ["事業者状態", <span key="s" className={`badge ${sb.color}`}>{sb.label}</span>],
              ["許認可登録数", `${item.registration_count}件`],
            ].filter(([, v]) => v != null && v !== "" && v !== "—" && v !== "0件").map(([label, value], i, arr) => (
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
      {item.source_url && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">参照リンク</h2>
          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
            {item.source_name ? `${item.source_name}を見る` : "情報元を見る"} →
          </a>
        </section>
      )}
    </DomainDetailPage>
  );
}
