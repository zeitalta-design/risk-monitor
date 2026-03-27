"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { saasConfig, getCategoryLabel, getCategoryIcon } from "@/lib/saas-config";

const PRESETS = [
  { id: "free", label: "無料で始められるSaaS", icon: "🆓", description: "無料プランまたはフリーミアムで始められるツール", params: "price_focus=free" },
  { id: "small-business", label: "中小企業向けおすすめ", icon: "🏢", description: "中小企業の導入に適した価格帯・機能", params: "company_size=small" },
  { id: "enterprise", label: "大企業・エンタープライズ向け", icon: "🏛️", description: "大規模組織に対応した機能・サポート", params: "company_size=enterprise&price_focus=feature" },
  { id: "low-cost", label: "低価格で導入しやすい", icon: "💰", description: "月額5,000円以下で始められるツール", params: "price_focus=low" },
  { id: "feature-rich", label: "多機能・高機能", icon: "⚡", description: "機能の充実度で選びたい方向け", params: "price_focus=feature" },
];

const CATEGORY_PRESETS = saasConfig.categories
  .filter(c => ["crm", "project", "accounting", "hr", "communication", "ma"].includes(c.slug))
  .map(c => ({
    id: `cat-${c.slug}`,
    label: `${c.label}おすすめ`,
    icon: c.icon,
    description: `${c.label}カテゴリの人気ツール`,
    params: `category=${c.slug}`,
  }));

export default function SaasRecommendIndex() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">SaaS おすすめ</h1>
      <p className="text-sm text-gray-500 mb-6">条件に合ったSaaS製品を見つけましょう</p>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">条件で探す</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESETS.map(p => (
            <Link key={p.id} href={`/saas/recommend/${p.id}`} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{p.icon}</span>
                <span className="text-sm font-bold text-gray-900">{p.label}</span>
              </div>
              <p className="text-xs text-gray-500">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">カテゴリ別おすすめ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORY_PRESETS.map(p => (
            <Link key={p.id} href={`/saas/recommend/${p.id}`} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{p.icon}</span>
                <span className="text-sm font-bold text-gray-900">{p.label}</span>
              </div>
              <p className="text-xs text-gray-500">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
