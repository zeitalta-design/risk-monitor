"use client";
import { useState, useEffect } from "react";

const PLACEMENT_LABELS = {
  standard: "通常公開",
  featured: "注目公開",
  beginner: "初心者向け公開",
  deadline: "締切間近公開",
  popular: "人気公開",
};

const PLACEMENT_COLORS = {
  standard: "bg-gray-100 text-gray-700 border-gray-200",
  featured: "bg-amber-50 text-amber-800 border-amber-200",
  beginner: "bg-green-50 text-green-800 border-green-200",
  deadline: "bg-red-50 text-red-800 border-red-200",
  popular: "bg-blue-50 text-blue-800 border-blue-200",
};

const PLACEMENT_ACCENTS = {
  standard: "border-gray-300",
  featured: "border-amber-400",
  beginner: "border-green-400",
  deadline: "border-red-400",
  popular: "border-blue-400",
};

const PRODUCT_DESC = {
  featured: "幅広く認知を増やしたいリスク情報向け",
  beginner: "初参加者を増やしたいリスク情報向け",
  deadline: "締切前に短期集客したいリスク情報向け",
  popular: "人気導線の中で露出したいリスク情報向け",
  standard: "基本公開（無料）",
};

const PRODUCT_ICONS = {
  featured: "★",
  beginner: "🔰",
  deadline: "⏰",
  popular: "🔥",
  standard: "—",
};

