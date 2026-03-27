"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/constants";

const PREFECTURES = REGIONS.flatMap((r) => r.prefectures);
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

/**
 * おすすめチップ: 一休の「ゴルフにおすすめ ×」のように、
 * 検索枠の上にタグとして表示し、何を検索できるか一目でわかる
 */
const QUICK_CHIPS = [
  { key: "marathon",    label: "マラソン" },
  { key: "trail",       label: "トレイル" },
  { key: "cycling",     label: "自転車" },
  { key: "triathlon",   label: "トライアスロン" },
  { key: "walking",     label: "ウォーキング" },
];

const FILTER_SECTIONS = [
  {
    title: "競技ジャンル",
    key: "genre",
    items: [
      { key: "練習会", label: "練習会" },
      { key: "講習会", label: "講習会" },
      { key: "イベント", label: "イベント" },
    ],
  },
  {
    title: "レベル",
    key: "level",
    items: [
      { key: "初心者", label: "初心者向け" },
      { key: "中級", label: "中級者向け" },
      { key: "上級", label: "上級者向け" },
    ],
  },
  {
    title: "距離",
    key: "distance",
    items: [
      { key: "5", label: "5km" },
      { key: "10", label: "10km" },
      { key: "half", label: "ハーフ" },
      { key: "full", label: "フル" },
      { key: "ultra", label: "ウルトラ" },
    ],
  },
  {
    title: "ステータス",
    key: "status",
    items: [
      { key: "open", label: "受付中のみ" },
    ],
  },
];

export default function HomeSearchBar({ totalEvents = 0, standalone = false }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [month, setMonth] = useState("");
  const [selectedChips, setSelectedChips] = useState(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterChecks, setFilterChecks] = useState(new Set());

  const toggleChip = (key) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleFilter = (key) => {
    setFilterChecks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();

    const parts = [];
    if (keyword) parts.push(keyword);

    selectedChips.forEach((chip) => {
      const found = QUICK_CHIPS.find((c) => c.key === chip);
      if (found) parts.push(found.label);
    });

    filterChecks.forEach((key) => {
      const distItem = FILTER_SECTIONS.find((s) => s.key === "distance")?.items.find((i) => i.key === key);
      if (distItem) return;
      if (key === "open") return;
      parts.push(key);
    });

    if (parts.length > 0) params.set("keyword", parts.join(" "));
    if (prefecture) params.set("prefecture", prefecture);
    if (month) params.set("month", month);

    const distKeys = FILTER_SECTIONS.find((s) => s.key === "distance")?.items
      .filter((i) => filterChecks.has(i.key))
      .map((i) => i.key) || [];
    if (distKeys.length === 1) params.set("distance", distKeys[0]);

    // 検索実行ログ（fire-and-forget）
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: 0,
        action_type: "search_execute",
        source_page: "search_bar",
        metadata: {
          keyword: params.get("keyword") || null,
          prefecture: prefecture || null,
          month: month || null,
          distance: params.get("distance") || null,
          chips: [...selectedChips],
        },
      }),
    }).catch(() => {});
    router.push(`/marathon?${params.toString()}`);
  };

  const activeCount = selectedChips.size + filterChecks.size;

  return (
    <section className={standalone ? "relative z-10" : "relative -mt-14 sm:-mt-16 z-10 px-4"}>
      <div className={standalone ? "" : "max-w-5xl mx-auto"}>
        <div className={standalone
          ? "bg-white rounded-2xl border border-gray-200 p-6 sm:p-8"
          : "bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8"
        }>

          {/* ヘッダー行: 検索アイコン + タイトル + 件数 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">大会を探す</h2>
            </div>
            {totalEvents > 0 && (
              <span className="text-sm text-gray-600">
                <span className="font-bold text-blue-600 text-base">{totalEvents.toLocaleString()}</span>
                {" "}件掲載中
              </span>
            )}
          </div>

          <form onSubmit={handleSearch}>
            {/* メイン入力エリア: ラベル + アイコン付き */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {/* キーワード */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold mb-2 text-gray-800">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  キーワード
                </label>
                <input
                  type="text"
                  placeholder="東京マラソン、横浜…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             placeholder:text-gray-400 transition-shadow"
                  style={{ color: "#1a1a1a" }}
                />
              </div>

              {/* エリア */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold mb-2 text-gray-800">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  エリア
                </label>
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             bg-white transition-shadow"
                  style={{ color: prefecture ? "#1a1a1a" : "#9ca3af" }}
                >
                  <option value="">都道府県を選択</option>
                  {PREFECTURES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 開催月 */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold mb-2 text-gray-800">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  開催月
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-4 py-3 text-base rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             bg-white transition-shadow"
                  style={{ color: month ? "#1a1a1a" : "#9ca3af" }}
                >
                  <option value="">月を選択</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* クイックチップ + 絞り込み */}
            <div className="flex items-center gap-2.5 mb-5 flex-wrap">
              {QUICK_CHIPS.map((chip) => {
                const active = selectedChips.has(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => toggleChip(chip.key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                    style={active ? undefined : { color: "#1a1a1a" }}
                    aria-pressed={active}
                  >
                    {active && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {chip.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                  filterOpen || filterChecks.size > 0
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                }`}
                style={filterOpen || filterChecks.size > 0 ? undefined : { color: "#1a1a1a" }}
                aria-expanded={filterOpen}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                絞り込み
                {filterChecks.size > 0 && (
                  <span className="ml-0.5 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full">
                    {filterChecks.size}
                  </span>
                )}
              </button>
            </div>

            {/* 絞り込みパネル */}
            {filterOpen && (
              <div className="mb-5 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                  {FILTER_SECTIONS.map((section) => (
                    <div key={section.key}>
                      <p className="text-xs font-bold mb-2.5 text-gray-700">
                        {section.title}
                      </p>
                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const checked = filterChecks.has(item.key);
                          return (
                            <label
                              key={item.key}
                              className="flex items-center gap-2.5 cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFilter(item.key)}
                                className="w-4.5 h-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500/40"
                              />
                              <span
                                className="text-sm group-hover:text-blue-600 transition-colors"
                                style={{ color: "#1a1a1a" }}
                              >
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {filterChecks.size > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFilterChecks(new Set())}
                      className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                    >
                      条件をクリア
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 検索ボタン */}
            <button
              type="submit"
              className="w-full py-3 text-white font-semibold rounded-lg
                         transition-all duration-200 text-[15px] tracking-wide"
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
              大会を検索する
              {activeCount > 0 && (
                <span className="ml-2 text-blue-100/80">({activeCount}件の条件)</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
