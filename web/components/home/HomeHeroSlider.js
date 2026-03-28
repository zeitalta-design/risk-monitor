"use client";
import { useEffect } from "react";
import { REGIONS } from "@/lib/constants";

const PREFECTURES = REGIONS.flatMap((r) => r.prefectures);
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

const QUICK_CHIPS = [
  { key: "marathon", label: "マラソン", icon: "🏃" },
  { key: "trail", label: "トレイルラン", icon: "⛰️" },
  { key: "cycling", label: "サイクリング", icon: "🚴" },
  { key: "triathlon", label: "トライアスロン", icon: "🏅" },
  { key: "walking", label: "ウォーキング", icon: "🚶" },
  { key: "golf", label: "ゴルフ", icon: "⛳" },
  { key: "swimming", label: "水泳", icon: "🏊" },
  { key: "squash", label: "スカッシュ", icon: "🎾" },
  { key: "workshop", label: "練習会・講習会", icon: "📋" },
];


// ヒーロー画像: /public/hero/top-hero.jpg（ローカル固定・外部URL非依存）
const HERO_IMAGE = "/hero/top-hero.jpg";

/**
 * 統合ヒーロー: 実写背景 + 検索フォーム + 特集スライダー
 *
 * 検索フォームは uncontrolled（defaultValue）
 * DOM .value を直接読む。React state / hydration に一切依存しない。
 */
export default function HomeHeroSlider({ totalEvents = 0 }) {
  // 検索ボタン — DOM addEventListener
  useEffect(() => {
    const btn = document.querySelector("[data-hero-search-btn]");
    if (!btn) return;

    function doSearch() {
      const container = document.querySelector("[data-hero-search-form]");
      if (!container) return;

      const kw = container.querySelector('input[name="keyword"]')?.value?.trim() || "";
      const pref = container.querySelector('select[name="prefecture"]')?.value || "";
      const mo = container.querySelector('select[name="month"]')?.value || "";

      const params = new URLSearchParams();
      if (kw) params.set("keyword", kw);
      if (pref) params.set("prefecture", pref);
      if (mo) params.set("month", mo);

      try {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: 0,
            action_type: "search_execute",
            source_page: "top_hero",
            metadata: { keyword: kw || null, prefecture: pref || null, month: mo || null },
          }),
        }).catch(() => {});
      } catch {}

      const qs = params.toString();
      window.location.href = `/marathon${qs ? "?" + qs : ""}`;
    }

    btn.addEventListener("click", doSearch);
    return () => btn.removeEventListener("click", doSearch);
  }, []);

  return (
      <section className="relative overflow-hidden">
        {/* 背景画像: 朝の自然光・前進するランナー */}
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 45%", filter: "brightness(1.25)" }}
            loading="eager"
            fetchPriority="high"
          />
          {/* オーバーレイ: 上部やや濃く（見出し可読性）、下部やや薄く（爽やかさ維持） */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.22) 50%, rgba(0,0,0,0.35) 100%)" }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          {/* メインコピー — text-shadow付き */}
          <div className="text-center mb-7 sm:mb-9">
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
            >
              全国のスポーツ大会を
              <br className="sm:hidden" />
              かんたん検索
            </h1>
            <p
              className="mt-2 sm:mt-3 text-sm sm:text-base text-white/90 font-medium"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              マラソン・トレイルラン・自転車など
              {totalEvents > 0 && (
                <span className="inline-flex items-center ml-2">
                  —{" "}
                  <span className="font-extrabold text-white ml-1 text-xl sm:text-2xl" style={{ lineHeight: 1 }}>
                    {totalEvents.toLocaleString()}
                  </span>
                  <span className="ml-0.5">件掲載中</span>
                </span>
              )}
            </p>
          </div>

          {/* 検索フォーム — 白背景・影強化 */}
          <div
            data-hero-search-form
            className="bg-white rounded-2xl p-4 sm:p-6 max-w-3xl mx-auto"
            style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                name="keyword"
                defaultValue=""
                placeholder="大会名・キーワード"
                className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                           placeholder:text-gray-400 sm:col-span-2"
                style={{ color: "#1a1a1a" }}
              />
              <select
                name="prefecture"
                defaultValue=""
                className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                           bg-white text-gray-900"
              >
                <option value="" className="text-gray-400">エリア</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                name="month"
                defaultValue=""
                className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                           bg-white text-gray-900"
              >
                <option value="" className="text-gray-400">開催月</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <button
              data-hero-search-btn
              type="button"
              className="group w-full mt-3.5 py-[11px] text-white font-semibold rounded-lg
                         transition-all duration-200 text-[15px] tracking-wide
                         flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(to bottom, #4874b8, #3a63a3)",
                boxShadow: "0 1px 3px rgba(58,99,163,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #5282c4, #4270b0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(58,99,163,0.3), inset 0 1px 0 rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #4874b8, #3a63a3)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(58,99,163,0.25), inset 0 1px 0 rgba(255,255,255,0.1)";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #3d6399, #345894)";
                e.currentTarget.style.boxShadow = "0 0 2px rgba(58,99,163,0.2), inset 0 1px 2px rgba(0,0,0,0.1)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #5282c4, #4270b0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(58,99,163,0.3), inset 0 1px 0 rgba(255,255,255,0.12)";
              }}
            >
              <svg className="w-[17px] h-[17px] opacity-90" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              あなたに合う大会を探す
            </button>
          </div>

          {/* ジャンルチップ */}
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  window.location.href = chip.key === "marathon" ? "/marathon" : `/${chip.key}`;
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full
                           bg-white/20 text-white border border-white/30
                           hover:bg-white/30 transition-all backdrop-blur-sm"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
              >
                <span className="text-base">{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>
  );
}
