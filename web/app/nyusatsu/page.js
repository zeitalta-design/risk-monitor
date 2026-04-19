"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainResultCard from "@/components/core/DomainResultCard";
import StatsDashboard from "@/components/StatsDashboard";
import TopDealsSection from "@/components/TopDealsSection";
import SaveDealButton from "@/components/SaveDealButton";
import EntityPicker from "@/components/EntityPicker";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { useDomainSearchPage } from "@/lib/core/useDomainSearchPage";
import {
  nyusatsuConfig,
  getCategoryLabel,
  getCategoryIcon,
  formatBudget,
  formatDeadline,
  getBiddingMethodLabel,
  getStatusBadge,
  getDeadlineRemaining,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");
const PAGE_SIZE = 20;

// Phase J-2/J-3: 有望案件セクションの fallback entity（URL / localStorage なし時）
const FEATURED_ENTITY_ID = 16542;

const FILTER_KEYS = [
  "keyword",
  "category",
  "area",
  "bidding_method",
  "budget_range",
  "deadline_within",
  "status",
  "issuer",
  "year",
  "deadline_from",
  "deadline_to",
];

const INITIAL_FILTERS = {
  keyword: "",
  category: "",
  area: "",
  bidding_method: "",
  budget_range: "",
  deadline_within: "",
  status: "",
  issuer: "",
  year: "",
  deadline_from: "",
  deadline_to: "",
  sort: "deadline",
  page: 1,
};

// Phase J-5: Deal Score badge の tone（Deal Score 既存 UI と同一）
function dealScoreTone(s) {
  if (s >= 80) return { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" };
  if (s >= 60) return { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" };
  if (s >= 40) return { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" };
  return            { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };
}

function NyusatsuBadges({ item, score, initialSaved }) {
  const sb = getStatusBadge(item.status);
  const dr = getDeadlineRemaining(item.deadline);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {/* Phase J-14: 保存（ピン留め）ボタン。slug がある item のみ */}
      {item.slug && (
        <SaveDealButton dealSlug={item.slug} initialSaved={initialSaved} compact />
      )}
      {score && (() => {
        const t = dealScoreTone(score.score);
        // Phase J-13: 「有望な理由」を tooltip の末尾に添える。1 行の根拠のみ。
        const tip = score.topReason
          ? `Deal Score: ${score.score} / 100\n${score.topReason}`
          : `Deal Score: ${score.score} / 100`;
        return (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border"
            style={{ color: t.fg, backgroundColor: t.bg, borderColor: t.border }}
            title={tip}
          >
            <span className="tabular-nums font-bold">{score.score}</span>
            <span>{score.label}</span>
          </span>
        );
      })()}
      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      {item.bidding_method && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
          {getBiddingMethodLabel(item.bidding_method)}
        </span>
      )}
      <span className="text-xs text-gray-600">{formatBudget(item.budget_amount)}</span>
      {dr ? (
        dr.expired ? (
          <span className="text-xs text-gray-400 line-through">締切: {formatDeadline(item.deadline)}</span>
        ) : (
          <span className={`text-xs ${dr.urgent ? "text-red-600 font-bold" : "text-gray-500"}`}>
            {dr.text}（{formatDeadline(item.deadline)}）
          </span>
        )
      ) : (
        <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
      )}
    </div>
  );
}

export default function NyusatsuListPage() {
  // J-3: 有望案件セクション用の entity 選択状態。
  //   初期値は fallback だが、EntityPicker mount 時に URL / localStorage から解決し直す。
  const [selectedEntityId, setSelectedEntityId] = useState(FEATURED_ENTITY_ID);

  // J-5: visible items 分の score map。未 fetch は null、fetch 済みは Map<id, {score,label}>
  const [scoreMap, setScoreMap] = useState(null);

  // Phase J-14: 保存済み slug の Set。ログイン中のみ取得、未ログインは空集合のまま。
  const [savedSlugSet, setSavedSlugSet] = useState(() => new Set());
  useEffect(() => {
    let cancelled = false;
    fetch("/api/deals/saved?mode=set")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setSavedSlugSet(new Set(d.slugs || []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const {
    items,
    total,
    totalPages,
    stats,
    loading,
    filters,
    formInput,
    hasFilters,
    startItem,
    endItem,
    handleSearch,
    handleReset,
    goToPage,
    onChipRemove,
    onStatsToggle,
    onSortChange,
    onFormFieldChange,
  } = useDomainSearchPage({
    basePath: "/nyusatsu",
    listApiPath: "/api/nyusatsu",
    statsApiPath: "/api/nyusatsu/stats",
    filterKeys: FILTER_KEYS,
    initialFilters: INITIAL_FILTERS,
    pageSize: PAGE_SIZE,
  });

  // J-5: visible items の score を 1 回だけまとめて取得して Map 化。
  //   entityId × ids が同じ組み合わせなら再 fetch しない（dedupe key で比較）。
  const idsKey = useMemo(() => items.map((x) => x.id).sort((a,b)=>a-b).join(","), [items]);
  useEffect(() => {
    if (!selectedEntityId || !idsKey) { setScoreMap(null); return; }
    const ids = idsKey.split(",").slice(0, 50);
    if (ids.length === 0) { setScoreMap(null); return; }
    let cancelled = false;
    const qs = new URLSearchParams({
      entityId: String(selectedEntityId),
      ids:      ids.join(","),
      source:   "items",
    });
    fetch(`/api/nyusatsu/analytics/deals/score-map?${qs}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const m = new Map();
        for (const s of (data.items || [])) m.set(s.id, s);
        setScoreMap(m);
      })
      .catch(() => { if (!cancelled) setScoreMap(null); });
    return () => { cancelled = true; };
  }, [selectedEntityId, idsKey]);

  const hrefQuery = selectedEntityId ? `entityId=${selectedEntityId}` : undefined;

  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "案件名・発注機関",
      placeholder: "例: 庁舎建設工事",
    },
    {
      type: "select",
      name: "category",
      label: "案件種別",
      options: nyusatsuConfig.categories.map((c) => ({ value: c.slug, label: c.label, icon: c.icon })),
    },
    {
      type: "select",
      name: "area",
      label: "対象地域",
      options: nyusatsuConfig.areas.map((a) => ({ value: a.value, label: a.label })),
    },
    {
      type: "select",
      name: "bidding_method",
      label: "入札方式",
      options: nyusatsuConfig.biddingMethods.map((m) => ({ value: m.value, label: m.label })),
    },
    {
      type: "dateRange",
      name: ["deadline_from", "deadline_to"],
      label: "締切（期間）",
    },
    {
      type: "select",
      name: "status",
      label: "ステータス",
      options: nyusatsuConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })),
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    {
      key: "category",
      label: "案件種別",
      resolve: (v) => nyusatsuConfig.categories.find((c) => c.slug === v)?.label || v,
    },
    {
      key: "area",
      label: "対象地域",
      resolve: (v) => nyusatsuConfig.areas.find((a) => a.value === v)?.label || v,
    },
    {
      key: "bidding_method",
      label: "入札方式",
      resolve: (v) => nyusatsuConfig.biddingMethods.find((m) => m.value === v)?.label || v,
    },
    {
      key: "status",
      label: "ステータス",
      resolve: (v) => nyusatsuConfig.statusOptions.find((s) => s.value === v)?.label || v,
    },
    { key: "issuer", label: "発注機関" },
    { key: "year", label: "年度（締切年）" },
    { key: "deadline_from", label: "締切From" },
    { key: "deadline_to", label: "締切To" },
  ], []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <CategoryPageHeader categoryId="nyusatsu" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">入札ナビ</h1>
          <p className="text-sm text-gray-500">
            官公庁・自治体の入札・公募情報を横断検索
          </p>
        </div>

        <EntityPicker
          fallbackEntityId={FEATURED_ENTITY_ID}
          onChange={setSelectedEntityId}
        />
        <TopDealsSection entityId={selectedEntityId} limit={5} minScore={60} />

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={onFormFieldChange}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={nyusatsuConfig.sorts}
          sort={filters.sort}
          onSortChange={onSortChange}
        />

        {hasFilters && (
          <ActiveFilterChips chipDefs={chipDefs} filters={filters} onRemove={onChipRemove} />
        )}

        {stats && stats.totalCount > 0 && (
          <StatsDashboard
            totalCount={stats.totalCount}
            hasFilters={hasFilters}
            filters={filters}
            onFilterChange={onStatsToggle}
            accent="#7C3AED"
            sections={[
              {
                title: "年別件数（公告/締切）",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year,
                  label: r.year,
                  count: r.count,
                  isUnknown: !r.year || r.year === "不明",
                })),
              },
              {
                title: "発注機関 TOP10",
                type: "ranking",
                filterKey: "issuer",
                rows: (stats.countsByIssuer || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
                })),
              },
              {
                title: "案件種別",
                type: "ranking",
                filterKey: "category",
                rows: (stats.countsByCategory || []).map((r) => ({
                  value: r.category,
                  label: getCategoryLabel(r.category),
                  count: r.count,
                })),
              },
              {
                title: "ステータス別",
                type: "ranking",
                filterKey: "status",
                rows: (stats.countsByStatus || []).map((r) => ({
                  value: r.status,
                  label: r.status,
                  count: r.count,
                })),
              },
            ]}
          />
        )}

        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {total}件中 {startItem}-{endItem}件を表示
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <DomainResultCard
                key={item.id}
                item={item}
                domainId="nyusatsu"
                domain={nyusatsuDomain}
                basePath="/nyusatsu"
                icon={getCategoryIcon(item.category)}
                secondaryText={item.issuer_name}
                renderBadges={(ctx) => (
                  <NyusatsuBadges
                    item={ctx.item}
                    score={scoreMap?.get(ctx.item.id)}
                    initialSaved={!!(ctx.item.slug && savedSlugSet.has(ctx.item.slug))}
                  />
                )}
                hrefQuery={hrefQuery}
              />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する案件が見つかりません</p>
            <button onClick={handleReset} className="mt-4 text-sm text-blue-600 hover:underline">
              フィルタをリセット
            </button>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}

        <DomainCompareBar domainId="nyusatsu" comparePath="/nyusatsu/compare" label="案件" />
      </div>
    </div>
  );
}
