"use client";

/**
 * ドメイン一覧ページ共通の状態／URL同期／fetch ロジックを束ねた hook。
 *
 * 目的:
 *   - 入札 / 補助金 / 産廃 / 許認可 / 指定管理 / 行政処分 の検索ページで
 *     コピペされている ~200 行の state + URL sync + fetch の重複を解消する
 *   - 各ドメインページは設定（filterKeys / apiPaths / basePath）と
 *     ドメイン固有の UI（searchFields, chipDefs, stats, card）だけ残す
 *
 * 設計ポリシー:
 *   - 「SearchPanel / ResultList / FilterBar」を構成するフックなので、
 *     描画は一切しない。値だけ返す
 *   - pageSize 等ドメイン共通の定数は呼び出し側が渡す
 *   - stats 取得は listApiPath と別 path（listApiPath + "/stats"）
 *
 * @example
 *   const page = useDomainSearchPage({
 *     basePath: "/hojokin",
 *     listApiPath: "/api/hojokin",
 *     statsApiPath: "/api/hojokin/stats",
 *     filterKeys: ["keyword", "category", "target_type", ...],
 *     initialFilters: INITIAL_FILTERS,
 *     pageSize: 20,
 *   });
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * @typedef {Object} UseDomainSearchPageOptions
 * @property {string} basePath           - ルート先頭 e.g. "/hojokin"
 * @property {string} listApiPath        - 一覧 API e.g. "/api/hojokin"
 * @property {string} statsApiPath       - 統計 API e.g. "/api/hojokin/stats"
 * @property {string[]} filterKeys       - URL sync & fetch 対象の filter キー群
 * @property {Object} initialFilters     - sort / page を含む初期値
 * @property {string} [defaultSort="deadline"]
 * @property {number} [pageSize=20]
 */

/**
 * @param {UseDomainSearchPageOptions} opts
 */
export function useDomainSearchPage({
  basePath,
  listApiPath,
  statsApiPath,
  filterKeys,
  initialFilters,
  defaultSort = "deadline",
  pageSize = 20,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // URL → filters
  const [filters, setFilters] = useState(() => {
    const f = { ...initialFilters };
    for (const k of filterKeys) {
      const v = searchParams.get(k);
      if (v !== null) f[k] = v;
    }
    f.sort = searchParams.get("sort") || initialFilters.sort || defaultSort;
    f.page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    return f;
  });

  const [formInput, setFormInput] = useState(filters);

  // filters → URL
  //   Phase J-3: このフックの管轄外（entityId 等）の unknown params は
  //   保持する。既存の filterKeys / sort / page は従来どおり再構築。
  const syncUrl = useCallback(
    (f) => {
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      for (const k of filterKeys) params.delete(k);
      params.delete("sort");
      params.delete("page");
      for (const k of filterKeys) {
        if (f[k]) params.set(k, f[k]);
      }
      if (f.sort && f.sort !== defaultSort) params.set("sort", f.sort);
      if (f.page > 1) params.set("page", String(f.page));
      const qs = params.toString();
      router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, basePath, filterKeys, defaultSort],
  );

  // fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = new URLSearchParams();
      const statsParams = new URLSearchParams();
      for (const k of filterKeys) {
        const v = filters[k];
        if (v) {
          listParams.set(k, v);
          statsParams.set(k, v);
        }
      }
      listParams.set("sort", filters.sort);
      listParams.set("page", String(filters.page));
      listParams.set("pageSize", String(pageSize));

      const [listRes, statsRes] = await Promise.all([
        fetch(`${listApiPath}?${listParams}`),
        fetch(`${statsApiPath}?${statsParams}`),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setStats(statsData.error ? null : statsData);
    } catch (err) {
      console.error(`[useDomainSearchPage] fetch failed (${basePath}):`, err);
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters, filterKeys, listApiPath, statsApiPath, pageSize, basePath]);

  useEffect(() => {
    fetchData();
    syncUrl(filters);
  }, [fetchData, syncUrl, filters]);

  // ─── derived values ──────────────────────
  const hasFilters = useMemo(
    () => filterKeys.some((k) => !!filters[k]),
    [filters, filterKeys],
  );

  const startItem = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const endItem = Math.min(filters.page * pageSize, total);

  // ─── handlers ──────────────────────
  const handleSearch = useCallback(() => {
    setFilters({ ...formInput, page: 1 });
  }, [formInput]);

  const handleReset = useCallback(() => {
    setFormInput(initialFilters);
    setFilters(initialFilters);
  }, [initialFilters]);

  const goToPage = useCallback(
    (p) => {
      const clamped = Math.max(1, Math.min(p, totalPages));
      setFilters((prev) => ({ ...prev, page: clamped }));
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [totalPages],
  );

  const onChipRemove = useCallback((key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  }, []);

  const onStatsToggle = useCallback((key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
    setFormInput((p) => ({ ...p, [key]: value }));
  }, []);

  const onSortChange = useCallback((v) => {
    setFormInput((p) => ({ ...p, sort: v }));
    setFilters((p) => ({ ...p, sort: v, page: 1 }));
  }, []);

  const onFormFieldChange = useCallback((name, value) => {
    setFormInput((p) => ({ ...p, [name]: value }));
  }, []);

  return {
    // data
    items,
    total,
    totalPages,
    stats,
    loading,
    // state
    filters,
    setFilters,
    formInput,
    setFormInput,
    // derived
    hasFilters,
    startItem,
    endItem,
    // handlers
    handleSearch,
    handleReset,
    goToPage,
    onChipRemove,
    onStatsToggle,
    onSortChange,
    onFormFieldChange,
  };
}

export default useDomainSearchPage;
