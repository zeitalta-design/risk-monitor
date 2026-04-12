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
  hojokinConfig,
  getCategoryLabel,
  getCategoryIcon,
  getTargetLabel,
  getStatusLabel,
  getStatusColor,
  formatAmount,
  formatDeadline,
} from "@/lib/hojokin-config";

const hojokinDomain = getDomain("hojokin");

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
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
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
      params.set("page", String(page));
      const res = await fetch(`/api/hojokin?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch hojokin items:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, category, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <DomainListPage
      headerSlot={<CategoryPageHeader categoryId="hojokin" />}
      title="補助金ナビ"
      subtitle={loading ? "読み込み中..." : `${total}件の制度`}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      renderItem={(item) => <HojokinCard key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder="制度名・キーワードで検索..." className="flex-1 border rounded-lg px-4 py-2.5 text-sm" />
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2.5 text-sm">
              <option value="">すべてのカテゴリ</option>
              {hojokinConfig.categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致する制度が見つかりません</p>
          <button onClick={() => { setKeyword(""); setCategory(""); setPage(1); }} className="btn-secondary mt-4">フィルタをリセット</button>
        </div>
      }
      bottomBar={<DomainCompareBar domainId="hojokin" comparePath="/hojokin/compare" label="制度" />}
    />
  );
}
