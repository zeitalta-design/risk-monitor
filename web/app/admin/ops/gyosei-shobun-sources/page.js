"use client";

import { useState, useEffect, useMemo } from "react";
import {
  SOURCE_REGISTRY,
  SECTORS,
  SOURCE_TYPE_LABELS,
  COVERAGE_LABELS,
  DISCOVERY_STATUS_LABELS,
  ALL_PREFECTURES,
  getRegisteredPrefectures,
  getMissingPrefectures,
  getCoverageMatrix,
} from "@/lib/gyosei-shobun-source-registry";

// ─── カテゴリ定義 ─────────────────────

const CATEGORIES = [
  {
    id: "gyosei-shobun",
    label: "行政処分",
    registrySectors: [
      "takken", "kensetsu", "architect_office",
      "finance", "consumer", "competition", "privacy", "tax_agent", "labor", "transport_jidosha",
    ],
    description: "宅建・建設・建築士・金融・消費者・独禁・個情・税理士・労基・運送 の行政処分情報源",
  },
  { id: "sanpai", label: "産廃処分", registrySectors: ["sanpai"], description: "産業廃棄物処理業の行政処分情報源" },
  { id: "nyusatsu", label: "入札", registrySectors: ["nyusatsu"], description: "官公庁・自治体の入札・公募情報源（6省庁横断）" },
  { id: "shitei", label: "指定管理", registrySectors: ["shitei"], description: "自治体の指定管理者公募情報源" },
  { id: "hojokin", label: "補助金", registrySectors: ["hojokin"], description: "国・自治体の補助金・助成金情報源（J-Grants）" },
  { id: "kyoninka", label: "許認可", registrySectors: ["kyoninka"], description: "許認可・登録事業者情報源（gBizINFO）" },
];

// ─── バッジ ─────────────────────

const COVERAGE_CELL = {
  confirmed: { bg: "bg-green-100", text: "text-green-700", label: "巡回中" },
  candidate: { bg: "bg-blue-100", text: "text-blue-700", label: "要対応" },
  complemented: { bg: "bg-sky-50", text: "text-sky-600", label: "国集約" },
  manual_review: { bg: "bg-amber-50", text: "text-amber-600", label: "補完対象" },
  missing: { bg: "bg-red-50", text: "text-red-600", label: "未登録" },
};

function StatusBadge({ status }) {
  const styles = {
    ok: "bg-green-50 text-green-700 border-green-200", warn: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200", unknown: "bg-gray-50 text-gray-500 border-gray-200",
    active: "bg-green-50 text-green-700 border-green-200", inactive: "bg-gray-50 text-gray-400 border-gray-200",
  };
  const labels = { ok: "到達OK", warn: "警告", error: "エラー", unknown: "監査未実施", active: "有効", inactive: "無効" };
  return <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${styles[status] || styles.unknown}`}>{labels[status] || "監査未実施"}</span>;
}

function DiscoveryBadge({ status }) {
  const d = DISCOVERY_STATUS_LABELS[status];
  if (!d) return null;
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", amber: "bg-amber-50 text-amber-700 border-amber-200" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[d.color] || ""}`}>{d.label}</span>;
}

// ─── メインページ ─────────────────────

