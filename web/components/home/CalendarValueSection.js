"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * トップページ用: カレンダー管理の価値訴求セクション
 *
 * 既存トップの世界観に溶け込みつつ、
 * 「Risk Monitorは検索だけでなく、未来と過去を管理できる」ことを
 * ミニカレンダーUIで視覚的に伝える。
 */

// ─── ダミーデータ（将来はAPIから取得） ───
const FUTURE_EVENTS = [
  { day: 12, label: "東京マラソン", tag: "エントリー済", color: "blue" },
  { day: 19, label: "横浜トレイル", tag: "検討中", color: "green" },
  { day: 26, label: "大阪ハーフ", tag: "気になる", color: "amber" },
];

const PAST_EVENTS = [
  { month: "2月", label: "湘南マラソン", result: "4:12:35", tag: "完走" },
  { month: "1月", label: "新春10Kラン", result: "48:22", tag: "自己ベスト" },
  { month: "12月", label: "年忘れ駅伝", result: "チーム3位", tag: "入賞" },
];

export default function CalendarValueSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 今月の情報
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const monthLabel = `${year}年${month + 1}月`;

  // カレンダーグリッド生成
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDow; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // イベントがある日のマップ
  const eventDayMap = {};
  FUTURE_EVENTS.forEach((e) => {
    eventDayMap[e.day] = e.color;
  });

  if (!mounted) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      {/* セクション見出し — 既存パターン踏襲 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-7 bg-blue-600 rounded-full" />
        <div>
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#1a1a1a" }}>
            あなたの大会カレンダー
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            これからの予定も、走った記録も、ひとつに
          </p>
        </div>
      </div>

      {/* メインコンテンツ: 2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── 左: 未来の予定（ミニカレンダー + 予定リスト） ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"
             style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">これからの大会</h3>
              <span className="text-[11px] text-gray-400 font-medium">{monthLabel}</span>
            </div>

            {/* ミニカレンダー */}
            <div className="mb-4">
              <div className="grid grid-cols-7 gap-0 mb-1">
                {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                  <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0">
                {calendarDays.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="h-8" />;
                  }
                  const isToday = day === today;
                  const eventColor = eventDayMap[day];
                  return (
                    <div
                      key={day}
                      className={`h-8 flex flex-col items-center justify-center relative ${
                        isToday ? "font-bold" : ""
                      }`}
                    >
                      <span
                        className={`text-xs leading-none ${
                          isToday
                            ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                            : day < today
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}
                      >
                        {day}
                      </span>
                      {eventColor && (
                        <span
                          className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                            eventColor === "blue"
                              ? "bg-blue-500"
                              : eventColor === "green"
                              ? "bg-green-500"
                              : "bg-amber-500"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 予定リスト */}
            <div className="space-y-2">
              {FUTURE_EVENTS.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-t border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-400 tabular-nums w-6 text-right shrink-0">
                      {e.day}日
                    </span>
                    <span className="text-sm text-gray-800 truncate">{e.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      e.tag === "エントリー済"
                        ? "bg-blue-50 text-blue-700"
                        : e.tag === "検討中"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {e.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/calendar"
            className="block text-center py-3 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 transition-colors border-t border-gray-100"
          >
            カレンダーを見る →
          </Link>
        </div>

        {/* ── 右: 過去の記録 ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"
             style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">これまでの大会</h3>
              <span className="text-[11px] text-gray-400 font-medium">直近の記録</span>
            </div>

            {/* 過去の大会カード */}
            <div className="space-y-3">
              {PAST_EVENTS.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-lg bg-gray-50/70"
                >
                  {/* 月ラベル */}
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-gray-400 font-medium leading-none">{e.month.slice(0, -1)}</span>
                    <span className="text-[9px] text-gray-300">月</span>
                  </div>

                  {/* 大会情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{e.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.result}
                    </p>
                  </div>

                  {/* タグ */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      e.tag === "自己ベスト"
                        ? "bg-amber-50 text-amber-700"
                        : e.tag === "入賞"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {e.tag}
                  </span>
                </div>
              ))}
            </div>

            {/* サマリー */}
            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-extrabold text-gray-900 tabular-nums">12</p>
                <p className="text-[10px] text-gray-400">参加大会</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-blue-600 tabular-nums">3</p>
                <p className="text-[10px] text-gray-400">自己ベスト</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-green-600 tabular-nums">100%</p>
                <p className="text-[10px] text-gray-400">完走率</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/runner"
            className="block text-center py-3 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 transition-colors border-t border-gray-100"
          >
            マイ大会を見る →
          </Link>
        </div>
      </div>

      {/* 下部コピー — 控えめな価値訴求 */}
      <p className="text-center text-xs text-gray-400 mt-6">
        大会を探して、予定を立てて、記録を残す。Risk Monitorならすべてがひとつに。
      </p>
    </section>
  );
}
