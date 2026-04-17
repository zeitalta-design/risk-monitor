"use client";

import { useMemo } from "react";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainResultCard from "@/components/core/DomainResultCard";
import StatsDashboard from "@/components/StatsDashboard";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { useDomainSearchPage } from "@/lib/core/useDomainSearchPage";
import {
  kyoninkaConfig,
  getLicenseFamilyLabel,
  getLicenseFamilyIcon,
  getEntityStatusBadge,
} from "@/lib/kyoninka-config";

const kyoninkaDomain = getDomain("kyoninka");
const PAGE_SIZE = 20;

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const FILTER_KEYS = ["keyword", "prefecture", "license_family", "entity_status"];

const INITIAL_FILTERS = {
  keyword: "",
  prefecture: "",
  license_family: "",
  entity_status: "",
  sort: "newest",
  page: 1,
};

function KyoninkaBadges({ item }) {
  const sb = getEntityStatusBadge(item.entity_status);
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getLicenseFamilyLabel(item.primary_license_family)}</span>
      {item.registration_count > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
          許認可{item.registration_count}件
        </span>
      )}
      {item.corporate_number && (
        <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">法人番号あり</span>
      )}
    </div>
  );
}

export default function KyoninkaListPage() {
  const {
    items,
    total,
    totalPages,
    stats,
    loading,
    filters,
    formInput,
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
    basePath: "/kyoninka",
    listApiPath: "/api/kyoninka",
    statsApiPath: "/api/kyoninka/stats",
    filterKeys: FILTER_KEYS,
    initialFilters: INITIAL_FILTERS,
    defaultSort: "newest",
    pageSize: PAGE_SIZE,
  });

  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "事業者名・法人番号・住所",
      placeholder: "例: 〇〇建設",
    },
    {
      type: "select",
      name: "prefecture",
      label: "都道府県",
      options: PREFECTURES.map((p) => ({ value: p, label: p })),
    },
    {
      type: "select",
      name: "license_family",
      label: "許認可カテゴリ",
      options: kyoninkaConfig.licenseFamilies.map((f) => ({ value: f.slug, label: f.label, icon: f.icon })),
    },
    {
      type: "select",
      name: "entity_status",
      label: "事業者ステータス",
      options: kyoninkaConfig.entityStatuses.map((s) => ({ value: s.value, label: s.label })),
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    { key: "prefecture", label: "都道府県" },
    {
      key: "license_family",
      label: "許認可カテゴリ",
      resolve: (v) => kyoninkaConfig.licenseFamilies.find((f) => f.slug === v)?.label || v,
    },
    {
      key: "entity_status",
      label: "事業者ステータス",
      resolve: (v) => kyoninkaConfig.entityStatuses.find((s) => s.value === v)?.label || v,
    },
  ], []);

  // kyoninka の item は title=entity_name, summary=notes で shared card に渡す
  const cardItems = useMemo(
    () => items.map((item) => ({ ...item, title: item.entity_name, summary: item.notes })),
    [items],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <CategoryPageHeader categoryId="kyoninka" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">許認可検索</h1>
          <p className="text-sm text-gray-500">
            建設・不動産・運送など事業者の許認可・届出認定情報を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={onFormFieldChange}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={kyoninkaConfig.sorts}
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
            accent="#0891B2"
            sections={[
              {
                title: "年別件数（最終更新年）",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year, label: r.year, count: r.count,
                })),
              },
              {
                title: "事業者 TOP10",
                type: "ranking",
                filterKey: "entity",
                rows: (stats.countsByEntity || []).map((r) => ({
                  value: r.name, label: r.name, count: r.count,
                })),
              },
              {
                title: "許認可カテゴリ別",
                type: "ranking",
                filterKey: "license_family",
                rows: (stats.countsByLicenseFamily || []).map((r) => ({
                  value: r.licenseFamily,
                  label: getLicenseFamilyLabel(r.licenseFamily),
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
                domainId="kyoninka"
                domain={kyoninkaDomain}
                basePath="/kyoninka"
                icon={getLicenseFamilyIcon(item.primary_license_family)}
                secondaryText={[item.prefecture, item.city].filter(Boolean).join(" ") || "—"}
                renderBadges={KyoninkaBadges}
              />
            ))}
          </div>
        )}

        {!loading && cardItems.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する事業者が見つかりません</p>
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
      </div>
    </div>
  );
}
