import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdministrativeActionBySlug, getRelatedAdministrativeActions } from "@/lib/repositories/gyosei-shobun";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";
import { siteConfig } from "@/lib/site-config";

// ─── 動的 metadata ─────────────────────

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getAdministrativeActionBySlug(slug);
  if (!item) return { title: "行政処分情報が見つかりません" };

  const actionLabel = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type)?.label || item.action_type;

  return {
    title: `${item.organization_name_raw} — ${actionLabel} | 行政処分DB`,
    description: item.summary
      ? item.summary.slice(0, 160)
      : `${item.organization_name_raw}に対する${actionLabel}の詳細情報。`,
    openGraph: {
      title: `${item.organization_name_raw} — ${actionLabel} | 行政処分DB | ${siteConfig.siteName}`,
      description: item.summary?.slice(0, 160) || `${item.organization_name_raw}に対する${actionLabel}の詳細。`,
    },
  };
}

// ─── 色定義 ─────────────────────

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", accent: "#DC2626" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "#D97706" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "#2563EB" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", accent: "#CA8A04" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", accent: "#16A34A" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", accent: "#6B7280" },
};

// ─── ページ本体 ─────────────────────

export default async function GyoseiShobunDetailPage({ params }) {
  const { slug } = await params;
  const item = getAdministrativeActionBySlug(slug);
  if (!item) notFound();

  const actionType = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type);
  const industryInfo = gyoseiShobunConfig.industries.find((i) => i.slug === item.industry);
  const authorityLevel = gyoseiShobunConfig.authorityLevels.find((l) => l.value === item.authority_level);
  const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;
  const relatedItems = getRelatedAdministrativeActions(item, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* パンくず */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-600 transition-colors">トップ</Link>
          <span className="text-gray-300">/</span>
          <Link href="/gyosei-shobun" className="hover:text-blue-600 transition-colors">行政処分DB</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 truncate max-w-[200px] sm:max-w-none">{item.organization_name_raw}</span>
        </nav>

        {/* ──── ヘッダーカード ──── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
          {/* アクセントバー */}
          <div className="h-1.5" style={{ backgroundColor: tc.accent }} />

          <div className="p-6">
            {/* 事業者名 */}
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl mt-0.5 shrink-0">{actionType?.icon || "📄"}</span>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-3">
                  {item.organization_name_raw}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm px-3 py-1 rounded-lg border font-bold ${tc.bg} ${tc.text} ${tc.border}`}>
                    {actionType?.label || item.action_type}
                  </span>
                  {industryInfo && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">
                      {industryInfo.icon} {industryInfo.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* キーメタ情報（処分日・行政庁・所在地） */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm border-t border-gray-100 pt-4">
              {item.action_date && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-xs">処分日</span>
                  <span className="font-bold text-gray-900">{item.action_date}</span>
                </div>
              )}
              {item.authority_name && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-xs">処分庁</span>
                  <span className="font-medium text-gray-800">{item.authority_name}</span>
                </div>
              )}
              {item.prefecture && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-xs">所在地</span>
                  <span className="font-medium text-gray-700">
                    {item.prefecture}{item.city ? ` ${item.city}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ──── 事案概要 ──── */}
        {item.summary && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">事案概要</h2>
            <p className="text-[15px] text-gray-800 leading-[1.85]">
              {item.summary}
            </p>
          </div>
        )}

        {/* ──── 基本情報 ──── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <InfoItem label="事業者名" value={item.organization_name_raw} />
            <InfoItem
              label="処分種別"
              value={actionType ? `${actionType.icon} ${actionType.label}` : item.action_type}
            />
            <InfoItem label="業種" value={industryInfo ? `${industryInfo.icon} ${industryInfo.label}` : item.industry} />
            <InfoItem label="処分日" value={item.action_date} />
            <InfoItem label="処分庁" value={item.authority_name} />
            <InfoItem
              label="行政レベル"
              value={authorityLevel?.label}
            />
            <InfoItem
              label="所在地"
              value={
                item.prefecture
                  ? `${item.prefecture}${item.city ? ` ${item.city}` : ""}`
                  : null
              }
            />
            <InfoItem label="処分期間" value={item.penalty_period} />
          </dl>
        </div>

        {/* ──── 詳細 ──── */}
        {item.detail && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">詳細</h2>
            <div className="text-[15px] text-gray-700 leading-[1.9] whitespace-pre-wrap break-words">
              {item.detail}
            </div>
          </div>
        )}

        {/* ──── 法令根拠 ──── */}
        {item.legal_basis && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">法令根拠</h2>
            <p className="text-sm text-gray-800 leading-relaxed font-medium bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              {item.legal_basis}
            </p>
          </div>
        )}

        {/* ──── 出典 ──── */}
        {(item.source_name || item.source_url) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">出典</h2>
            <div className="space-y-2">
              {item.source_name && (
                <p className="text-sm text-gray-700">{item.source_name}</p>
              )}
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  原典を確認する
                </a>
              )}
            </div>
          </div>
        )}

        {/* ──── 補足 ──── */}
        {item.updated_at && (
          <p className="text-xs text-gray-400 text-right mb-6">
            最終更新: {item.updated_at.substring(0, 10)}
          </p>
        )}

        {/* ──── 関連事案 ──── */}
        {relatedItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">関連する行政処分</h2>
            <div className="space-y-2.5">
              {relatedItems.map((ri) => {
                const riAction = gyoseiShobunConfig.actionTypes.find((t) => t.slug === ri.action_type);
                const riIndustry = gyoseiShobunConfig.industries.find((i) => i.slug === ri.industry);
                const riColor = ACTION_TYPE_COLORS[ri.action_type] || ACTION_TYPE_COLORS.other;
                return (
                  <Link
                    key={ri.id}
                    href={`/gyosei-shobun/${ri.slug}`}
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-lg shrink-0 mt-0.5">{riAction?.icon || "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-gray-900 truncate">{ri.organization_name_raw}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${riColor.bg} ${riColor.text} ${riColor.border}`}>
                          {riAction?.label || ri.action_type}
                        </span>
                        {riIndustry && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {riIndustry.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        {ri.action_date && <span>{ri.action_date}</span>}
                        {ri.prefecture && <span>{ri.prefecture}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ──── 導線 ──── */}
        <div className="flex justify-center py-4">
          <Link
            href="/gyosei-shobun"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            行政処分DB 一覧へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── key-value 表示コンポーネント ─────────────────────

function InfoItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="border-b border-gray-50 pb-3">
      <dt className="text-xs text-gray-400 font-medium mb-1">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
