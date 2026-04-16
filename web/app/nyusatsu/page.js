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
  nyusatsuConfig,
  getCategoryLabel,
  getCategoryIcon,
  formatBudget,
  formatDeadline,
  getBiddingMethodLabel,
  getStatusBadge,
  getDeadlineRemaining,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");
const PAGE_SIZE = 20;

const INITIAL_FILTERS = {
  keyword: "",
  category: "",
  area: "",
  bidding_method: "",
  budget_range: "",
  deadline_within: "",
  status: "",
  issuer: "",
  year: "",
  deadline_from: "",
  deadline_to: "",
  sort: "deadline",
  page: 1,
};

function CardBadges({ item }) {
  const sb = getStatusBadge(item.status);
  const dr = getDeadlineRemaining(item.deadline);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      {item.bidding_method && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{getBiddingMethodLabel(item.bidding_method)}</span>
      )}
      <span className="text-xs text-gray-600">{formatBudget(item.budget_amount)}</span>
      {dr ? (
        dr.expired ? (
          <span className="text-xs text-gray-400 line-through">締切: {formatDeadline(item.deadline)}</span>
        ) : (
          <span className={`text-xs ${dr.urgent ? "text-red-600 font-bold" : "text-gray-500"}`}>
            {dr.text}（{formatDeadline(item.deadline)}）
          </span>
        )
      ) : (
        <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
      )}
    </div>
  );
}

function NyusatsuCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/nyusatsu/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getCategoryIcon(item.category)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/nyusatsu/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.title}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {nyusatsuDomain && <DomainFavoriteButton itemId={item.id} domain={nyusatsuDomain} />}
            <DomainCompareButton domainId="nyusatsu" itemId={item.id} variant="compact" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.issuer_name}</p>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
        <CardBadges item={item} />
      </div>
    </div>
  );
}

export default function NyusatsuListPage() {
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
    area: searchParams.get("area") || "",
    bidding_method: searchParams.get("bidding_method") || "",
    budget_range: searchParams.get("budget_range") || "",
    deadline_within: searchParams.get("deadline_within") || "",
    status: searchParams.get("status") || "",
    issuer: searchParams.get("issuer") || "",
    year: searchParams.get("year") || "",
    deadline_from: searchParams.get("deadline_from") || "",
    deadline_to: searchParams.get("deadline_to") || "",
    sort: searchParams.get("sort") || "deadline",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.category) params.set("category", f.category);
    if (f.area) params.set("area", f.area);
    if (f.bidding_method) params.set("bidding_method", f.bidding_method);
    if (f.budget_range) params.set("budget_range", f.budget_range);
    if (f.deadline_within) params.set("deadline_within", f.deadline_within);
    if (f.status) params.set("status", f.status);
    if (f.issuer) params.set("issuer", f.issuer);
    if (f.year) params.set("year", f.year);
    if (f.deadline_from) params.set("deadline_from", f.deadline_from);
    if (f.deadline_to) params.set("deadline_to", f.deadline_to);
    if (f.sort && f.sort !== "deadline") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/nyusatsu${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      const statsParams = new URLSearchParams();
      const setBoth = (k, v) => { if (v) { listParams.set(k, v); statsParams.set(k, v); } };
      setBoth("keyword", filters.keyword);
      setBoth("category", filters.category);
      setBoth("area", filters.area);
      setBoth("bidding_method", filters.bidding_method);
      setBoth("budget_range", filters.budget_range);
      setBoth("deadline_within", filters.deadline_within);
      setBoth("status", filters.status);
      setBoth("issuer", filters.issuer);
      setBoth("year", filters.year);
      setBoth("deadline_from", filters.deadline_from);
      setBoth("deadline_to", filters.deadline_to);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/nyusatsu?${listParams}`),
        fetch(`/api/nyusatsu/stats?${statsParams}`),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch (err) {
      console.error("Failed to fetch nyusatsu:", err);
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
    filters.keyword || filters.category || filters.area || filters.bidding_method ||
    filters.budget_range || filters.deadline_within || filters.status ||
    filters.issuer || filters.year || filters.deadline_from || filters.deadline_to
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
      label: "案件名・発注機関",
      placeholder: "例: 庁舎建設工事",
    },
    {
      type: "select",
      name: "category",
      label: "案件種別",
      options: nyusatsuConfig.categories.map((c) => ({ value: c.slug, label: c.label, icon: c.icon })),
    },
    {
      type: "select",
      name: "area",
      label: "対象地域",
      options: nyusatsuConfig.areas.map((a) => ({ value: a.value, label: a.label })),
    },
    {
      type: "select",
      name: "bidding_method",
      label: "入札方式",
      options: nyusatsuConfig.biddingMethods.map((m) => ({ value: m.value, label: m.label })),
    },
    {
      type: "dateRange",
      name: ["deadline_from", "deadline_to"],
      label: "締切（期間）",
    },
    {
      type: "select",
      name: "status",
      label: "ステータス",
      options: nyusatsuConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })),
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    {
      key: "category",
      label: "案件種別",
      resolve: (v) => nyusatsuConfig.categories.find((c) => c.slug === v)?.label || v,
    },
    {
      key: "area",
      label: "対象地域",
      resolve: (v) => nyusatsuConfig.areas.find((a) => a.value === v)?.label || v,
    },
    {
      key: "bidding_method",
      label: "入札方式",
      resolve: (v) => nyusatsuConfig.biddingMethods.find((m) => m.value === v)?.label || v,
    },
    {
      key: "status",
      label: "ステータス",
      resolve: (v) => nyusatsuConfig.statusOptions.find((s) => s.value === v)?.label || v,
    },
    { key: "issuer", label: "発注機関" },
    { key: "year", label: "年度（締切年）" },
    { key: "deadline_from", label: "締切From" },
    { key: "deadline_to", label: "締切To" },
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
        <CategoryPageHeader categoryId="nyusatsu" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">入札ナビ</h1>
          <p className="text-sm text-gray-500">
            官公庁・自治体の入札・公募情報を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={(name, value) => setFormInput((p) => ({ ...p, [name]: value }))}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={nyusatsuConfig.sorts}
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
            accent="#7C3AED"
            sections={[
              {
                title: "年別件数（公告/締切）",
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
                title: "発注機関 TOP10",
                type: "ranking",
                filterKey: "issuer",
                rows: (stats.countsByIssuer || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
                })),
              },
              {
                title: "案件種別",
                type: "ranking",
                filterKey: "category",
                rows: (stats.countsByCategory || []).map((r) => ({
                  value: r.category,
                  label: getCategoryLabel(r.category),
                  count: r.count,
                })),
              },
              {
                title: "ステータス別",
                type: "ranking",
                filterKey: "status",
                rows: (stats.countsByStatus || []).map((r) => ({
                  value: r.status,
                  label: r.status,
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
              <NyusatsuCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する案件が見つかりません</p>
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

        <DomainCompareBar domainId="nyusatsu" comparePath="/nyusatsu/compare" label="案件" />
      </div>
    </div>
  );
}