export default function DataSourceAuditPage() {
  const [activeCategory, setActiveCategory] = useState("gyosei-shobun");
  const [sectorFilter, setSectorFilter] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState("");
  const [auditResults, setAuditResults] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [dbSources, setDbSources] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory);
  const isRegistryBased = !!activeCat?.registrySectors;
  const registrySectors = activeCat?.registrySectors || [];

  // DB カテゴリ取得
  useEffect(() => {
    if (isRegistryBased) return;
    setDbLoading(true);
    fetch(`/api/admin/ops/gyosei-shobun-sources?category=${activeCat.dbDomain}`)
      .then((r) => r.json())
      .then((data) => setDbSources(data.sources || []))
      .catch(() => setDbSources([]))
      .finally(() => setDbLoading(false));
  }, [activeCategory, isRegistryBased, activeCat?.dbDomain]);

  // レジストリソース
  const allRegistrySources = useMemo(() => {
    if (!isRegistryBased) return [];
    return SOURCE_REGISTRY.filter((s) => registrySectors.includes(s.sector));
  }, [isRegistryBased, registrySectors]);

  const filteredRegistrySources = useMemo(() => {
    let list = allRegistrySources;
    if (sectorFilter) list = list.filter((s) => s.sector === sectorFilter);
    if (discoveryFilter) list = list.filter((s) => s.discoveryStatus === discoveryFilter);
    return list.map((s) => ({ ...s, audit: auditResults?.find((r) => r.sourceId === s.id) || null }));
  }, [allRegistrySources, sectorFilter, discoveryFilter, auditResults]);

  const coverageMatrix = useMemo(() => getCoverageMatrix(), []);

  // 全体サマリー
  const totalSummary = useMemo(() => {
    const s = allRegistrySources;
    const firstSector = registrySectors[0] || "";
    const allPrefsCovered = new Set();
    registrySectors.forEach((sec) => getRegisteredPrefectures(sec).forEach((p) => allPrefsCovered.add(p)));
    return {
      total: s.length,
      active: s.filter((x) => x.active).length,
      confirmed: s.filter((x) => x.discoveryStatus === "confirmed").length,
      candidate: s.filter((x) => x.discoveryStatus === "candidate").length,
      manualReview: s.filter((x) => x.discoveryStatus === "manual_review").length,
      prefCovered: allPrefsCovered.size,
      prefMissing: 47 - allPrefsCovered.size,
    };
  }, [allRegistrySources, registrySectors]);

  // 分野別サマリー（行政処分のみ）
  const sectorSummaries = useMemo(() => {
    if (registrySectors.length <= 1) return [];
    return registrySectors.map((sec) => {
      const sources = SOURCE_REGISTRY.filter((s) => s.sector === sec);
      return {
        sector: sec, label: SECTORS[sec]?.short || sec,
        total: sources.length,
        confirmed: sources.filter((s) => s.discoveryStatus === "confirmed").length,
        candidate: sources.filter((s) => s.discoveryStatus === "candidate").length,
        manualReview: sources.filter((s) => s.discoveryStatus === "manual_review").length,
        prefCovered: getRegisteredPrefectures(sec).length,
        prefMissing: getMissingPrefectures(sec).length,
      };
    });
  }, [registrySectors]);

  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch("/api/admin/ops/gyosei-shobun-sources/audit", { method: "POST" });
      const data = await res.json();
      setAuditResults(data.results || []);
    } catch { alert("監査の実行に失敗しました"); }
    finally { setAuditing(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">データソース監査</h1>
        <p className="text-sm text-gray-500">カテゴリ別の情報源管理・都道府県カバレッジ・到達性監査</p>
      </div>

      {/* 凡例 */}
      <Legend />

      {/* カテゴリタブ */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSectorFilter(""); setDiscoveryFilter(""); setShowAddForm(false); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeCategory === cat.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
            {cat.label}
          </button>
        ))}
      </div>
      {/* カテゴリヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{activeCat.label} データソース監査</h2>
          <p className="text-xs text-gray-400 mt-0.5">{activeCat.description}</p>
        </div>
        {!isRegistryBased && (
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shrink-0">
            {showAddForm ? "閉じる" : "+ 新規情報源を追加"}
          </button>
        )}
      </div>

      {/* ========== レジストリベース ========== */}
      {isRegistryBased && (
        <>
          {/* 全体サマリー */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <Card label="情報源数" value={totalSummary.total} />
            <Card label="有効" value={totalSummary.active} />
            <Card label="確認済（巡回中）" value={totalSummary.confirmed} accent="green" />
            <Card label="要対応（調査中）" value={totalSummary.candidate} accent="blue" />
            <Card label="補完対象（国集約で充当）" value={totalSummary.manualReview} accent="amber" />
            <Card label="都道府県カバー" value={`${totalSummary.prefCovered}/47`} accent="green" />
            <Card label="未登録" value={totalSummary.prefMissing} accent={totalSummary.prefMissing > 0 ? "red" : "green"} />
          </div>

          {/* 分野別サブフィルタ（行政処分のみ） */}
          {sectorSummaries.length > 0 && (
            <div className="mb-6">
              <p className="text-[11px] text-gray-400 mb-2 font-medium">分野別フィルタ</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSectorFilter("")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${!sectorFilter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  全分野（{totalSummary.total}）
                </button>
                {sectorSummaries.map((ss) => (
                  <button key={ss.sector} onClick={() => setSectorFilter(sectorFilter === ss.sector ? "" : ss.sector)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${sectorFilter === ss.sector ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {ss.label}（{ss.total}）
                    <span className="ml-1 opacity-60">{ss.prefCovered}/47</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* フィルタ + 監査 */}
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <select value={discoveryFilter} onChange={(e) => setDiscoveryFilter(e.target.value)} className="text-xs border rounded-lg px-3 py-2">
              <option value="">全登録状態</option>
              <option value="confirmed">確認済（巡回中）</option>
              <option value="candidate">要対応（調査中）</option>
              <option value="manual_review">補完対象（国集約で充当）</option>
            </select>
            <button onClick={runAudit} disabled={auditing} className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${auditing ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
              {auditing ? "監査中..." : "到達性監査"}
            </button>
            <span className="text-[11px] text-gray-400">{filteredRegistrySources.length}件</span>
          </div>

          {/* テーブル */}
          <RegistryTable sources={filteredRegistrySources} showSector={registrySectors.length > 1 && !sectorFilter} label={activeCat.label} />

          {/* カバレッジマトリクス */}
          <CoverageMatrix matrix={coverageMatrix} sectors={sectorFilter ? [sectorFilter] : registrySectors} summaries={sectorFilter ? sectorSummaries.filter((s) => s.sector === sectorFilter) : sectorSummaries.length > 0 ? sectorSummaries : [{ sector: registrySectors[0], label: SECTORS[registrySectors[0]]?.short, prefCovered: totalSummary.prefCovered }]} />
        </>
      )}

      {/* ========== DBベース ========== */}
      {!isRegistryBased && (
        <DbCategoryView
          cat={activeCat}
          sources={dbSources}
          loading={dbLoading}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          onSourceAdded={() => {
            fetch(`/api/admin/ops/gyosei-shobun-sources?category=${activeCat.dbDomain}`)
              .then((r) => r.json()).then((data) => setDbSources(data.sources || []));
          }}
        />
      )}
    </div>
  );
}

// ─── 凡例 ─────────────────────

function Legend() {
  return (
    <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-2">
        <span className="flex items-center gap-1.5" title="自動巡回に組み込み済み・データ投入中"><span className="w-3 h-3 rounded-full bg-green-500" /> <strong>確認済（巡回中）</strong></span>
        <span className="flex items-center gap-1.5" title="要対応（調査中）。URL登録済だが自動取得未実装または公表実績未確認。バックログ。"><span className="w-3 h-3 rounded-full bg-blue-500" /> <strong>要対応（調査中）</strong></span>
        <span className="flex items-center gap-1.5" title="国の集約（MLIT等）で補完される見込み"><span className="w-3 h-3 rounded-full bg-sky-400" /> <strong>国集約で補完</strong></span>
        <span className="flex items-center gap-1.5" title="公式Web一覧なし・自動取得不可。MLIT/sanpainet 等の国集約ソースが代替取得。四半期ごとの URL 生死監査のみ実施。"><span className="w-3 h-3 rounded-full bg-amber-400" /> <strong>補完対象（国集約で充当）</strong></span>
        <span className="flex items-center gap-1.5" title="情報源の登録がない"><span className="w-3 h-3 rounded-full bg-red-500" /> <strong>未登録</strong></span>
      </div>
      <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-200">
        ※ 監査バッジ（到達OK / 警告 / エラー / 監査未実施）は URL の HTTP 到達性を示す別軸の指標です。
      </p>
    </div>
  );
}

// ─── レジストリテーブル ─────────────────────

function RegistryTable({ sources, showSector, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">{label} 情報源一覧（{sources.length}件）</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              {showSector && <th className="px-3 py-2 font-medium">分野</th>}
              <th className="px-3 py-2 font-medium">行政主体</th>
              <th className="px-3 py-2 font-medium">都道府県</th>
              <th className="px-3 py-2 font-medium">情報源名</th>
              <th className="px-3 py-2 font-medium">種別</th>
              <th className="px-3 py-2 font-medium">カバレッジ</th>
              <th className="px-3 py-2 font-medium">登録</th>
              <th className="px-3 py-2 font-medium">監査</th>
              <th className="px-3 py-2 font-medium">メモ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/50">
                {showSector && <td className="px-3 py-2.5"><span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{SECTORS[s.sector]?.short}</span></td>}
                <td className="px-3 py-2.5 text-gray-700">{s.authorityName}</td>
                <td className="px-3 py-2.5 text-gray-500">{s.prefecture || "全国"}</td>
                <td className="px-3 py-2.5">
                  <span className="text-gray-900 font-medium">{s.sourceName}</span>
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-500 hover:underline truncate max-w-[220px]">{s.url}</a>}
                </td>
                <td className="px-3 py-2.5 text-gray-500">{SOURCE_TYPE_LABELS[s.sourceType] || s.sourceType}</td>
                <td className="px-3 py-2.5 text-gray-500">{COVERAGE_LABELS[s.coverageScope] || s.coverageScope}</td>
                <td className="px-3 py-2.5"><DiscoveryBadge status={s.discoveryStatus} /></td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={s.audit?.status || "unknown"} />
                  {s.audit?.httpStatus && <span className="text-[10px] text-gray-400 ml-1">{s.audit.httpStatus}</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[180px]"><span className="line-clamp-2">{s.audit?.note || s.notes || "-"}</span></td>
              </tr>
            ))}
            {sources.length === 0 && <tr><td colSpan={showSector ? 9 : 8} className="px-3 py-8 text-center text-gray-400">該当なし</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── カバレッジマトリクス ─────────────────────

function CoverageMatrix({ matrix, sectors, summaries }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">都道府県カバレッジ（47都道府県）</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {summaries.map((s) => <span key={s.sector} className="mr-3">{s.label}: <strong>{s.prefCovered}/47</strong></span>)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              <th className="px-3 py-2 font-medium sticky left-0 bg-gray-50 z-10">都道府県</th>
              {sectors.map((sec) => <th key={sec} className="px-3 py-2 font-medium text-center">{SECTORS[sec]?.short || sec}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {matrix.map((row) => (
              <tr key={row.prefecture} className="hover:bg-gray-50/50">
                <td className="px-3 py-1.5 text-gray-700 font-medium sticky left-0 bg-white z-10">{row.prefecture}</td>
                {sectors.map((sec) => {
                  const cell = COVERAGE_CELL[row[sec]] || COVERAGE_CELL.missing;
                  return <td key={sec} className="px-3 py-1.5 text-center"><span className={`text-[10px] px-2 py-0.5 rounded ${cell.bg} ${cell.text}`}>{cell.label}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DBカテゴリビュー（入札〜許認可） ─────────────────────

function DbCategoryView({ cat, sources, loading, showAddForm, setShowAddForm, onSourceAdded }) {
  if (loading) return <div className="py-16 text-center text-gray-400">読み込み中...</div>;

  return (
    <>
      {/* サマリー（産廃と同じ構成） */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <Card label="情報源数" value={sources.length} />
        <Card label="有効" value={sources.filter((s) => s.status === "active").length} accent="green" />
        <Card label="日次巡回" value={sources.filter((s) => s.run_frequency === "daily").length} accent="blue" />
        <Card label="週次巡回" value={sources.filter((s) => s.run_frequency === "weekly").length} accent="blue" />
        <Card label="手動" value={sources.filter((s) => !s.run_frequency || s.run_frequency === "manual").length} accent="amber" />
        <Card label="最終確認" value={sources.length > 0 ? sources.reduce((l, s) => (s.last_checked_at && s.last_checked_at > l ? s.last_checked_at : l), "").substring(0, 10) || "未確認" : "—"} />
        <Card label="カバー率" value={sources.length > 0 ? `${sources.filter((s) => s.status === "active").length}件` : "0件"} accent={sources.length > 0 ? "green" : "red"} />
      </div>

      {showAddForm && <AddSourceForm category={cat.dbDomain} onAdded={() => { setShowAddForm(false); onSourceAdded(); }} />}

      {sources.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-blue-200 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-5 bg-blue-50 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
            </svg>
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 mb-3">{cat.label}のデータソースを登録しましょう</h3>
          <p className="text-sm text-gray-500 mb-2 max-w-md mx-auto">
            情報源を登録すると、都道府県カバレッジや巡回状況をこの画面で一元管理できます。
          </p>
          <p className="text-xs text-gray-400 mb-6">
            右上の「+ 新規情報源を追加」ボタンから登録してください。
          </p>
          <button onClick={() => setShowAddForm(true)}
            className="text-sm px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
            + 最初の情報源を追加する
          </button>
          <div className="mt-6 text-xs text-gray-400">
            例: 官公庁の公開ページURL、オープンデータカタログ、API連携先など
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">{cat.label} データソース一覧（{sources.length}件）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-3 py-2 font-medium">ソース名</th>
                  <th className="px-3 py-2 font-medium">種別</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">取得方法</th>
                  <th className="px-3 py-2 font-medium">巡回頻度</th>
                  <th className="px-3 py-2 font-medium">最終確認</th>
                  <th className="px-3 py-2 font-medium">ステータス</th>
                  <th className="px-3 py-2 font-medium">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 text-gray-900 font-medium">{s.source_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.source_type || "web"}</td>
                    <td className="px-3 py-2.5">{s.source_url ? <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px] block">{s.source_url}</a> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.fetch_method || "manual"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.run_frequency || "-"}</td>
                    <td className="px-3 py-2.5 text-gray-400">{s.last_checked_at?.substring(0, 10) || "未確認"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status || "unknown"} /></td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-[180px]"><span className="line-clamp-2">{s.notes || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── 新規追加フォーム ─────────────────────

function AddSourceForm({ category, onAdded }) {
  const [form, setForm] = useState({ source_name: "", source_type: "web", source_url: "", fetch_method: "manual", run_frequency: "daily", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source_name.trim()) { setError("ソース名を入力してください"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/admin/ops/gyosei-shobun-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, domain_id: category }) });
      if (res.ok) { onAdded(); } else { const data = await res.json(); setError(data.error || "登録に失敗しました"); }
    } catch { setError("通信エラー"); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-900">新規情報源を追加</h3>
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-gray-700 mb-1">ソース名 *</label><input type="text" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 東京都 産廃処分名簿" /></div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">URL</label><input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." /></div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">取得方法</label><select value={form.fetch_method} onChange={(e) => setForm({ ...form, fetch_method: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="manual">手動</option><option value="scraping">自動スクレイピング</option><option value="api">API連携</option></select></div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">巡回頻度</label><select value={form.run_frequency} onChange={(e) => setForm({ ...form, run_frequency: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="daily">毎日</option><option value="weekly">週1回</option><option value="monthly">月1回</option><option value="manual">手動のみ</option></select></div>
      </div>
      <div><label className="block text-xs font-medium text-gray-700 mb-1">メモ</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="備考" /></div>
      <button type="submit" disabled={submitting} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{submitting ? "登録中..." : "登録する"}</button>
    </form>
  );
}

// ─── カード ─────────────────────

function Card({ label, value, accent = "gray" }) {
  const colors = { gray: "text-gray-900", blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent] || colors.gray}`}>{value}</p>
    </div>
  );
}
