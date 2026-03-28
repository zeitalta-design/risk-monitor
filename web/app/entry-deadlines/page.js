"use client";

/**
 * Phase71: 締切カレンダーページ
 *
 * /entry-deadlines
 *
 * 「今申し込むべき大会」をすぐ判断できるページ。
 * 本日締切 / 3日以内 / 7日以内 / 今月中 / 定員間近 / 定員到達 / 募集終了 / 要確認
 * の各グループでイベントを表示。
 */

import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeadlineGroup from "@/components/entry-deadlines/DeadlineGroup";
import DeadlineStats from "@/components/entry-deadlines/DeadlineStats";

const GROUP_ORDER = [
  "today",
  "in3days",
  "in7days",
  "capacity_warning",
  "thisMonth",
  "full",
  "closed",
  "unknown",
];

export default function EntryDeadlinesPage() {
  const [groups, setGroups] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/entry-deadlines");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setGroups(data.groups || {});
        setStats(data.stats || {});
      } catch (err) {
        console.error("Entry deadlines load error:", err);
        setGroups({});
        setStats({});
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "締切・募集状況" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          📋 締切・募集状況
        </h1>
        <p className="text-sm text-gray-500">
          今申し込める大会を募集状態ごとに確認できます
        </p>
      </div>

      {/* 統計 */}
      {stats && !loading && (
        <div className="mb-6">
          <DeadlineStats stats={stats} />
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && !loading && (
        <div className="text-center py-8 bg-red-50 rounded-xl mb-4">
          <p className="text-sm text-red-600 mb-1">データの読み込みに失敗しました</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-blue-600 hover:underline"
          >
            再読み込み
          </button>
        </div>
      )}

      {/* グループ一覧 */}
      {!loading && groups && (
        <div className="space-y-4">
          {GROUP_ORDER.map((key) => {
            const events = groups[key] || [];
            return (
              <DeadlineGroup
                key={key}
                groupKey={key}
                events={events}
              />
            );
          })}

          {/* 全グループ空の場合 */}
          {GROUP_ORDER.every((key) => (groups[key] || []).length === 0) && (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-lg mb-2">📭</p>
              <p className="text-sm font-medium text-gray-600 mb-1">
                現在、締切間近の大会はありません
              </p>
              <p className="text-xs text-gray-400 mb-4">
                別の人気大会や新着大会もご覧ください
              </p>
              <div className="flex justify-center gap-3">
                <a href="/popular" className="text-xs text-blue-600 hover:underline">
                  🏆 人気大会を見る
                </a>
                <a href="/search" className="text-xs text-blue-600 hover:underline">
                  🔍 大会を探す
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 注意書き */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-400 leading-relaxed">
          ※ 募集状態は定期的に確認していますが、最新の状況とは異なる場合があります。
          正確な受付状況は各大会の公式サイトやエントリーサイトでご確認ください。
          「信頼度」マークは🟢（高）🟡（中）🟠（低）⚪（未確認）を表しています。
        </p>
      </div>
    </div>
  );
}
