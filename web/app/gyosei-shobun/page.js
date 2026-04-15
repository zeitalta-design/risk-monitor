"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";
import RiskScoreBadge from "@/components/gyosei-shobun/RiskScoreBadge";
import LegalDisclaimer from "@/components/gyosei-shobun/LegalDisclaimer";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

const PAGE_SIZE = 20;

export default function GyoseiShobunListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    action_type: searchParams.get("action_type") || "",
    prefecture: searchParams.get("prefecture") || "",
    industry: searchParams.get("industry") || "",
    year: searchParams.get("year") || "",
    organization: searchParams.get("organization") || "",
    authority: searchParams.get("authority") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    sort: searchParams.get("sort") || "newest",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });

  // 検索フォームの入力中値（「検索」ボタンで filters に反映される）
  const [formInput, setFormInput] = useState(filters);

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.action_type) params.set("action_type", f.action_type);
    if (f.prefecture) params.set("prefecture", f.prefecture);
    if (f.industry) params.set("industry", f.industry);
    if (f.year) params.set("year", f.year);
    if (f.organization) params.set("organization", f.organization);
    if (f.authority) params.set("authority", f.authority);
    if (f.date_from) params.set("date_from", f.date_from);
    if (f.date_to) params.set("date_to", f.date_to);
    if (f.sort && f.sort !== "newest") params.set("sort", f.sort);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/gyosei-shobun${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 一覧用パラメータ
      const listParams = new URLSearchParams();
      if (filters.keyword) listParams.set("keyword", filters.keyword);
      if (filters.action_type) listParams.set("action_type", filters.action_type);
      if (filters.prefecture) listParams.set("prefecture", filters.prefecture);
      if (filters.industry) listParams.set("industry", filters.industry);
      if (filters.year) listParams.set("year", filters.year);
      if (filters.organization) listParams.set("organization", filters.organization);
      if (filters.authority) listParams.set("authority", filters.authority);
      if (filters.date_from) listParams.set("date_from", filters.date_from);
      if (filters.date_to) listParams.set("date_to", filters.date_to);
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(PAGE_SIZE));

      // 統計用パラメータ（page / sort を除外）
      const statsParams = new URLSearchParams();
      if (filters.keyword) statsParams.set("keyword", filters.keyword);
      if (filters.action_type) statsParams.set("action_type", filters.action_type);
      if (filters.prefecture) statsParams.set("prefecture", filters.prefecture);
      if (filters.industry) statsParams.set("industry", filters.industry);
      if (filters.year) statsParams.set("year", filters.year);
      if (filters.organization) statsParams.set("organization", filters.organization);
      if (filters.authority) statsParams.set("authority", filters.authority);
      if (filters.date_from) statsParams.set("date_from", filters.date_from);
      if (filters.date_to) statsParams.set("date_to", filters.date_to);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/gyosei-shobun?${listParams}`),
        fetch(`/api/gyosei-shobun/stats?${statsParams}`),
      ]);

      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch {
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    syncUrl(filters);
  }, [fetchData, syncUrl, filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setFilters((prev) => ({ ...prev, page: clamped }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startItem = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(filters.keyword || filters.action_type || filters.prefecture || filters.industry || filters.year || filters.organization || filters.authority || filters.date_from || filters.date_to);

  // 検索実行: フォーム入力値を filters に反映して fetch を走らせる
  const handleSearch = () => {
    setFilters({ ...formInput, page: 1 });
  };
  const handleReset = () => {
    const empty = {
      keyword: "", action_type: "", prefecture: "", industry: "",
      year: "", organization: "", authority: "", date_from: "", date_to: "",
      sort: "newest", page: 1,
    };
    setFormInput(empty);
    setFilters(empty);
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

        {/* 検索フォーム（国交省ネガティブ情報検索風） */}
        <SearchForm
          formInput={formInput}
          setFormInput={setFormInput}
          onSearch={handleSearch}
          onReset={handleReset}
          sort={filters.sort}
          onSortChange={(v) => {
            setFormInput((p) => ({ ...p, sort: v }));
            setFilters((p) => ({ ...p, sort: v, page: 1 }));
          }}
        />

        {/* 適用条件チップ */}
        {hasFilters && (
          <ActiveFilterChips filters={filters} onRemove={(k, v) => {
            setFilters((p) => ({ ...p, [k]: v, page: 1 }));
            setFormInput((p) => ({ ...p, [k]: v }));
          }} />
        )}

        {/* 件数表示 */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {total}件中 {startItem}-{endItem}件を表示
          </p>
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
                  className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 block hover:shadow-md hover:border-gray-300 transition-all"
                >
                  {/* 上段: 事業者名 + 処分種別バッジ */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-xl flex-shrink-0 mt-0.5">{actionIcon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 leading-snug break-words">{item.organization_name_raw}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${tc.bg} ${tc.text} ${tc.border}`}>
                          {actionLabel}
                        </span>
                        {industryLabel && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {industryLabel}
                          </span>
                        )}
                        <RiskScoreBadge action={item} mode="compact" />
                      </div>
                    </div>
                  </div>
                  {/* 中段: 処分日・行政庁・都道府県 */}
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs mb-2 ml-8">
                    {item.action_date && (
                      <span className="text-gray-700 font-medium">{item.action_date}</span>
                    )}
                    {item.authority_name && (
                      <span className="text-gray-500">{item.authority_name}</span>
                    )}
                    {item.prefecture && (
                      <span className="text-gray-400">{item.prefecture}{item.city ? ` ${item.city}` : ""}</span>
                    )}
                  </div>
                  {/* 下段: 概要 */}
                  {item.summary && (
                    <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 ml-8">{item.summary}</p>
                  )}
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

        {!loading && totalPages > 1 && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}
        <LegalDisclaimer />
      </div>
    </div>
  );
}

