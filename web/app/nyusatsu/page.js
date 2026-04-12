"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DomainListPage from "@/components/core/DomainListPage";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
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
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [biddingMethod, setBiddingMethod] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [deadlineWithin, setDeadlineWithin] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("deadline");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (category) params.set("category", category);
      if (area) params.set("area", area);
      if (biddingMethod) params.set("bidding_method", biddingMethod);
      if (budgetRange) params.set("budget_range", budgetRange);
      if (deadlineWithin) params.set("deadline_within", deadlineWithin);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      const res = await fetch(`/api/nyusatsu?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch nyusatsu items:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, category, area, biddingMethod, budgetRange, deadlineWithin, status, sort, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function resetFilters() {
    setKeyword(""); setCategory(""); setArea(""); setBiddingMethod("");
    setBudgetRange(""); setDeadlineWithin(""); setStatus(""); setSort("deadline"); setPage(1);
  }

  return (
    <DomainListPage
      headerSlot={<CategoryPageHeader categoryId="nyusatsu" />}
      title="入札ナビ"
      subtitle={loading ? "読み込み中..." : `${total}件の案件`}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      renderItem={(item) => <NyusatsuCard key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4 space-y-3">
          {/* キーワード検索 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="案件名・発注機関で検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          {/* フィルタ行1: カテゴリ + 地域 + 入札方式 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのカテゴリ</option>
              {nyusatsuConfig.categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
              ))}
            </select>

            <select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての地域</option>
              {nyusatsuConfig.areas.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            <select value={biddingMethod} onChange={(e) => { setBiddingMethod(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての入札方式</option>
              {nyusatsuConfig.biddingMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* フィルタ行2: 予算帯 + 締切 + ステータス */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={budgetRange} onChange={(e) => { setBudgetRange(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての予算帯</option>
              {nyusatsuConfig.budgetRanges.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select value={deadlineWithin} onChange={(e) => { setDeadlineWithin(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての締切</option>
              {nyusatsuConfig.deadlineOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのステータス</option>
              {nyusatsuConfig.statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* ソート */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">並び順:</span>
            {nyusatsuConfig.sorts.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSort(s.key); setPage(1); }}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  sort === s.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* リセット */}
          {(keyword || category || area || biddingMethod || budgetRange || deadlineWithin || status) && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-blue-600">
              条件をリセット
            </button>
          )}
        </div>
      )}
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致する案件が見つかりません</p>
          <button onClick={resetFilters} className="btn-secondary mt-4">フィルタをリセット</button>
        </div>
      }
      footerSlot={
        <div className="mt-10 pt-8 border-t border-gray-100 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">カテゴリから探す</h2>
            <div className="flex flex-wrap gap-2">
              {nyusatsuConfig.categories.map((c) => (
                <Link key={c.slug} href={`/nyusatsu/category/${c.slug}`} className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                  {c.icon} {c.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">地域から探す</h2>
            <div className="flex flex-wrap gap-2">
              {nyusatsuConfig.areas.map((a) => (
                <Link key={a.value} href={`/nyusatsu/area/${encodeURIComponent(a.value)}`} className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      }
      bottomBar={<DomainCompareBar domainId="nyusatsu" comparePath="/nyusatsu/compare" label="案件" />}
    />
  );
}
