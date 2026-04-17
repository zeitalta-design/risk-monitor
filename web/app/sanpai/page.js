"use client";

import { useMemo } from "react";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainResultCard from "@/components/core/DomainResultCard";
import StatsDashboard from "@/components/StatsDashboard";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import { PREFECTURES } from "@/lib/constants/prefectures";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { useDomainSearchPage } from "@/lib/core/useDomainSearchPage";
import {
  sanpaiConfig,
  getLicenseTypeLabel,
  getLicenseTypeIcon,
  getRiskLevel,
  getStatusBadge,
  getDaysSincePenalty,
} from "@/lib/sanpai-config";

const sanpaiDomain = getDomain("sanpai");
const PAGE_SIZE = 20;

const FILTER_KEYS = [
  "keyword", "prefecture", "license_type", "risk_level", "status",
  "date_from", "date_to", "year", "company",
];

const INITIAL_FILTERS = {
  keyword: "",
  prefecture: "",
  license_type: "",
  risk_level: "",
  status: "",
  date_from: "",
  date_to: "",
  year: "",
  company: "",
  sort: "newest",
  page: 1,
};

function SanpaiBadges({ item }) {
  const r = getRiskLevel(item.risk_level);
  const sb = getStatusBadge(item.status);
  const days = getDaysSincePenalty(item.latest_penalty_date);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className={`badge ${r.color}`}>{r.label}</span>
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getLicenseTypeLabel(item.license_type)}</span>
      {item.penalty_count > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
          処分{item.penalty_count}件
        </span>
      )}
      {days && (
        <span className={`text-xs ${days.recent ? "text-red-600 font-bold" : "text-gray-500"}`}>
          最終処分: {days.text}
        </span>
      )}
    </div>
  );
}

export default function SanpaiListPage() {
  const {
    items,
    total,
    totalPages,
    stats,
    loading,
    filters,
    formInput,
    setFilters,
    setFormInput,
    hasFilters,
    startItem,
    endItem,
    handleSearch,
    handleReset,
    goToPage,
    onChipRemove,
    onStatsToggle,
    onSortChange,
    onFormFieldChange,
  } = useDomainSearchPage({
    basePath: "/sanpai",
    listApiPath: "/api/sanpai",
    statsApiPath: "/api/sanpai/stats",
    filterKeys: FILTER_KEYS,
    initialFilters: INITIAL_FILTERS,
    defaultSort: "newest",
    pageSize: PAGE_SIZE,
  });

  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "事業者名・キーワード",
      placeholder: "例: 〇〇産業",
    },
    {
      type: "select",
      name: "prefecture",
      label: "所在地（都道府県）",
      emptyOption: { value: "", label: "指定なし（全国）" },
      options: PREFECTURES.map((p) => ({ value: p, label: p })),
    },
    {
      type: "dateRange",
      name: ["date_from", "date_to"],
      label: "処分日（期間）",
    },
    {
      type: "select",
      name: "license_type",
      label: "許可種別",
      options: sanpaiConfig.licenseTypes.map((t) => ({ value: t.slug, label: t.label, icon: t.icon })),
    },
    {
      type: "select",
      name: "risk_level",
      label: "リスクレベル",
      options: sanpaiConfig.riskLevels.map((r) => ({ value: r.value, label: r.label })),
    },
    {
      type: "select",
      name: "status",
      label: "ステータス",
      options: sanpaiConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })),
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    { key: "prefecture", label: "都道府県" },
    {
      key: "license_type",
      label: "許可種別",
      resolve: (v) => sanpaiConfig.licenseTypes.find((t) => t.slug === v)?.label || v,
    },
    {
      key: "risk_level",
      label: "リスク",
      resolve: (v) => sanpaiConfig.riskLevels.find((r) => r.value === v)?.label || v,
    },
    {
      key: "status",
      label: "ステータス",
      resolve: (v) => sanpaiConfig.statusOptions.find((s) => s.value === v)?.label || v,
    },
    { key: "date_from", label: "処分日From" },
    { key: "date_to", label: "処分日To" },
    { key: "year", label: "年度" },
    { key: "company", label: "事業者" },
  ], []);

  // shared card が求める { title, summary } に写像
  const cardItems = useMemo(
    () => items.map((item) => ({ ...item, title: item.company_name, summary: item.notes })),
    [items],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <CategoryPageHeader categoryId="sanpai" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">産廃処分ウォッチ</h1>
          <p className="text-sm text-gray-500">
            全国の産業廃棄物処理業者に対する行政処分情報を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={onFormFieldChange}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={sanpaiConfig.sorts}
          sort={filters.sort}
          onSortChange={onSortChange}
        />

        {hasFilters && (
          <ActiveFilterChips chipDefs={chipDefs} filters={filters} onRemove={onChipRemove} />
        )}

        {stats && stats.totalCount > 0 && (
          <StatsDashboard
            totalCount={stats.totalCount}
            hasFilters={hasFilters}
            filters={filters}
            onFilterChange={onStatsToggle}
            accent="#059669"
            sections={[
              {
                title: "年別件数（処分日）",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year, label: r.year, count: r.count,
                  isUnknown: !r.year || r.year === "不明",
                })),
              },
              {
                title: "事業者 TOP10",
                type: "ranking",
                filterKey: "company",
                rows: (stats.countsByCompany || []).map((r) => ({
                  value: r.name, label: r.name, count: r.count,
                })),
              },
              {
                title: "許可種別",
                type: "ranking",
                filterKey: "license_type",
                rows: (stats.countsByLicenseType || []).map((r) => ({
                  value: r.licenseType,
                  label: getLicenseTypeLabel(r.licenseType),
                  count: r.count,
                })),
              },
              {
                title: "都道府県 TOP10",
                type: "ranking",
                filterKey: "prefecture",
                rows: (stats.countsByPrefecture || []).map((r) => ({
                  value: r.prefecture, label: r.prefecture, count: r.count,
                })),
              },
            ]}
          />
        )}

        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {total}件中 {startItem}-{endItem}件を表示
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && cardItems.length > 0 && (
          <div className="space-y-3">
            {cardItems.map((item) => (
              <DomainResultCard
                key={item.id}
                item={item}
                domainId="sanpai"
                domain={sanpaiDomain}
                basePath="/sanpai"
                icon={getLicenseTypeIcon(item.license_type)}
                secondaryText={[item.prefecture, item.city].filter(Boolean).join(" ") || "—"}
                renderBadges={SanpaiBadges}
              />
            ))}
          </div>
        )}

        {!loading && cardItems.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">該当する事業者が見つかりません</p>
            <button onClick={handleReset} className="mt-4 text-sm text-blue-600 hover:underline">
              フィルタをリセット
            </button>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}

        {/* 許可種別から探す */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">許可種別から探す</h2>
          <div className="flex flex-wrap gap-2">
            {sanpaiConfig.licenseTypes.map((t) => (
              <button
                key={t.slug}
                onClick={() => {
                  setFormInput((p) => ({ ...p, license_type: t.slug }));
                  setFilters((p) => ({ ...p, license_type: t.slug, page: 1 }));
                }}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
