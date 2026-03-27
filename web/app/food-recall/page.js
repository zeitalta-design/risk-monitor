"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DomainListPage from "@/components/core/DomainListPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  foodRecallConfig,
  getCategoryLabel,
  getCategoryIcon,
  getRiskLevel,
  getReasonLabel,
  getStatusBadge,
  formatRecallDate,
  getDaysSinceRecall,
} from "@/lib/food-recall-config";

const foodRecallDomain = getDomain("food-recall");

function RiskBadge({ level }) {
  const r = getRiskLevel(level);
  return <span className={`badge ${r.color}`}>{r.label}</span>;
}

function CardBadges({ item }) {
  const sb = getStatusBadge(item.status);
  const days = getDaysSinceRecall(item.recall_date);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <RiskBadge level={item.risk_level} />
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
      {item.reason && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{getReasonLabel(item.reason)}</span>
      )}
      {days && (
        <span className={`text-xs ${days.recent ? "text-red-600 font-bold" : "text-gray-500"}`}>
          {days.text}
        </span>
      )}
    </div>
  );
}

function FoodRecallCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/food-recall/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getCategoryIcon(item.category)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/food-recall/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.product_name}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {foodRecallDomain && <DomainFavoriteButton itemId={item.id} domain={foodRecallDomain} />}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.manufacturer || "—"}</p>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
        <CardBadges item={item} />
      </div>
    </div>
  );
}

export default function FoodRecallListPage() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
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
      if (riskLevel) params.set("risk_level", riskLevel);
      if (reason) params.set("reason", reason);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      const res = await fetch(`/api/food-recall?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch food-recall items:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, category, riskLevel, reason, status, sort, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function resetFilters() {
    setKeyword(""); setCategory(""); setRiskLevel("");
    setReason(""); setStatus(""); setSort("newest"); setPage(1);
  }

  return (
    <DomainListPage
      title="食品リコール監視"
      subtitle={loading ? "読み込み中..." : `${total}件のリコール情報`}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      renderItem={(item) => <FoodRecallCard key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="商品名・製造者で検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのカテゴリ</option>
              {foodRecallConfig.categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
              ))}
            </select>

            <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのリスクレベル</option>
              {foodRecallConfig.riskLevels.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての原因</option>
              {foodRecallConfig.reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのステータス</option>
              {foodRecallConfig.statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">並び順:</span>
            {foodRecallConfig.sorts.map((s) => (
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

          {(keyword || category || riskLevel || reason || status) && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-blue-600">
              条件をリセット
            </button>
          )}
        </div>
      )}
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致するリコール情報が見つかりません</p>
          <button onClick={resetFilters} className="btn-secondary mt-4">フィルタをリセット</button>
        </div>
      }
      footerSlot={
        <div className="mt-10 pt-8 border-t border-gray-100 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">食品カテゴリから探す</h2>
            <div className="flex flex-wrap gap-2">
              {foodRecallConfig.categories.map((c) => (
                <Link key={c.slug} href={`/food-recall/category/${c.slug}`} className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                  {c.icon} {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