export default function PlacementAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [filterPlacement, setFilterPlacement] = useState("");
  const [addForm, setAddForm] = useState({ eventId: "", placement: "featured" });
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState("products"); // products | events | manage

  useEffect(() => {
    fetchData();
  }, [days, filterPlacement]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), limit: "50" });
      if (filterPlacement) params.set("placement", filterPlacement);
      const res = await fetch(`/api/admin/placement-analytics?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlacement(e) {
    e.preventDefault();
    if (!addForm.eventId || !addForm.placement) return;
    setAdding(true);
    try {
      await fetch("/api/admin/placement-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          eventId: parseInt(addForm.eventId, 10),
          placement: addForm.placement,
        }),
      });
      setAddForm({ eventId: "", placement: "featured" });
      fetchData();
    } catch {} finally {
      setAdding(false);
    }
  }

  async function handleEndPlacement(eventId, placement) {
    if (!confirm(`データID ${eventId} の「${PLACEMENT_LABELS[placement]}」を終了しますか？`)) return;
    try {
      await fetch("/api/admin/placement-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", eventId, placement }),
      });
      fetchData();
    } catch {}
  }

  // 成功事例: クリック増加率の高い順
  const successCases = (data?.summary || [])
    .filter((r) => r.clickChange > 0 || r.clicks > 0)
    .sort((a, b) => (b.clickChange || 0) - (a.clickChange || 0));

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">公開効果レポート</h1>
        <p className="text-sm text-gray-500 mt-1">
          公開プランごとの集客効果を可視化 · 営業提案にそのまま使えます
        </p>
      </div>

      {/* 期間選択 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-600">分析期間</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  days === d ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d}日間
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "products", label: "商品別効果" },
          { key: "events", label: "データ別レポート" },
          { key: "manage", label: "公開管理" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[1px] ${
              tab === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton /> : (
        <>
          {/* ── 商品別効果タブ ── */}
          {tab === "products" && (
            <div className="space-y-8">
              {/* 商品カード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {["featured", "beginner", "deadline", "popular"].map((p) => {
                  const avg = (data?.averages || []).find((a) => a.placement === p);
                  const summaryForP = (data?.summary || []).filter((s) => s.placement === p);
                  const avgClickChange = summaryForP.length > 0
                    ? Math.round(summaryForP.reduce((s, r) => s + (r.clickChange || 0), 0) / summaryForP.length * 10) / 10
                    : null;
                  const avgCtrChange = summaryForP.length > 0
                    ? Math.round(summaryForP.reduce((s, r) => s + (r.ctrChange || 0), 0) / summaryForP.length * 10) / 10
                    : null;

                  return (
                    <div key={p} className={`bg-white rounded-xl border-2 ${PLACEMENT_ACCENTS[p]} p-5 relative overflow-hidden`}>
                      {/* ヘッダー */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">{PRODUCT_ICONS[p]}</span>
                        <div>
                          <h3 className="font-extrabold text-gray-900 text-sm">{PLACEMENT_LABELS[p]}</h3>
                          <p className="text-[11px] text-gray-500">{PRODUCT_DESC[p]}</p>
                        </div>
                      </div>

                      {/* メイン指標: クリック増加率 */}
                      {avgClickChange !== null ? (
                        <div className="mb-4">
                          <p className="text-[10px] text-gray-500 font-bold mb-0.5">平均クリック増加率</p>
                          <p className={`text-3xl font-extrabold tabular-nums ${
                            avgClickChange > 0 ? "text-green-600" : avgClickChange < 0 ? "text-red-500" : "text-gray-400"
                          }`}>
                            {avgClickChange > 0 ? "+" : ""}{avgClickChange}%
                          </p>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <p className="text-[10px] text-gray-500 font-bold mb-0.5">平均クリック増加率</p>
                          <p className="text-lg font-bold text-gray-300">データ収集中</p>
                        </div>
                      )}

                      {/* 詳細指標 */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">公開データ件数</span>
                          <span className="font-extrabold text-gray-800">{avg?.eventCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">合計表示回数</span>
                          <span className="font-extrabold text-gray-800">{(avg?.totalImpressions || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">合計クリック数</span>
                          <span className="font-extrabold text-gray-800">{(avg?.totalClicks || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">平均CTR</span>
                          <span className="font-extrabold text-blue-700">{avg?.avgCtr || 0}%</span>
                        </div>
                        {avgCtrChange !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">CTR改善率</span>
                            <ChangeCell value={avgCtrChange} />
                          </div>
                        )}
                      </div>

                      {/* 効果ラベル */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <EffectLabel clickChange={avgClickChange} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 成功事例一覧 */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-gray-900">成功事例</h3>
                    <p className="text-xs text-gray-500 mt-0.5">公開効果が高かったリスク情報（クリック増加率順）</p>
                  </div>
                  <select
                    value={filterPlacement}
                    onChange={(e) => setFilterPlacement(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="">全プラン</option>
                    {["featured", "beginner", "deadline", "popular"].map((p) => (
                      <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                {successCases.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    まだ効果データがありません。公開を追加するとデータが蓄積されます。
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {successCases.slice(0, 10).map((row, i) => (
                      <div key={`${row.eventId}-${row.placement}-${i}`} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PLACEMENT_COLORS[row.placement]}`}>
                                {row.placementLabel}
                              </span>
                              <EffectLabel clickChange={row.clickChange} small />
                            </div>
                            <p className="font-bold text-gray-800 text-sm truncate">{row.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              ID: {row.eventId} · 公開開始: {formatDate(row.startedAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xl font-extrabold tabular-nums ${
                              (row.clickChange || 0) > 0 ? "text-green-600" : "text-gray-400"
                            }`}>
                              {row.clickChange > 0 ? "+" : ""}{row.clickChange || 0}%
                            </p>
                            <p className="text-[10px] text-gray-500">クリック増加</p>
                          </div>
                        </div>
                        {/* 公開前後比較 */}
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <BeforeAfterCell
                            label="表示回数"
                            before={row.prevImpressions}
                            after={row.impressions}
                            change={row.impressionChange}
                          />
                          <BeforeAfterCell
                            label="クリック数"
                            before={row.prevClicks}
                            after={row.clicks}
                            change={row.clickChange}
                          />
                          <BeforeAfterCell
                            label="CTR"
                            before={row.prevCtr}
                            after={row.ctr}
                            change={row.ctrChange}
                            suffix="%"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── データ別レポートタブ ── */}
          {tab === "events" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-900">データ別公開効果</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    比較: 直近{days}日 vs 前{days}日
                  </p>
                </div>
                <select
                  value={filterPlacement}
                  onChange={(e) => setFilterPlacement(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
                >
                  <option value="">全プラン</option>
                  {["featured", "beginner", "deadline", "popular"].map((p) => (
                    <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                {!data?.summary || data.summary.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    公開データがありません。「公開管理」タブからリスク情報を追加してください。
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-5 py-3 font-bold text-gray-600 text-xs">データ名</th>
                        <th className="text-center px-3 py-3 font-bold text-gray-600 text-xs">プラン</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">表示</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">クリック</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">CTR</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">表示増減</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">クリック増減</th>
                        <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">判定</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.summary.map((row, i) => (
                        <tr key={`${row.eventId}-${row.placement}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-800 truncate max-w-[220px]">{row.title}</p>
                            <p className="text-[10px] text-gray-400">ID: {row.eventId}</p>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PLACEMENT_COLORS[row.placement]}`}>
                              {row.placementLabel}
                            </span>
                          </td>
                          <td className="text-right px-3 py-3 font-bold tabular-nums">
                            {row.impressions.toLocaleString()}
                          </td>
                          <td className="text-right px-3 py-3 font-bold tabular-nums">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="text-right px-3 py-3 font-bold text-blue-700 tabular-nums">
                            {row.ctr}%
                          </td>
                          <td className="text-right px-3 py-3">
                            <ChangeCell value={row.impressionChange} />
                          </td>
                          <td className="text-right px-3 py-3">
                            <ChangeCell value={row.clickChange} />
                          </td>
                          <td className="text-center px-3 py-3">
                            <EffectLabel clickChange={row.clickChange} small />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── 公開管理タブ ── */}
          {tab === "manage" && (
            <div className="space-y-6">
              {/* 公開追加フォーム */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-extrabold text-gray-900">公開プランを追加</h3>
                  <p className="text-xs text-gray-500 mt-0.5">データIDと公開プランを指定して追加</p>
                </div>
                <form onSubmit={handleAddPlacement} className="px-5 py-4 flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">データID</label>
                    <input
                      type="number"
                      value={addForm.eventId}
                      onChange={(e) => setAddForm((p) => ({ ...p, eventId: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28"
                      placeholder="123"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">公開プラン</label>
                    <select
                      value={addForm.placement}
                      onChange={(e) => setAddForm((p) => ({ ...p, placement: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      {Object.entries(PLACEMENT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-1.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {adding ? "追加中..." : "追加"}
                  </button>
                </form>
              </div>

              {/* 現在の公開一覧 */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-extrabold text-gray-900">現在の公開一覧</h3>
                </div>
                <div className="overflow-x-auto">
                  {!data?.summary || data.summary.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      公開中のリスク情報はありません
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-5 py-3 font-bold text-gray-600 text-xs">データ名</th>
                          <th className="text-center px-3 py-3 font-bold text-gray-600 text-xs">プラン</th>
                          <th className="text-left px-3 py-3 font-bold text-gray-600 text-xs">公開開始</th>
                          <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">表示</th>
                          <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">クリック</th>
                          <th className="text-right px-3 py-3 font-bold text-gray-600 text-xs">CTR</th>
                          <th className="text-center px-3 py-3 font-bold text-gray-600 text-xs">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.summary.map((row, i) => (
                          <tr key={`${row.eventId}-${row.placement}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="font-bold text-gray-800 truncate max-w-[220px]">{row.title}</p>
                              <p className="text-[10px] text-gray-400">ID: {row.eventId}</p>
                            </td>
                            <td className="text-center px-3 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PLACEMENT_COLORS[row.placement]}`}>
                                {row.placementLabel}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600">{formatDate(row.startedAt)}</td>
                            <td className="text-right px-3 py-3 font-bold tabular-nums">{row.impressions.toLocaleString()}</td>
                            <td className="text-right px-3 py-3 font-bold tabular-nums">{row.clicks.toLocaleString()}</td>
                            <td className="text-right px-3 py-3 font-bold text-blue-700 tabular-nums">{row.ctr}%</td>
                            <td className="text-center px-3 py-3">
                              <button
                                onClick={() => handleEndPlacement(row.eventId, row.placement)}
                                className="text-[10px] text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                              >
                                終了
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── サブコンポーネント ───

function BeforeAfterCell({ label, before, after, change, suffix = "" }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-500 font-bold mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xs text-gray-400 tabular-nums">{before}{suffix}</span>
        <span className="text-[10px] text-gray-300">→</span>
        <span className="text-sm font-extrabold text-gray-800 tabular-nums">{after}{suffix}</span>
      </div>
      {change !== null && change !== undefined && (
        <p className={`text-[11px] font-extrabold tabular-nums mt-0.5 ${
          change > 0 ? "text-green-600" : change < 0 ? "text-red-500" : "text-gray-400"
        }`}>
          {change > 0 ? "+" : ""}{change}%
        </p>
      )}
    </div>
  );
}

function ChangeCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-300">—</span>;
  }
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <span className={`text-xs font-extrabold tabular-nums ${
      isZero ? "text-gray-400" :
      isPositive ? "text-green-600" : "text-red-500"
    }`}>
      {isPositive ? "+" : ""}{value}%
    </span>
  );
}

function EffectLabel({ clickChange, small = false }) {
  let label, color;
  if (clickChange === null || clickChange === undefined) {
    label = "計測中";
    color = "bg-gray-100 text-gray-500";
  } else if (clickChange >= 50) {
    label = "効果あり";
    color = "bg-green-100 text-green-800";
  } else if (clickChange >= 0) {
    label = "横ばい";
    color = "bg-yellow-100 text-yellow-800";
  } else {
    label = "要改善";
    color = "bg-red-100 text-red-700";
  }
  return (
    <span className={`${small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"} font-bold rounded ${color}`}>
      {label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 h-56" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 h-64" />
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
