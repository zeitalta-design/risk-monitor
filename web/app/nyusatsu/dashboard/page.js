"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import MiniBarChart from "@/components/nyusatsu/analytics/MiniBarChart";

export const dynamic = "force-dynamic";

function formatAmount(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(1)}兆円`;
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}億円`;
  if (amount >= 10_000) return `${(amount / 10_000).toFixed(0)}万円`;
  return `${amount.toLocaleString()}円`;
}

function formatCount(n) {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function NyusatsuDashboardPage() {
  const [by, setBy] = useState("entity"); // entity | cluster | issuer
  const [metric, setMetric] = useState("count"); // count | amount
  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineMetric, setTimelineMetric] = useState("count"); // count | amount

  // Ranking 取得
  useEffect(() => {
    setRankingLoading(true);
    const url = `/api/nyusatsu/analytics/ranking?by=${by}&metric=${metric}&limit=20`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setRanking(d.items || []))
      .catch(() => setRanking([]))
      .finally(() => setRankingLoading(false));
  }, [by, metric]);

  // Timeline 取得（全体、月次）
  useEffect(() => {
    setTimelineLoading(true);
    fetch(`/api/nyusatsu/analytics/timeline?granularity=month`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.items || []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  }, []);

  const timelineItems = useMemo(() => {
    if (!timeline.length) return [];
    return timeline.map((t) => ({
      label: t.period,
      value: timelineMetric === "amount" ? (t.total_amount || 0) : t.total_awards,
      sub: timelineMetric === "amount"
        ? formatAmount(t.total_amount || 0)
        : `${formatCount(t.total_awards)}件`,
    }));
  }, [timeline, timelineMetric]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <nav className="text-sm text-[#666] mb-4">
        <Link href="/" className="hover:underline">HOME</Link>
        <span className="mx-1">/</span>
        <Link href="/nyusatsu" className="hover:underline">入札</Link>
        <span className="mx-1">/</span>
        <span className="text-[#333] font-medium">ダッシュボード</span>
      </nav>

      <h1 className="text-2xl md:text-3xl font-bold text-[#2F9FD3] mb-2">
        落札者分析ダッシュボード
      </h1>
      <p className="text-sm text-[#666] mb-6">
        Resolver で表記ゆれを統合した集計。<strong>entity</strong> = 同一法人、<strong>cluster</strong> = 同一グループ（トヨタレンタリース等）。
      </p>

      {/* ================= Ranking ================= */}
      <section className="mb-12 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#2F9FD3]">落札ランキング TOP20</h2>
          <div className="flex items-center gap-4 text-sm">
            <ToggleGroup
              label="軸"
              value={by}
              onChange={setBy}
              options={[
                { v: "entity", l: "企業 (entity)" },
                { v: "cluster", l: "グループ (cluster)" },
                { v: "issuer", l: "発注機関" },
              ]}
            />
            <ToggleGroup
              label="指標"
              value={metric}
              onChange={setMetric}
              options={[
                { v: "count", l: "件数" },
                { v: "amount", l: "金額" },
              ]}
            />
          </div>
        </div>

        {rankingLoading ? (
          <p className="text-sm text-gray-500">読み込み中…</p>
        ) : ranking.length === 0 ? (
          <p className="text-sm text-gray-500">データがありません。先に resolve-entities.mjs の実行が必要です。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[#666] border-b border-[#DCEAF2]">
                <tr>
                  <th className="text-left py-2 w-12">#</th>
                  <th className="text-left py-2">{by === "issuer" ? "発注機関" : by === "cluster" ? "グループ" : "企業"}</th>
                  <th className="text-right py-2">件数</th>
                  <th className="text-right py-2">金額合計</th>
                  <th className="text-right py-2">発注者数</th>
                  <th className="text-right py-2">稼働月数</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => (
                  <tr key={`${by}-${row.group_id}-${i}`} className="border-b border-[#EDF7FC] hover:bg-[#F8FCFE]">
                    <td className="py-2 text-[#999]">{i + 1}</td>
                    <td className="py-2">
                      {by === "entity" && row.group_id != null ? (
                        <Link
                          href={`/nyusatsu/entities/${row.group_id}`}
                          className="text-[#2F9FD3] hover:underline font-medium"
                        >
                          {row.group_name || "(unnamed)"}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.group_name || "(unnamed)"}</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCount(row.total_awards)}</td>
                    <td className="py-2 text-right tabular-nums">{formatAmount(row.total_amount)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(row.unique_buyers)}</td>
                    <td className="py-2 text-right tabular-nums">{row.active_months || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= Timeline ================= */}
      <section className="mb-12 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#2F9FD3]">月別落札推移</h2>
          <ToggleGroup
            label="指標"
            value={timelineMetric}
            onChange={setTimelineMetric}
            options={[
              { v: "count", l: "件数" },
              { v: "amount", l: "金額" },
            ]}
          />
        </div>
        {timelineLoading ? (
          <p className="text-sm text-gray-500">読み込み中…</p>
        ) : (
          <MiniBarChart items={timelineItems} />
        )}
      </section>
    </main>
  );
}

function ToggleGroup({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#666]">{label}:</span>
      <div className="inline-flex rounded-md overflow-hidden border border-[#DCEAF2]">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              value === o.v
                ? "bg-[#2F9FD3] text-white"
                : "bg-white text-[#333] hover:bg-[#EDF7FC]"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
