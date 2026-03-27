"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

function CardBadges({ item }) {
  const risk = getRiskLevel(item.risk_level);
  const sb = getStatusBadge(item.status);
  const days = getDaysSinceRecall(item.recall_date);
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className={`badge ${risk.color}`}>{risk.label}</span>
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      {item.reason && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{getReasonLabel(item.reason)}</span>}
      {days && <span className={`text-xs ${days.recent ? "text-red-600 font-bold" : "text-gray-500"}`}>{days.text}</span>}
    </div>
  );
}

export default function FoodRecallCategoryPage() {
  const { category } = useParams();
  const catConfig = foodRecallConfig.categories.find((c) => c.slug === category);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/food-recall?category=${category}`);
      const data = await res.json();
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const catLabel = catConfig?.label || category;
  const catIcon = catConfig?.icon || "📦";

  return (
    <DomainListPage
      title={`${catIcon} ${catLabel}のリコール情報`}
      subtitle={loading ? "読み込み中..." : `${total}件`}
      items={items} loading={loading} page={1} totalPages={1} onPageChange={() => {}}
      renderItem={(item) => (
        <div key={item.id} className="card p-4 hover:shadow-md transition-shadow flex gap-4">
          <Link href={`/food-recall/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">{catIcon}</Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/food-recall/${item.slug}`} className="block min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.product_name}</h3>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {foodRecallDomain && <DomainFavoriteButton itemId={item.id} domain={foodRecallDomain} />}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{item.manufacturer}</p>
            <CardBadges item={item} />
          </div>
        </div>
      )}
      footerSlot={
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">食品カテゴリから探す</h2>
          <div className="flex flex-wrap gap-2">
            {foodRecallConfig.categories.map((c) => (
              <Link key={c.slug} href={`/food-recall/category/${c.slug}`} className={`inline-block px-3 py-1.5 text-xs border rounded-full transition-all ${c.slug === category ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"}`}>
              {c.icon} {c.label}
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/food-recall" className="text-xs text-blue-600 hover:underline">← すべてのリコール情報を見る</Link>
          </div>
        </div>
      }
    />
  );
}
