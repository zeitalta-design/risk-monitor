"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * Phase226: 初回ユーザー導線強化
 *
 * 初回訪問時に主要機能を案内するカード。
 * localStorageで表示済みフラグを管理。
 */

const GUIDE_ITEMS = [
  {
    icon: "🔍",
    title: "大会を探す",
    description: "日程・地域・距離で全国のマラソン大会を検索",
    href: "/marathon",
    cta: "検索する",
  },
  {
    icon: "📅",
    title: "カレンダーで確認",
    description: "月別に大会開催スケジュールを一覧表示",
    href: "/calendar",
    cta: "見る",
  },
  {
    icon: "⭐",
    title: "気になる大会を保存",
    description: "お気に入り・比較・保存で大会を管理",
    href: "/benefits",
    cta: "詳しく",
  },
];

const STORAGE_KEY = "sportlog_guide_dismissed";

export default function FirstVisitGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setShow(true);
      }
    } catch {}
  }, []);

  function handleDismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  if (!show) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="card p-5 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-sm"
          aria-label="閉じる"
        >
          ✕
        </button>
        <h2 className="text-base font-bold text-gray-900 mb-1">
          Risk Monitorへようこそ
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          全国のスポーツ大会を探せるサービスです。まずはこちらからどうぞ。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {GUIDE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleDismiss}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
            >
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
