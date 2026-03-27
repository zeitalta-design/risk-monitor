"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

export default function GyoseiShobunListPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    keyword: "",
    action_type: "",
    prefecture: "",
    industry: "",
    sort: "newest",
    page: 1,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.action_type) params.set("action_type", filters.action_type);
      if (filters.prefecture) params.set("prefecture", filters.prefecture);
      if (filters.industry) params.set("industry", filters.industry);
      params.set("sort", filters.sort);
      params.set("page", String(filters.page));

      const res = await fetch(`/api/gyosei-shobun?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
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

        {/* フィルタ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => updateFilter("keyword", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              placeholder="事業者名・キーワードで検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
            <button
              onClick={fetchData}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
            >
              検索
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.action_type}
              onChange={(e) => updateFilter("action_type", e.target.value)}
              className="text-xs border rounded-lg px-3 py-1.5"
            >
              <option value="">処分種別</option>
              {gyoseiShobunConfig.actionTypes.map((t) => (
                <option key={t.slug} value={t.slug}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={filters.industry}
              onChange={(e) => updateFilter("industry", e.target.value)}
              className="text-xs border rounded-lg px-3 py-1.5"
            >
              <option value="">業種</option>
              {gyoseiShobunConfig.industries.map((i) => (
                <option key={i.slug} value={i.slug}>{i.icon} {i.label}</option>
              ))}
            </select>
            <select
              value={filters.sort}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="text-xs border rounded-lg px-3 py-1.5"
            >
              {gyoseiShobunConfig.sorts.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 件数 */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-4">{total}件の行政処分</p>
        )}

        {/* ローディング */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 一覧 */}
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
                  className="bg-white rounded-xl border border-gray-200 p-4 block hover:shadow-md hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{actionIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{item.organization_name_raw}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${tc.bg} ${tc.text} ${tc.border}`}>
                          {actionLabel}
                        </span>
                        {industryLabel && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {industryLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">{item.summary}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {item.action_date && <span>{item.action_date}</span>}
                        {item.authority_name && <span>{item.authority_name}</span>}
                        {item.prefecture && <span>{item.prefecture}</span>}
                      </div>
                    </div>
                  </div>
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
      </div>
    </div>
  );
}
