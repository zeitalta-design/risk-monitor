"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCategoryLabel, getCategoryIcon } from "@/lib/saas-config";

const PRESET_CONFIG = {
  "free": { label: "無料で始められるSaaS", conditions: { priceFocus: "free" }, category: "" },
  "small-business": { label: "中小企業向けおすすめSaaS", conditions: { companySize: "small" }, category: "" },
  "enterprise": { label: "大企業・エンタープライズ向けSaaS", conditions: { companySize: "enterprise", priceFocus: "feature" }, category: "" },
  "low-cost": { label: "低価格で導入しやすいSaaS", conditions: { priceFocus: "low" }, category: "" },
  "feature-rich": { label: "多機能・高機能SaaS", conditions: { priceFocus: "feature" }, category: "" },
  "cat-crm": { label: "CRM・SFA おすすめ", conditions: {}, category: "crm" },
  "cat-project": { label: "プロジェクト管理 おすすめ", conditions: {}, category: "project" },
  "cat-accounting": { label: "会計・経理 おすすめ", conditions: {}, category: "accounting" },
  "cat-hr": { label: "人事・労務 おすすめ", conditions: {}, category: "hr" },
  "cat-communication": { label: "コミュニケーション おすすめ", conditions: {}, category: "communication" },
  "cat-ma": { label: "MA・マーケ おすすめ", conditions: {}, category: "ma" },
};

export default function SaasRecommendPresetPage() {
  const { preset } = useParams();
  const config = PRESET_CONFIG[preset];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) { setLoading(false); return; }
    const params = new URLSearchParams();
    if (config.category) params.set("category", config.category);
    if (config.conditions.companySize) params.set("company_size", config.conditions.companySize);
    if (config.conditions.priceFocus) params.set("price_focus", config.conditions.priceFocus);
    params.set("limit", "15");

    fetch(`/api/saas-recommend?${params}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [preset]);

  if (!config) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 mb-4">おすすめプリセットが見つかりません</p>
        <Link href="/saas/recommend" className="btn-primary inline-block">おすすめ一覧へ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/saas" className="hover:text-blue-600">SaaSナビ</Link>
        <span className="mx-1">/</span>
        <Link href="/saas/recommend" className="hover:text-blue-600">おすすめ</Link>
        <span className="mx-1">/</span>
        <span>{config.label}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.label}</h1>
      <p className="text-sm text-gray-500 mb-6">条件に合ったSaaS製品をスコア順に表示しています</p>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card p-6 animate-pulse"><div className="h-16 bg-gray-100 rounded" /></div>)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">この条件に合うSaaSが見つかりません</p>
          <Link href="/saas/recommend" className="btn-secondary">他の条件で探す</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const ext = (() => { try { return JSON.parse(item.extension_json || "{}"); } catch { return {}; } })();
            return (
              <div key={item.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg font-bold text-blue-600 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/saas/${item.slug}`} className="block min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 hover:text-blue-600">{item.title}</h3>
                      </Link>
                      <Link href={`/saas/compare?ids=${item.id}`} className="text-xs px-2 py-1 border rounded hover:bg-blue-50 shrink-0">
                        比較
                      </Link>
                    </div>
                    <p className="text-xs text-gray-500">{item.provider_name || "—"}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.summary}</p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
                      {item.price_display && <span className="text-xs text-gray-600">{item.price_display}</span>}
                      {ext.free_plan && <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">無料プラン</span>}
                      {ext.trial && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">トライアル</span>}
                    </div>

                    {item._reasons && item._reasons.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1">💡 {item._reasons.join(" / ")}</p>
                    )}

                    {ext.strengths && (
                      <p className="text-xs text-gray-500 mt-1">✅ {ext.strengths}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Link href="/saas/recommend" className="btn-secondary text-sm">← 他の条件で探す</Link>
        <Link href="/saas" className="btn-secondary text-sm">SaaS一覧へ</Link>
      </div>
    </div>
  );
}
