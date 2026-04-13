"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

/**
 * Phase214: 品質管理ダッシュボード
 *
 * /admin/quality — 重複・欠損・口コミ・写真・結果・スコアの統合ビュー
 */

const SUB_TABS = [
  { key: "dashboard", label: "概要" },
  { key: "duplicates", label: "重複候補" },
  { key: "incomplete", label: "欠損データ" },
  { key: "reviews", label: "口コミ確認" },
  { key: "photos", label: "写真確認" },
  { key: "results", label: "結果確認" },
  { key: "scores", label: "品質スコア" },
];

export default function AdminQualityPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  useEffect(() => {
    setOffset(0);
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [activeTab, offset]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: activeTab, limit: String(LIMIT), offset: String(offset) });
      const res = await fetch(`/api/admin/quality?${params}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-4">品質管理</h1>

      {/* サブタブ */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.key
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">読み込み中...</p>
      ) : !data ? (
        <p className="text-sm text-red-500 py-12 text-center">データ取得に失敗しました</p>
      ) : (
        <>
          {activeTab === "dashboard" && <DashboardView data={data} onNavigate={setActiveTab} />}
          {activeTab === "duplicates" && <DuplicatesView data={data} />}
          {activeTab === "incomplete" && <IncompleteView data={data} offset={offset} setOffset={setOffset} limit={LIMIT} />}
          {activeTab === "reviews" && <ReviewsView data={data} offset={offset} setOffset={setOffset} limit={LIMIT} />}
          {activeTab === "photos" && <PhotosView data={data} offset={offset} setOffset={setOffset} limit={LIMIT} />}
          {activeTab === "results" && <ResultsView data={data} offset={offset} setOffset={setOffset} limit={LIMIT} />}
          {activeTab === "scores" && <ScoresView data={data} offset={offset} setOffset={setOffset} limit={LIMIT} />}
        </>
      )}
    </div>
  );
}

/* ========== Dashboard ========== */
function DashboardView({ data, onNavigate }) {
  const cs = data.completeness || {};
  const rs = data.reviewStats || {};
  const ps = data.photoStats || {};
  const ress = data.resultStats || {};
  const sd = data.scoreDist || {};

  return (
    <div className="space-y-6">
      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="重複候補" value={data.duplicateCount || 0} color={data.duplicateCount > 0 ? "text-amber-600" : "text-gray-900"} onClick={() => onNavigate("duplicates")} />
        <KpiCard label="欠損データ件数" value={`${cs.missing?.noDate || 0}+`} sub="開催日なし" color="text-amber-600" onClick={() => onNavigate("incomplete")} />
        <KpiCard label="要確認口コミ" value={(rs.pending || 0) + (rs.flagged || 0)} sub={`短文: ${rs.shortBody || 0}`} color="text-orange-600" onClick={() => onNavigate("reviews")} />
        <KpiCard label="承認待ち写真" value={ps.pending || 0} sub={`ALTなし: ${ps.noAlt || 0}`} color="text-orange-600" onClick={() => onNavigate("photos")} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="結果リスクデータ" value={ress.eventCount || 0} sub={`全${ress.total || 0}件`} />
        <KpiCard label="ゼッケンなし" value={ress.noBib || 0} color={ress.noBib > 0 ? "text-amber-600" : "text-gray-900"} onClick={() => onNavigate("results")} />
        <KpiCard label="平均品質" value={`${sd.averageScore || 0}点`} sub={`全${sd.totalEvents || 0}リスク情報`} />
        <KpiCard label="低品質(E)" value={sd.distribution?.E || 0} color={sd.distribution?.E > 0 ? "text-red-500" : "text-gray-900"} onClick={() => onNavigate("scores")} />
      </div>

      {/* 品質スコア分布 */}
      {sd.distribution && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">品質スコア分布</h2>
          <div className="flex gap-2 items-end h-24">
            {["A", "B", "C", "D", "E"].map((grade) => {
              const count = sd.distribution[grade] || 0;
              const max = Math.max(...Object.values(sd.distribution), 1);
              const pct = (count / max) * 100;
              const colors = { A: "bg-emerald-500", B: "bg-blue-500", C: "bg-amber-500", D: "bg-orange-500", E: "bg-red-500" };
              return (
                <div key={grade} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500 tabular-nums">{count}</span>
                  <div className={`w-full rounded-t ${colors[grade]}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                  <span className="text-xs font-bold text-gray-600">{grade}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 欠損サマリ */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">データカバレッジ</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <CoverageRow label="写真あり" has={cs.coverage?.photos || 0} total={cs.total || 0} />
          <CoverageRow label="口コミあり" has={cs.coverage?.reviews || 0} total={cs.total || 0} />
          <CoverageRow label="結果あり" has={cs.coverage?.results || 0} total={cs.total || 0} />
          <CoverageRow label="開催日あり" has={(cs.total || 0) - (cs.missing?.noDate || 0)} total={cs.total || 0} />
          <CoverageRow label="公式URLあり" has={(cs.total || 0) - (cs.missing?.noUrl || 0)} total={cs.total || 0} />
          <CoverageRow label="距離情報あり" has={(cs.total || 0) - (cs.missing?.noDistance || 0)} total={cs.total || 0} />
        </div>
      </div>

      {/* 重複候補TOP3 */}
      {data.topDuplicates?.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-700 mb-3">重複候補（上位）</h2>
          <div className="space-y-2">
            {data.topDuplicates.map((d, i) => (
              <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold tabular-nums">{d.score}</span>
                <span className="truncate">{d.eventA.title}</span>
                <span className="text-gray-400">↔</span>
                <span className="truncate">{d.eventB.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 優先改善リスク情報 */}
      {data.priorityEvents?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">改善優先度が高いリスク情報</h2>
          <div className="space-y-1.5">
            {data.priorityEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <GradeBadge grade={e.grade} />
                <span className="text-gray-400 tabular-nums">#{e.id}</span>
                <span className="text-gray-700 truncate flex-1">{e.title}</span>
                <span className="text-gray-400">{e.score}点</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Duplicates ========== */
function DuplicatesView({ data }) {
  const items = data.items || [];
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{items.length}件の重複候補を検出</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">重複候補はありません</p>
      ) : (
        <div className="space-y-3">
          {items.map((d, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${d.score >= 70 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  スコア {d.score}
                </span>
                <span className="text-xs text-gray-400">{d.reasons.join(" / ")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-400 text-xs">#{d.eventA.id}</span>
                  <p className="text-gray-800 font-medium truncate">{d.eventA.title}</p>
                  <p className="text-xs text-gray-500">{d.eventA.event_date} {d.eventA.prefecture}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-400 text-xs">#{d.eventB.id}</span>
                  <p className="text-gray-800 font-medium truncate">{d.eventB.title}</p>
                  <p className="text-xs text-gray-500">{d.eventB.event_date} {d.eventB.prefecture}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== Incomplete ========== */
function IncompleteView({ data, offset, setOffset, limit }) {
  const items = data.items || [];
  const total = data.total || 0;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{total}件の欠損データ件数</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 pr-3 text-xs font-medium text-gray-500">ID</th>
              <th className="py-2 pr-3 text-xs font-medium text-gray-500">データ名</th>
              <th className="py-2 pr-3 text-xs font-medium text-gray-500 text-right">充足率</th>
              <th className="py-2 pr-3 text-xs font-medium text-gray-500 text-right">欠損数</th>
              <th className="py-2 text-xs font-medium text-gray-500">欠損項目</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-3 text-gray-400 tabular-nums">{e.id}</td>
                <td className="py-2 pr-3 text-gray-800 truncate max-w-[200px]">{e.title}</td>
                <td className="py-2 pr-3 text-right">
                  <span className={`tabular-nums font-medium ${e.completenessScore >= 70 ? "text-emerald-600" : e.completenessScore >= 40 ? "text-amber-600" : "text-red-500"}`}>
                    {e.completenessScore}%
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-600 tabular-nums">{e.missingCount}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {e.missing.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">{m}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} offset={offset} setOffset={setOffset} limit={limit} />
    </div>
  );
}

/* ========== Reviews ========== */
function ReviewsView({ data, offset, setOffset, limit }) {
  const items = data.items || [];
  const total = data.total || 0;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{total}件の要確認口コミ</p>
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-400 text-xs">#{r.id}</span>
              <span className="text-gray-700 text-sm font-medium truncate">{r.event_title || `Event #${r.event_id}`}</span>
              <div className="flex gap-1 ml-auto">
                {r.flags.map((f, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">{f.label}</span>
                ))}
              </div>
            </div>
            {r.review_title && <p className="text-xs text-gray-600 font-medium">{r.review_title}</p>}
            <p className="text-xs text-gray-500 truncate">{r.review_body || "(本文なし)"}</p>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
              <span>{r.nickname || "匿名"}</span>
              <span>{r.created_at?.slice(0, 10)}</span>
              <span className={`px-1 py-0.5 rounded ${r.status === "published" ? "bg-green-50 text-green-600" : r.status === "pending" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"}`}>
                {r.status || "published"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <Pagination total={total} offset={offset} setOffset={setOffset} limit={limit} />
    </div>
  );
}

/* ========== Photos ========== */
function PhotosView({ data, offset, setOffset, limit }) {
  const items = data.items || [];
  const total = data.total || 0;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{total}件の要確認写真</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded shrink-0 overflow-hidden">
              {p.image_url && <img src={p.image_url} alt={p.alt_text || ""} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 truncate">{p.event_title || `Event #${p.event_id}`}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.flags.map((f, i) => (
                  <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] ${f.type === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                    {f.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{p.image_type || "未分類"} / {p.created_at?.slice(0, 10)}</p>
            </div>
          </div>
        ))}
      </div>
      <Pagination total={total} offset={offset} setOffset={setOffset} limit={limit} />
    </div>
  );
}

/* ========== Results ========== */
function ResultsView({ data, offset, setOffset, limit }) {
  const items = data.items || [];
  const total = data.total || 0;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{total}件の要確認結果データ</p>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.eventId} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-xs">#{r.eventId}</span>
              <span className="text-gray-800 text-sm font-medium truncate">{r.eventTitle || `Event #${r.eventId}`}</span>
              <span className="text-xs text-gray-400 ml-auto">{r.totalResults}件</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.summary.noBib > 0 && <IssueTag label={`ゼッケンなし: ${r.summary.noBib}`} />}
              {r.summary.noRank > 0 && <IssueTag label={`順位なし: ${r.summary.noRank}`} />}
              {r.summary.noCategory > 0 && <IssueTag label={`カテゴリなし: ${r.summary.noCategory}`} />}
              {r.summary.noGender > 0 && <IssueTag label={`性別なし: ${r.summary.noGender}`} />}
              {r.summary.abnormalTime > 0 && <IssueTag label={`異常タイム: ${r.summary.abnormalTime}`} color="red" />}
              {r.summary.rankGaps > 0 && <IssueTag label={`順位飛び: ${r.summary.rankGaps}`} />}
              {r.issues.map((iss, i) => (
                <IssueTag key={i} label={`${iss.label}: ${iss.detail}`} color="red" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Pagination total={total} offset={offset} setOffset={setOffset} limit={limit} />
    </div>
  );
}

/* ========== Scores ========== */
function ScoresView({ data, offset, setOffset, limit }) {
  const items = data.items || [];
  const total = data.total || 0;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{total}件（低スコア順）</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 pr-2 text-xs font-medium text-gray-500">ID</th>
              <th className="py-2 pr-3 text-xs font-medium text-gray-500">データ名</th>
              <th className="py-2 pr-2 text-xs font-medium text-gray-500 text-center">グレード</th>
              <th className="py-2 pr-2 text-xs font-medium text-gray-500 text-right">スコア</th>
              <th className="py-2 pr-2 text-xs font-medium text-gray-500 text-right">写真</th>
              <th className="py-2 pr-2 text-xs font-medium text-gray-500 text-right">口コミ</th>
              <th className="py-2 text-xs font-medium text-gray-500 text-right">結果</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-2 text-gray-400 tabular-nums">{e.id}</td>
                <td className="py-2 pr-3 text-gray-800 truncate max-w-[200px]">{e.title}</td>
                <td className="py-2 pr-2 text-center"><GradeBadge grade={e.grade} /></td>
                <td className="py-2 pr-2 text-right tabular-nums text-gray-700">{e.score}</td>
                <td className="py-2 pr-2 text-right tabular-nums text-gray-500">{e.photos}</td>
                <td className="py-2 pr-2 text-right tabular-nums text-gray-500">{e.reviews}</td>
                <td className="py-2 text-right tabular-nums text-gray-500">{e.results}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} offset={offset} setOffset={setOffset} limit={limit} />
    </div>
  );
}

/* ========== Shared Components ========== */
function KpiCard({ label, value, sub, color = "text-gray-900", onClick }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 ${onClick ? "cursor-pointer hover:border-blue-300 transition-colors" : ""}`}
      onClick={onClick}
    >
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function GradeBadge({ grade }) {
  const colors = {
    A: "bg-emerald-100 text-emerald-700",
    B: "bg-blue-100 text-blue-700",
    C: "bg-amber-100 text-amber-700",
    D: "bg-orange-100 text-orange-700",
    E: "bg-red-100 text-red-700",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${colors[grade] || "bg-gray-100 text-gray-600"}`}>{grade}</span>;
}

function IssueTag({ label, color = "amber" }) {
  const cls = color === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] ${cls}`}>{label}</span>;
}

function CoverageRow({ label, has, total }) {
  const pct = total > 0 ? Math.round((has / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500 tabular-nums">{has}/{total} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Pagination({ total, offset, setOffset, limit }) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40">
        前へ
      </button>
      <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
      <button onClick={() => setOffset(offset + limit)} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40">
        次へ
      </button>
    </div>
  );
}
