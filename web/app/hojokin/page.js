"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import StatsDashboard from "@/components/StatsDashboard";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  hojokinConfig,
  getCategoryLabel,
  getCategoryIcon,
  getStatusLabel,
  getStatusColor,
  formatAmount,
  formatDeadline,
} from "@/lib/hojokin-config";

const hojokinDomain = getDomain("hojokin");
const PAGE_SIZE = 20;

const INITIAL_FILTERS = {
  keyword: "",
  category: "",
  target_type: "",
  status: "",
  provider: "",
  year: "",
  deadline_from: "",
  deadline_to: "",
  amount_min: "",
  amount_max: "",
  sort: "deadline",
  page: 1,
};

function HojokinCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/hojokin/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getCategoryIcon(item.category)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/hojokin/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.title}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {hojokinDomain && <DomainFavoriteButton itemId={item.id} domain={hojokinDomain} />}
            <DomainCompareButton domainId="hojokin" itemId={item.id} variant="compact" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.provider_name}</p>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className={`badge ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
          <span className="text-xs text-gray-600">上限 {formatAmount(item.max_amount)}</span>
          <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
        </div>
      </div>
    </div>
  );
}

export default function HojokinListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    category: searchParams.get("category") || "",
    target_type: searchParams.get("target_type") || "",
    status: searchParams.get("status") || "",
    provider: searchParams.get("provider") || "",
    year: searchParams.get("year") || "",
    deadline_from: searchParams.get("deadline_from") || "",
    deadline_to: searchParams.get("deadline_to") || "",
    amount_min: searchParams.get("amount_min") || "",
    amount_max: searchParams.get("amount_max") || "",
    sort: searchParams.get("sort") || "deadline",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.category) params.set("category", f.category);
    if (f.target_type) params.set("target_type", f.target_type);
    if (f.status) params.set("status", f.status);
    if (f.provider) params.set("provider", f.provider);
    if (f.year) params.set("year", f.year);
    if (f.deadline_from) params.set("deadline_from", f.deadline_from);
    if (f.deadline_to) params.set("deadline_to", f.deadline_to);
    if (f.amount_min) params.set("amount_min", f.amount_min);
    if (f.amount_max) params.set("amount_max", f.amount_max);
    if (f.sort && f.sort !== "deadline") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/hojokin${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      const statsParams = new URLSearchParams();
      const setBoth = (k, v) => { if (v) { listParams.set(k, v); statsParams.set(k, v); } };
      setBoth("keyword", filters.keyword);
      setBoth("category", filters.category);
      setBoth("target_type", filters.target_type);
      setBoth("status", filters.status);
      setBoth("provider", filters.provider);
      setBoth("year", filters.year);
      setBoth("deadline_from", filters.deadline_from);
      setBoth("deadline_to", filters.deadline_to);
      setBoth("amount_min", filters.amount_min);
      setBoth("amount_max", filters.amount_max);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/hojokin?${listParams}`),
        fetch(`/api/hojokin/stats?${statsParams}`),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch (err) {
      console.error("Failed to fetch hojokin:", err);
      setItems([]);
      setStats(null);
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

  const hasFilters = !!(
    filters.keyword || filters.category || filters.target_type ||
    filters.status || filters.provider || filters.year ||
    filters.deadline_from || filters.deadline_to ||
    filters.amount_min || filters.amount_max
  );

  const startItem = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filters.page * PAGE_SIZE, total);

  const handleSearch = () => setFilters({ ...formInput, page: 1 });
  const handleReset = () => {
    setFormInput(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
  };

  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "制度名・キーワード",
      placeholder: "例: IT導入補助金",
    },
    {
      type: "select",
      name: "category",
      label: "カテゴリ",
      options: hojokinConfig.categories.map((c) => ({ value: c.slug, label: c.label, icon: c.icon })),
    },
    {
      type: "select",
      name: "target_type",
      label: "対象",
      options: hojokinConfig.targetTypes.map((t) => ({ value: t.value, label: t.label })),
    },
    {
      type: "select",
      name: "status",
      label: "受付状況",
      options: hojokinConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })),
    },
    {
      type: "dateRange",
      name: ["deadline_from", "deadline_to"],
      label: "申請締切（期間）",
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    {
      key: "category",
      label: "カテゴリ",
      resolve: (v) => hojokinConfig.categories.find((c) => c.slug === v)?.label || v,
    },
    {
      key: "target_type",
      label: "対象",
      resolve: (v) => hojokinConfig.targetTypes.find((t) => t.value === v)?.label || v,
    },
    {
      key: "status",
      label: "受付状況",
      resolve: (v) => hojokinConfig.statusOptions.find((s) => s.value === v)?.label || v,
    },
    { key: "provider", label: "実施機関" },
    { key: "year", label: "年度（締切年）" },
    { key: "deadline_from", label: "締切From" },
    { key: "deadline_to", label: "締切To" },
    { key: "amount_min", label: "上限額(以上)", resolve: (v) => `${parseInt(v, 10).toLocaleString()}円` },
    { key: "amount_max", label: "上限額(以下)", resolve: (v) => `${parseInt(v, 10).toLocaleString()}円` },
  ], []);

  const onChipRemove = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  };

  const onStatsToggle = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <CategoryPageHeader categoryId="hojokin" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">補助金ナビ</h1>
          <p className="text-sm text-gray-500">
            国・自治体の補助金・助成金制度を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={(name, value) => setFormInput((p) => ({ ...p, [name]: value }))}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={hojokinConfig.sorts}
          sort={filters.sort}
          onSortChange={(v) => {
            setFormInput((p) => ({ ...p, sort: v }));
            setFilters((p) => ({ ...p, sort: v, page: 1 }));
          }}
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
            accent="#D97706"
            sections={[
              {
                title: "年別件数（締切年）",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year,
                  label: r.year,
                  count: r.count,
                  isUnknown: !r.year || r.year === "不明",
                })),
              },
              {
                title: "実施機関 TOP10",
                type: "ranking",
                filterKey: "provider",
                rows: (stats.countsByProvider || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
                })),
              },
              {
                title: "カテゴリ別",
                type: "ranking",
                filterKey: "category",
                rows: (stats.countsByCategory || []).map((r) => ({
                  value: r.category,
                  label: getCategoryLabel(r.category),
                  count: r.count,
                })),
              },
              {
                title: "受付状況別",
                type: "ranking",
                filterKey: "status",
                rows: (stats.countsByStatus || []).map((r) => ({
                  value: r.status,
                  label: getStatusLabel(r.status),
                  count: r.count,
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

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <HojokinCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する制度が見つかりません</p>
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

        <DomainCompareBar domainId="hojokin" comparePath="/hojokin/compare" label="制度" />
      </div>
    </div>
  );
}
