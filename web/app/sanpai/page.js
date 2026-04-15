"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import StatsDashboard from "@/components/StatsDashboard";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import { PREFECTURES } from "@/lib/constants/prefectures";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
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

function RiskBadge({ level }) {
  const r = getRiskLevel(level);
  return <span className={`badge ${r.color}`}>{r.label}</span>;
}

function CardBadges({ item }) {
  const sb = getStatusBadge(item.status);
  const days = getDaysSincePenalty(item.latest_penalty_date);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <RiskBadge level={item.risk_level} />
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getLicenseTypeLabel(item.license_type)}</span>
      {item.penalty_count > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">処分{item.penalty_count}件</span>
      )}
      {days && (
        <span className={`text-xs ${days.recent ? "text-red-600 font-bold" : "text-gray-500"}`}>
          最終処分: {days.text}
        </span>
      )}
    </div>
  );
}

function SanpaiCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/sanpai/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getLicenseTypeIcon(item.license_type)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/sanpai/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.company_name}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {sanpaiDomain && <DomainFavoriteButton itemId={item.id} domain={sanpaiDomain} />}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{[item.prefecture, item.city].filter(Boolean).join(" ") || "—"}</p>
        {item.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.notes}</p>}
        <CardBadges item={item} />
      </div>
    </div>
  );
}

export default function SanpaiListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    prefecture: searchParams.get("prefecture") || "",
    license_type: searchParams.get("license_type") || "",
    risk_level: searchParams.get("risk_level") || "",
    status: searchParams.get("status") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    year: searchParams.get("year") || "",
    company: searchParams.get("company") || "",
    sort: searchParams.get("sort") || "newest",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.prefecture) params.set("prefecture", f.prefecture);
    if (f.license_type) params.set("license_type", f.license_type);
    if (f.risk_level) params.set("risk_level", f.risk_level);
    if (f.status) params.set("status", f.status);
    if (f.date_from) params.set("date_from", f.date_from);
    if (f.date_to) params.set("date_to", f.date_to);
    if (f.year) params.set("year", f.year);
    if (f.company) params.set("company", f.company);
    if (f.sort && f.sort !== "newest") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/sanpai${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      const statsParams = new URLSearchParams();
      const setBoth = (k, v) => { if (v) { listParams.set(k, v); statsParams.set(k, v); } };
      setBoth("keyword", filters.keyword);
      setBoth("prefecture", filters.prefecture);
      setBoth("license_type", filters.license_type);
      setBoth("risk_level", filters.risk_level);
      setBoth("status", filters.status);
      setBoth("date_from", filters.date_from);
      setBoth("date_to", filters.date_to);
      setBoth("year", filters.year);
      setBoth("company", filters.company);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/sanpai?${listParams}`),
        fetch(`/api/sanpai/stats?${statsParams}`),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch (err) {
      console.error("Failed to fetch sanpai:", err);
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
    filters.keyword || filters.prefecture || filters.license_type ||
    filters.risk_level || filters.status || filters.date_from || filters.date_to ||
    filters.year || filters.company
  );

  const startItem = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filters.page * PAGE_SIZE, total);

  const handleSearch = () => setFilters({ ...formInput, page: 1 });
  const handleReset = () => {
    setFormInput(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
  };

  // ─── 検索フィールド定義 ────────────────
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

  const onChipRemove = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  };

  // 統計ダッシュボードからのトグル
  const onStatsToggle = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  };

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
          onChange={(name, value) => setFormInput((p) => ({ ...p, [name]: value }))}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={sanpaiConfig.sorts}
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
            accent="#059669"
            sections={[
              {
                title: "年別件数（処分日）",
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
                title: "事業者別 TOP10",
                type: "ranking",
                filterKey: "company",
                rows: (stats.countsByCompany || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
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
                title: "都道府県別 TOP10",
                type: "ranking",
                filterKey: "prefecture",
                rows: (stats.countsByPrefecture || []).map((r) => ({
                  value: r.prefecture,
                  label: r.prefecture,
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
              <SanpaiCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
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
