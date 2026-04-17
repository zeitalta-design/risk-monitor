"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import ConcentrationBadge from "@/components/nyusatsu/analytics/ConcentrationBadge";
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

export default function EntityDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timelineMetric, setTimelineMetric] = useState("count");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nyusatsu/analytics/entities/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <main className="max-w-6xl mx-auto px-4 py-12 text-center text-[#666]">読み込み中…</main>;
  }
  if (error || !data) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-red-600">エラー: {error || "データ取得失敗"}</p>
        <Link href="/nyusatsu/dashboard" className="text-[#2F9FD3] hover:underline">← ダッシュボードに戻る</Link>
      </main>
    );
  }

  const { entity, summary, timeline, buyers, aliases, cluster_mates } = data;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* パンくず */}
      <nav className="text-sm text-[#666] mb-4">
        <Link href="/" className="hover:underline">HOME</Link>
        <span className="mx-1">/</span>
        <Link href="/nyusatsu" className="hover:underline">入札</Link>
        <span className="mx-1">/</span>
        <Link href="/nyusatsu/dashboard" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <span className="text-[#333] font-medium">{entity.canonical_name}</span>
      </nav>

      {/* タイトル */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#2F9FD3]">{entity.canonical_name}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#666]">
          {entity.corporate_number && (
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
              法人番号 {entity.corporate_number}
            </span>
          )}
          {entity.prefecture && <span>📍 {entity.prefecture}</span>}
          {entity.cluster_id && (
            <span className="inline-flex items-center gap-1 bg-[#EDF7FC] text-[#2F9FD3] px-2 py-0.5 rounded border border-[#DCEAF2] text-xs">
              グループ: {entity.cluster_canonical_name} (size={entity.cluster_size})
            </span>
          )}
        </div>
      </header>

      {/* ================= 指標カード ================= */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricCard label="総落札件数" value={formatCount(summary.total_awards)} />
        <MetricCard label="総落札金額" value={formatAmount(summary.total_amount)} />
        <MetricCard label="稼働月数"   value={`${summary.active_months} か月`} />
        <MetricCard label="発注者数"   value={formatCount(summary.unique_buyers)} />
      </section>

      {/* ================= 集中度 ================= */}
      <section className="mb-8 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <h2 className="text-lg font-bold text-[#2F9FD3] mb-3">発注機関集中度</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-[#666] mr-2">件数ベース:</span>
            <ConcentrationBadge score={summary.concentration_count} label="件数集中度" />
          </div>
          <div>
            <span className="text-[#666] mr-2">金額ベース:</span>
            <ConcentrationBadge score={summary.concentration_amount} label="金額集中度" />
          </div>
          {summary.top_issuer && (
            <div className="text-[#666]">最大発注者: <span className="font-medium text-[#333]">{summary.top_issuer}</span></div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          HHI（ハーフィンダール指数、0–1）。<strong>1.0</strong>=完全1機関依存、<strong>0</strong>=完全分散。
        </p>
      </section>

      {/* ================= 主要発注機関 ================= */}
      <section className="mb-8 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <h2 className="text-lg font-bold text-[#2F9FD3] mb-3">主要発注機関 TOP10</h2>
        {buyers.length === 0 ? (
          <p className="text-sm text-gray-500">発注機関データなし</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[#666] border-b border-[#DCEAF2]">
                <tr>
                  <th className="text-left py-2">発注機関</th>
                  <th className="text-right py-2">件数</th>
                  <th className="text-right py-2">件数シェア</th>
                  <th className="text-right py-2">金額</th>
                  <th className="text-right py-2">金額シェア</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b, i) => (
                  <tr key={i} className="border-b border-[#EDF7FC]">
                    <td className="py-2">{b.issuer_name}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(b.count)}</td>
                    <td className="py-2 text-right tabular-nums text-[#666]">
                      {(b.share_count * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatAmount(b.total_amount)}</td>
                    <td className="py-2 text-right tabular-nums text-[#666]">
                      {(b.share_amount * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= 月次推移 ================= */}
      <section className="mb-8 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-[#2F9FD3]">月別推移</h2>
          <div className="inline-flex rounded-md overflow-hidden border border-[#DCEAF2] text-xs">
            <button
              onClick={() => setTimelineMetric("count")}
              className={`px-3 py-1.5 ${timelineMetric === "count" ? "bg-[#2F9FD3] text-white" : "bg-white text-[#333]"}`}
            >
              件数
            </button>
            <button
              onClick={() => setTimelineMetric("amount")}
              className={`px-3 py-1.5 ${timelineMetric === "amount" ? "bg-[#2F9FD3] text-white" : "bg-white text-[#333]"}`}
            >
              金額
            </button>
          </div>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500">月次データなし</p>
        ) : (
          <MiniBarChart
            items={timeline.map((t) => ({
              label: t.period,
              value: timelineMetric === "amount" ? (t.total_amount || 0) : t.total_awards,
              sub: timelineMetric === "amount"
                ? formatAmount(t.total_amount || 0)
                : `${formatCount(t.total_awards)}件`,
            }))}
          />
        )}
      </section>

      {/* ================= グループ仲間 ================= */}
      {cluster_mates.length > 0 && (
        <section className="mb-8 bg-white border border-[#DCEAF2] rounded-xl p-5">
          <h2 className="text-lg font-bold text-[#2F9FD3] mb-3">同グループ企業</h2>
          <ul className="flex flex-wrap gap-2">
            {cluster_mates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/nyusatsu/entities/${c.id}`}
                  className="inline-block text-sm bg-[#EDF7FC] hover:bg-[#DCEAF2] text-[#2F9FD3] px-3 py-1 rounded border border-[#DCEAF2]"
                >
                  {c.canonical_name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ================= 表記ゆれ履歴 ================= */}
      {aliases.length > 0 && (
        <section className="mb-8 bg-white border border-[#DCEAF2] rounded-xl p-5">
          <h2 className="text-lg font-bold text-[#2F9FD3] mb-3">表記ゆれ履歴</h2>
          <p className="text-xs text-gray-500 mb-3">
            Resolver が統合した入力時の企業名バリエーションと出現回数。
          </p>
          <ul className="text-sm space-y-1">
            {aliases.map((a, i) => (
              <li key={i} className="flex items-center justify-between border-b border-[#EDF7FC] py-1">
                <span>{a.raw_name}</span>
                <span className="text-[#666] tabular-nums">×{a.seen_count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-4">
      <p className="text-xs text-[#666]">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-[#2F9FD3] mt-1 tabular-nums">{value}</p>
    </div>
  );
}