// ─── 都道府県リスト ─────────────────────

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
  "沖縄県",
];

const AUTHORITY_OPTIONS = [
  { value: "", label: "指定なし" },
  { value: "金融庁", label: "金融庁" },
  { value: "消費者庁", label: "消費者庁" },
  { value: "公正取引委員会", label: "公正取引委員会" },
  { value: "個人情報保護委員会", label: "個人情報保護委員会" },
  { value: "国税庁", label: "国税庁" },
  { value: "国土交通省", label: "国土交通省" },
  { value: "厚生労働省", label: "厚生労働省（労働局）" },
];

// ─── 検索フォーム ─────────────────────

function SearchForm({ formInput, setFormInput, onSearch, onReset, sort, onSortChange }) {
  const update = (k, v) => setFormInput((p) => ({ ...p, [k]: v }));
  const onEnter = (e) => { if (e.key === "Enter") onSearch(); };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 事業者名・キーワード */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">事業者名・キーワード</label>
          <input
            type="text"
            value={formInput.keyword}
            onChange={(e) => update("keyword", e.target.value)}
            onKeyDown={onEnter}
            placeholder="例: 〇〇株式会社"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* 都道府県 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">所在地（都道府県）</label>
          <select
            value={formInput.prefecture}
            onChange={(e) => update("prefecture", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">指定なし（全国 + 国レベル処分）</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* 処分日 From〜To */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">処分日（期間）</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={formInput.date_from}
              onChange={(e) => update("date_from", e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <input
              type="date"
              value={formInput.date_to}
              onChange={(e) => update("date_to", e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* 処分機関 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">処分を行った機関</label>
          <select
            value={formInput.authority}
            onChange={(e) => update("authority", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {AUTHORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* 処分種別 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">処分種別</label>
          <select
            value={formInput.action_type}
            onChange={(e) => update("action_type", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">指定なし</option>
            {gyoseiShobunConfig.actionTypes.map((t) => (
              <option key={t.slug} value={t.slug}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>

        {/* 業種 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">業種</label>
          <select
            value={formInput.industry}
            onChange={(e) => update("industry", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">指定なし</option>
            {gyoseiShobunConfig.industries.map((i) => (
              <option key={i.slug} value={i.slug}>{i.icon} {i.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ボタン + ソート */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="px-6 py-2 bg-[#1F6FB2] text-white font-bold text-sm rounded-lg hover:bg-[#1B5F99] transition-colors"
          >
            🔍 検索
          </button>
          <button
            onClick={onReset}
            className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            リセット
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">並び替え</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-xs border rounded-lg px-2.5 py-1.5 bg-white"
          >
            {gyoseiShobunConfig.sorts.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── 統計ダッシュボード（非使用・残置） ─────────────────────
// eslint-disable-next-line no-unused-vars
function StatsDashboard({ stats, hasFilters, filters, onFilterChange }) {
  const { totalCount, countsByYear, countsByOrganization, countsByIndustry, countsByActionType, countsByPrefecture } = stats;
  const maxYearCount = Math.max(...(countsByYear || []).map((r) => r.count), 1);
  const maxOrgCount = Math.max(...(countsByOrganization || []).map((r) => r.count), 1);

  // トグル: 同値ならクリア、異なればセット
  const toggle = (key, value) => {
    onFilterChange(key, filters[key] === value ? "" : value);
  };

  if (totalCount === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#1F6FB2] rounded-full" />
        <h2 className="text-sm font-bold text-gray-700">データ概要</h2>
        {hasFilters && (
          <span className="text-[11px] text-gray-400">（現在の条件で集計）</span>
        )}
      </div>

      {/* 総件数 + 2カラム */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 年別件数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-600">年別件数</h3>
            <span className="text-xs text-gray-400">
              総計 <span className="font-bold text-gray-700 text-sm">{totalCount.toLocaleString()}</span> 件
            </span>
          </div>
          {countsByYear && countsByYear.length > 0 ? (
            <div className="space-y-1.5">
              {countsByYear.map((row) => {
                const isUnknown = row.year === "不明";
                const isActive = !isUnknown && filters.year === row.year;
                return (
                  <button
                    key={row.year}
                    onClick={() => !isUnknown && toggle("year", row.year)}
                    disabled={isUnknown}
                    className={`w-full flex items-center gap-2 rounded transition-colors ${
                      isUnknown ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-blue-50/50"
                    } ${isActive ? "ring-1 ring-[#1F6FB2] bg-blue-50/30 rounded-lg" : ""}`}
                  >
                    <span className={`text-xs w-10 text-right font-medium shrink-0 ${isActive ? "text-[#1F6FB2] font-bold" : "text-gray-500"}`}>
                      {row.year}
                    </span>
                    <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${Math.max((row.count / maxYearCount) * 100, 2)}%`,
                          backgroundColor: "#1F6FB2",
                          opacity: isActive ? 0.9 : 0.75,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right shrink-0 ${isActive ? "text-[#1F6FB2]" : "text-gray-700"}`}>
                      {row.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">データなし</p>
          )}
        </div>

        {/* 事業者別件数 TOP 10 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-gray-600 mb-3">事業者別件数 TOP 10</h3>
          {countsByOrganization && countsByOrganization.length > 0 ? (
            <div className="space-y-1.5">
              {countsByOrganization.map((row, i) => {
                const isUnknown = row.organizationName === "名称不明";
                const isActive = !isUnknown && filters.organization === row.organizationName;
                return (
                  <button
                    key={`${row.organizationName}-${i}`}
                    onClick={() => !isUnknown && toggle("organization", row.organizationName)}
                    disabled={isUnknown}
                    className={`w-full flex items-center gap-2 rounded transition-colors ${
                      isUnknown ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-blue-50/50"
                    } ${isActive ? "ring-1 ring-[#1F6FB2] bg-blue-50/30 rounded-lg" : ""}`}
                  >
                    <span className={`text-xs w-5 text-right shrink-0 font-medium ${isActive ? "text-[#1F6FB2]" : "text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 relative h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded transition-all"
                        style={{
                          width: `${Math.max((row.count / maxOrgCount) * 100, 3)}%`,
                          backgroundColor: "#1F6FB2",
                          opacity: isActive ? 0.3 : 0.15,
                        }}
                      />
                      <span
                        className={`relative z-10 text-[11px] font-medium truncate block leading-5 px-1.5 text-left ${isActive ? "text-[#1F6FB2] font-bold" : "text-gray-700"}`}
                        title={row.organizationName}
                      >
                        {row.organizationName}
                      </span>
                    </div>
                    <span className={`text-xs font-bold w-8 text-right shrink-0 ${isActive ? "text-[#1F6FB2]" : "text-gray-700"}`}>
                      {row.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">データなし</p>
          )}
        </div>
      </div>

      {/* 追加統計: 業種別 / 都道府県別 */}
      {/* 処分種別件数は大半が「その他」で可視化価値が薄いため非表示 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <StatsRankingCard
          title="業種別件数"
          filterKey="industry"
          activeValue={filters.industry}
          onToggle={toggle}
          data={(countsByIndustry || []).map((r) => ({
            value: r.industry,
            label: gyoseiShobunConfig.industries.find((i) => i.slug === r.industry)?.label || r.industry,
            count: r.count,
            isUnknown: r.industry === "業種不明",
          }))}
        />
        <StatsRankingCard
          title="都道府県別件数"
          filterKey="prefecture"
          activeValue={filters.prefecture}
          onToggle={toggle}
          data={(countsByPrefecture || []).map((r) => ({
            value: r.prefecture,
            label: r.prefecture,
            count: r.count,
          }))}
        />
      </div>
    </div>
  );
}

// ─── 汎用ランキングカード ─────────────────────

function StatsRankingCard({ title, filterKey, activeValue, onToggle, data }) {
  const maxCount = Math.max(...(data || []).map((r) => r.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-600 mb-3">{title}</h3>
      {data && data.length > 0 ? (
        <div className="space-y-1.5">
          {data.map((row, i) => {
            const isActive = !row.isUnknown && activeValue === row.value;
            return (
              <button
                key={`${row.value}-${i}`}
                onClick={() => !row.isUnknown && onToggle(filterKey, row.value)}
                disabled={row.isUnknown}
                className={`w-full flex items-center gap-2 rounded transition-colors ${
                  row.isUnknown ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-blue-50/50"
                } ${isActive ? "ring-1 ring-[#1F6FB2] bg-blue-50/30 rounded-lg" : ""}`}
              >
                <span className={`text-xs w-5 text-right shrink-0 font-medium ${isActive ? "text-[#1F6FB2]" : "text-gray-400"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 relative h-5 bg-gray-50 rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded transition-all"
                    style={{
                      width: `${Math.max((row.count / maxCount) * 100, 3)}%`,
                      backgroundColor: "#1F6FB2",
                      opacity: isActive ? 0.3 : 0.15,
                    }}
                  />
                  <span
                    className={`relative z-10 text-[11px] font-medium truncate block leading-5 px-1.5 text-left ${isActive ? "text-[#1F6FB2] font-bold" : "text-gray-700"}`}
                    title={row.label}
                  >
                    {row.label}
                  </span>
                </div>
                <span className={`text-xs font-bold w-8 text-right shrink-0 ${isActive ? "text-[#1F6FB2]" : "text-gray-700"}`}>
                  {row.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">データなし</p>
      )}
    </div>
  );
}

// ─── ページネーション ─────────────────────

function Pagination({ currentPage, totalPages, onPageChange }) {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) {
        end = Math.min(maxVisible, totalPages - 1);
      } else if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - maxVisible + 1);
      }
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="mt-8 flex flex-col items-center gap-3" aria-label="ページネーション">
      <div className="hidden sm:flex items-center gap-1">
        <PaginationButton onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="最初のページへ">
          &laquo;
        </PaginationButton>
        <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="前のページへ">
          &lsaquo; 前へ
        </PaginationButton>
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm select-none">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 px-2 text-sm rounded-lg font-medium transition-colors ${
                p === currentPage ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <PaginationButton onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="次のページへ">
          次へ &rsaquo;
        </PaginationButton>
        <PaginationButton onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} aria-label="最後のページへ">
          &raquo;
        </PaginationButton>
      </div>
      <div className="flex sm:hidden items-center gap-3">
        <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          &lsaquo; 前へ
        </PaginationButton>
        <span className="text-sm text-gray-600 font-medium">{currentPage} / {totalPages}</span>
        <PaginationButton onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          次へ &rsaquo;
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({ onClick, disabled, children, ...props }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-9 px-3 text-sm rounded-lg font-medium transition-colors ${
        disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── 適用条件チップ ─────────────────────

const FILTER_CHIP_DEFS = [
  { key: "keyword", label: "キーワード" },
  { key: "action_type", label: "処分種別", resolve: (v) => gyoseiShobunConfig.actionTypes.find((t) => t.slug === v)?.label || v },
  { key: "industry", label: "業種", resolve: (v) => gyoseiShobunConfig.industries.find((i) => i.slug === v)?.label || v },
  { key: "prefecture", label: "都道府県" },
  { key: "authority", label: "処分機関" },
  { key: "date_from", label: "処分日From" },
  { key: "date_to", label: "処分日To" },
  { key: "year", label: "年度" },
  { key: "organization", label: "事業者" },
];

function ActiveFilterChips({ filters, onRemove }) {
  const chips = FILTER_CHIP_DEFS.filter((d) => filters[d.key]).map((d) => ({
    key: d.key,
    label: d.label,
    displayValue: d.resolve ? d.resolve(filters[d.key]) : filters[d.key],
  }));

  if (chips.length === 0) return null;

  const clearAll = () => {
    FILTER_CHIP_DEFS.forEach((d) => onRemove(d.key, ""));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-[11px] text-gray-400 shrink-0">適用中:</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 max-w-[240px]"
        >
          <span className="text-blue-400 font-medium shrink-0">{chip.label}:</span>
          <span className="truncate" title={chip.displayValue}>{chip.displayValue}</span>
          <button
            onClick={() => onRemove(chip.key, "")}
            className="ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-700 transition-colors"
            aria-label={`${chip.label}の条件を解除`}
          >
            ×
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          onClick={clearAll}
          className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          すべて解除
        </button>
      )}
    </div>
  );
}
