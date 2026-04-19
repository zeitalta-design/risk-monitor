"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import StatsDashboard from "@/components/StatsDashboard";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { key: "newest", label: "落札日が新しい順" },
  { key: "amount_desc", label: "落札金額が高い順" },
  { key: "amount_asc", label: "落札金額が低い順" },
];

const INITIAL_FILTERS = {
  keyword: "",
  category: "",
  winner: "",
  issuer: "",
  year: "",
  award_date_from: "",
  award_date_to: "",
  sort: "newest",
  page: 1,
};

function formatAmount(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億円`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(0)}万円`;
  return `${amount.toLocaleString()}円`;
}

function getCategoryLabel(cat) {
  const map = {
    construction: "建設・土木",
    consulting: "コンサル・調査",
    it: "IT・システム",
    goods: "物品調達",
    service: "役務・管理",
    other: "その他",
  };
  return map[cat] || cat || "その他";
}

function getCategoryIcon(cat) {
  const map = {
    construction: "🏗️",
    consulting: "📊",
    it: "💻",
    goods: "📦",
    service: "🔧",
    other: "📋",
  };
  return map[cat] || "📋";
}

function ResultCard({ item }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-gray-300 transition-all">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0">{getCategoryIcon(item.category)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-snug break-words">{item.title}</h3>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              {getCategoryLabel(item.category)}
            </span>
            {item.bidding_method && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                {item.bidding_method}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16 shrink-0">落札者</span>
              <span className="text-gray-900 font-bold truncate">{item.winner_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16 shrink-0">落札金額</span>
              <span className="text-blue-700 font-bold">{formatAmount(item.award_amount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16 shrink-0">発注機関</span>
              <span className="text-gray-600 truncate">
                {item.issuer_dept_hint ? (
                  <>
                    <span className="text-gray-900">{item.issuer_dept_hint}</span>
                    <span className="ml-1 text-[10px] text-gray-400" title="title 先頭の【...】から抽出（正式機関名ではなくヒント）">
                      ヒント
                    </span>
                  </>
                ) : (
                  <span className="font-mono">{item.issuer_code || item.issuer_name || "—"}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16 shrink-0">落札日</span>
              <span className="text-gray-600">{item.award_date || "—"}</span>
            </div>
          </div>

          {item.winner_corporate_number && (
            <p className="text-[10px] text-gray-300 mt-2">法人番号: {item.winner_corporate_number}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NyusatsuResultsPage() {
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
    winner: searchParams.get("winner") || "",
    issuer: searchParams.get("issuer") || "",
    year: searchParams.get("year") || "",
    award_date_from: searchParams.get("award_date_from") || "",
    award_date_to: searchParams.get("award_date_to") || "",
    sort: searchParams.get("sort") || "newest",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.category) params.set("category", f.category);
    if (f.winner) params.set("winner", f.winner);
    if (f.issuer) params.set("issuer", f.issuer);
    if (f.year) params.set("year", f.year);
    if (f.award_date_from) params.set("award_date_from", f.award_date_from);
    if (f.award_date_to) params.set("award_date_to", f.award_date_to);
    if (f.sort && f.sort !== "newest") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/nyusatsu/results${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      const statsParams = new URLSearchParams();
      const setBoth = (k, v) => { if (v) { listParams.set(k, v); statsParams.set(k, v); } };
      setBoth("keyword", filters.keyword);
      setBoth("category", filters.category);
      setBoth("winner", filters.winner);
      setBoth("issuer", filters.issuer);
      setBoth("year", filters.year);
      setBoth("award_date_from", filters.award_date_from);
      setBoth("award_date_to", filters.award_date_to);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/nyusatsu/results?${listParams}`),
        fetch(`/api/nyusatsu/results/stats?${statsParams}`),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch (err) {
      console.error("Failed to fetch results:", err);
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
    filters.keyword || filters.category || filters.winner ||
    filters.issuer || filters.year || filters.award_date_from || filters.award_date_to
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
      label: "案件名・落札者名",
      placeholder: "例: システム開発、〇〇建設",
    },
    {
      type: "select",
      name: "category",
      label: "案件種別",
      options: [
        { value: "construction", label: "建設・土木" },
        { value: "consulting", label: "コンサル・調査" },
        { value: "it", label: "IT・システム" },
        { value: "goods", label: "物品調達" },
        { value: "service", label: "役務・管理" },
        { value: "other", label: "その他" },
      ],
    },
    {
      type: "dateRange",
      name: ["award_date_from", "award_date_to"],
      label: "落札日（期間）",
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    { key: "category", label: "案件種別", resolve: getCategoryLabel },
    { key: "winner", label: "落札者" },
    { key: "issuer", label: "発注機関" },
    { key: "year", label: "年度" },
    { key: "award_date_from", label: "落札日From" },
    { key: "award_date_to", label: "落札日To" },
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
        <div className="flex items-center gap-3 mb-2">
          <Link href="/nyusatsu" className="text-sm text-blue-600 hover:underline">
            ← 入札公告に戻る
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">落札結果データベース</h1>
            <p className="text-sm text-gray-500">
              全省庁の落札実績を横断検索。落札者名・金額・調達方式を掲載。
              <span className="text-xs text-gray-400 ml-2">出典: 調達ポータル オープンデータ</span>
            </p>
          </div>
          <Link
            href="/nyusatsu/dashboard"
            className="shrink-0 inline-flex items-center gap-1 bg-[#2F9FD3] text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-[#3AABDC] transition-colors"
          >
            📊 落札者分析ダッシュボード
          </Link>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={(name, value) => setFormInput((p) => ({ ...p, [name]: value }))}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={SORT_OPTIONS}
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
                title: "年別落札件数",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year,
                  label: r.year,
                  count: r.count,
                })),
              },
              {
                title: "落札者 TOP10",
                type: "ranking",
                filterKey: "winner",
                rows: (stats.countsByWinner || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
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
            ]}
          />
        )}

        {stats && stats.avgAwardRate?.avg_rate > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-4">
            <div className="w-1 h-8 bg-purple-500 rounded-full" />
            <div>
              <p className="text-xs text-gray-400">平均落札率</p>
              <p className="text-xl font-bold text-purple-600">{stats.avgAwardRate.avg_rate.toFixed(1)}%</p>
            </div>
            <div className="ml-4">
              <p className="text-xs text-gray-400">対象件数</p>
              <p className="text-sm font-bold text-gray-700">{stats.avgAwardRate.count.toLocaleString()}件</p>
            </div>
          </div>
        )}

        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {total.toLocaleString()}件中 {startItem.toLocaleString()}-{endItem.toLocaleString()}件を表示
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
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する落札結果が見つかりません</p>
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
