"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";
import { PREFECTURES } from "@/lib/constants/prefectures";
import RiskScoreBadge from "@/components/gyosei-shobun/RiskScoreBadge";
import LegalDisclaimer from "@/components/gyosei-shobun/LegalDisclaimer";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

const PAGE_SIZE = 20;

const AUTHORITY_OPTIONS = [
  { value: "金融庁", label: "金融庁" },
  { value: "消費者庁", label: "消費者庁" },
  { value: "公正取引委員会", label: "公正取引委員会" },
  { value: "個人情報保護委員会", label: "個人情報保護委員会" },
  { value: "国税庁", label: "国税庁" },
  { value: "国土交通省", label: "国土交通省" },
  { value: "厚生労働省", label: "厚生労働省（労働局）" },
];

export default function GyoseiShobunListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    action_type: searchParams.get("action_type") || "",
    prefecture: searchParams.get("prefecture") || "",
    industry: searchParams.get("industry") || "",
    year: searchParams.get("year") || "",
    organization: searchParams.get("organization") || "",
    authority: searchParams.get("authority") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    sort: searchParams.get("sort") || "newest",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.action_type) params.set("action_type", f.action_type);
    if (f.prefecture) params.set("prefecture", f.prefecture);
    if (f.industry) params.set("industry", f.industry);
    if (f.year) params.set("year", f.year);
    if (f.organization) params.set("organization", f.organization);
    if (f.authority) params.set("authority", f.authority);
    if (f.date_from) params.set("date_from", f.date_from);
    if (f.date_to) params.set("date_to", f.date_to);
    if (f.sort && f.sort !== "newest") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/gyosei-shobun${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      if (filters.keyword) listParams.set("keyword", filters.keyword);
      if (filters.action_type) listParams.set("action_type", filters.action_type);
      if (filters.prefecture) listParams.set("prefecture", filters.prefecture);
      if (filters.industry) listParams.set("industry", filters.industry);
      if (filters.year) listParams.set("year", filters.year);
      if (filters.organization) listParams.set("organization", filters.organization);
      if (filters.authority) listParams.set("authority", filters.authority);
      if (filters.date_from) listParams.set("date_from", filters.date_from);
      if (filters.date_to) listParams.set("date_to", filters.date_to);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      const listRes = await fetch(`/api/gyosei-shobun?${listParams}`);
      const listData = await listRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    syncUrl(filters);
  }, [fetchData, syncUrl, filters]);

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setFilters((prev) => ({ ...prev, page: clamped }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startItem = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(filters.keyword || filters.action_type || filters.prefecture || filters.industry || filters.year || filters.organization || filters.authority || filters.date_from || filters.date_to);

  const handleSearch = () => {
    setFilters({ ...formInput, page: 1 });
  };
  const handleReset = () => {
    const empty = {
      keyword: "", action_type: "", prefecture: "", industry: "",
      year: "", organization: "", authority: "", date_from: "", date_to: "",
      sort: "newest", page: 1,
    };
    setFormInput(empty);
    setFilters(empty);
  };

  // フィールド定義
  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "事業者名・キーワード",
      placeholder: "例: 〇〇株式会社",
    },
    {
      type: "select",
      name: "prefecture",
      label: "所在地（都道府県）",
      emptyOption: { value: "", label: "指定なし（全国 + 国レベル処分）" },
      options: PREFECTURES.map((p) => ({ value: p, label: p })),
    },
    {
      type: "dateRange",
      name: ["date_from", "date_to"],
      label: "処分日（期間）",
    },
    {
      type: "select",
      name: "authority",
      label: "処分を行った機関",
      options: AUTHORITY_OPTIONS,
    },
    {
      type: "select",
      name: "action_type",
      label: "処分種別",
      options: gyoseiShobunConfig.actionTypes.map((t) => ({ value: t.slug, label: t.label, icon: t.icon })),
    },
    {
      type: "select",
      name: "industry",
      label: "業種",
      options: gyoseiShobunConfig.industries.map((i) => ({ value: i.slug, label: i.label, icon: i.icon })),
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    { key: "action_type", label: "処分種別", resolve: (v) => gyoseiShobunConfig.actionTypes.find((t) => t.slug === v)?.label || v },
    { key: "industry", label: "業種", resolve: (v) => gyoseiShobunConfig.industries.find((i) => i.slug === v)?.label || v },
    { key: "prefecture", label: "都道府県" },
    { key: "authority", label: "処分機関" },
    { key: "date_from", label: "処分日From" },
    { key: "date_to", label: "処分日To" },
    { key: "year", label: "年度" },
    { key: "organization", label: "事業者" },
  ], []);

  const onChipRemove = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">行政処分DB</h1>
          <p className="text-sm text-gray-500">
            建設業・運送業・廃棄物処理業など、各業種の行政処分情報を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={(name, value) => setFormInput((p) => ({ ...p, [name]: value }))}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={gyoseiShobunConfig.sorts}
          sort={filters.sort}
          onSortChange={(v) => {
            setFormInput((p) => ({ ...p, sort: v }));
            setFilters((p) => ({ ...p, sort: v, page: 1 }));
          }}
        />

        {hasFilters && (
          <ActiveFilterChips chipDefs={chipDefs} filters={filters} onRemove={onChipRemove} />
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

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;
              const actionLabel = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type)?.label || item.action_type;
              const actionIcon = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type)?.icon || "📄";
              const industryLabel = gyoseiShobunConfig.industries.find((i) => i.slug === item.industry)?.label || "";

              return (
                <Link
                  key={item.id}
                  href={`/gyosei-shobun/${item.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 block hover:shadow-md hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-xl flex-shrink-0 mt-0.5">{actionIcon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 leading-snug break-words">{item.organization_name_raw}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${tc.bg} ${tc.text} ${tc.border}`}>
                          {actionLabel}
                        </span>
                        {industryLabel && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {industryLabel}
                          </span>
                        )}
                        <RiskScoreBadge action={item} mode="compact" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs mb-2 ml-8">
                    {item.action_date && (
                      <span className="text-gray-700 font-medium">{item.action_date}</span>
                    )}
                    {item.authority_name && (
                      <span className="text-gray-500">{item.authority_name}</span>
                    )}
                    {item.prefecture && (
                      <span className="text-gray-400">{item.prefecture}{item.city ? ` ${item.city}` : ""}</span>
                    )}
                  </div>
                  {item.summary && (
                    <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 ml-8">{item.summary}</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">該当する行政処分はありません</p>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}
        <LegalDisclaimer />
      </div>
    </div>
  );
}
