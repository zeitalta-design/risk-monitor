"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import ConcentrationBadge from "@/components/nyusatsu/analytics/ConcentrationBadge";
import MiniBarChart from "@/components/nyusatsu/analytics/MiniBarChart";
import CrossDomainLinks from "@/components/core/CrossDomainLinks";
import OrganizationHubLink from "@/components/core/OrganizationHubLink";

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

  // Phase H Step 1: Entity Momentum Score（別 fetch で詳細読み込みをブロックしない）
  const [score, setScore] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(true);

  // Phase H Step 4: Deal Score（最近の案件 1 件に対して計算）
  const [dealScore, setDealScore] = useState(null);
  const [dealScoreLoading, setDealScoreLoading] = useState(false);

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

  useEffect(() => {
    setScoreLoading(true);
    fetch(`/api/nyusatsu/analytics/entities/${id}/score`)
      .then((r) => r.json())
      .then((d) => setScore(d?.error ? null : d))
      .catch(() => setScore(null))
      .finally(() => setScoreLoading(false));
  }, [id]);

  // 最新案件の id が分かり次第 Deal Score を取得（data.recent_deals[0].id）
  const sampleDealId = data?.recent_deals?.[0]?.id ?? null;
  useEffect(() => {
    if (!sampleDealId) { setDealScore(null); return; }
    setDealScoreLoading(true);
    fetch(`/api/nyusatsu/analytics/deal-score?entityId=${id}&resultId=${sampleDealId}`)
      .then((r) => r.json())
      .then((d) => setDealScore(d?.error ? null : d))
      .catch(() => setDealScore(null))
      .finally(() => setDealScoreLoading(false));
  }, [id, sampleDealId]);

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

  const { entity, summary, timeline, buyers, aliases, cluster_mates,
          amount_bands, category_top, yearly_stats } = data;

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
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="総落札件数" value={formatCount(summary.total_awards)} />
        <MetricCard label="総落札金額" value={formatAmount(summary.total_amount)} />
        <MetricCard label="平均落札額" value={formatAmount(summary.avg_amount || 0)} />
        <MetricCard label="稼働月数"   value={`${summary.active_months} か月`} />
      </section>

      {/* ================= Phase H Step 1: Entity Momentum Score ================= */}
      <section className="mb-6">
        <EntityScoreCard score={score} loading={scoreLoading} />
      </section>

      {/* ================= Phase H Step 4: Deal Score（最新案件のサンプル判定） ================= */}
      {sampleDealId && (
        <section className="mb-6">
          <DealScoreCard data={dealScore} loading={dealScoreLoading} />
        </section>
      )}

      {/* ================= Step 1 受注傾向サマリー ================= */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <EntityBandsCard bands={amount_bands || []} />
        <EntityCategoryCard items={category_top || []} />
        <EntityYearlyCard items={yearly_stats || []} />
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

      {/* ================= 他DB情報（Phase 2 Priority 1） ================= */}
      <CrossDomainLinks
        lookupKey={entity.corporate_number || entity.normalized_key || entity.canonical_name}
        skipDomain="nyusatsu"
      />

      {/* 共通企業詳細（cross-domain hub）への導線 */}
      <OrganizationHubLink
        organizationId={entity.organization_id}
        corp={entity.corporate_number}
        name={entity.canonical_name}
      />

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

// ─── Phase H Step 4: Deal Score UI ────────────────────────────
// 最近の案件 1 件に対する判定。大スコア + 3 component バー + reasons 2〜3 行。
// 案件タイトル・category・金額を併記して「何を判定したか」を明示する。
function DealScoreCard({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">Deal Score 計算中…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">Deal Score を取得できませんでした</p>
      </div>
    );
  }
  const s = data.score;
  const tone =
    s >= 80 ? { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" } :
    s >= 60 ? { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" } :
    s >= 40 ? { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" } :
              { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };

  // Phase H Step 5: issuer_key / type から補助表示を組み立て
  const issuerKey     = data.deal?.issuer_key || null;
  const issuerType    = data.deal?.issuer_key_type || null;
  const issuerLabel   = data.sources?.issuer?.label || null;
  const issuerInputs  = data.sources?.issuer?.inputs || null;

  let issuerSubText;
  if (!issuerKey) {
    issuerSubText = "issuer 識別不能 → 中立扱い";
  } else if (issuerInputs) {
    const count = issuerInputs.count || 0;
    const last  = issuerInputs.last_awarded_year || "?";
    const share = issuerInputs.share_ratio != null
      ? `${(issuerInputs.share_ratio * 100).toFixed(1)}%`
      : "?";
    issuerSubText = `${issuerLabel ? `「${issuerLabel}」 ` : ""}${count}件 / 直近 ${last} / share ${share}`;
  } else {
    issuerSubText = issuerLabel ? `「${issuerLabel}」` : "";
  }

  const comps = [
    { key: "entity_score",          label: "企業",     sub: scoreSub(data.sources?.entity?.label) },
    { key: "market_score",          label: "市場",     sub: scoreSub(data.sources?.market?.label) },
    { key: "category_score",        label: "業種",     sub: data.deal.category
        ? `${data.deal.category}: ${scoreSub(data.sources?.category?.label) || "中立"}`
        : "category なし" },
    { key: "issuer_affinity_score", label: "issuer",   sub: issuerSubText },
  ];

  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-[#2F9FD3]">Deal Score（最近の案件サンプル）</h2>
        <span className="text-xs text-gray-500">
          {data.years?.prev && data.years?.current ? `${data.years.prev} → ${data.years.current} の比較` : null}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 mb-4 truncate" title={data.deal.title || ""}>
        <span className="text-gray-400">対象案件:</span>{" "}
        <span className="text-[#333] font-medium">{data.deal.title || "(no title)"}</span>
        {data.deal.award_date && <span className="ml-2 text-gray-500">{data.deal.award_date}</span>}
        {data.deal.award_amount != null && <span className="ml-2 text-gray-500">{formatAmount(data.deal.award_amount)}</span>}
        {data.deal.category && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#EDF7FC] text-[#2F9FD3]">{data.deal.category}</span>}
        {issuerKey && issuerType === "dept_hint" && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-[#EDF7FC] text-[#2F9FD3]" title="issuer_dept_hint（正式名ではなく補助値）">
            issuerヒント: {issuerKey}
          </span>
        )}
        {issuerKey && issuerType === "code" && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono" title="issuer_code（元CSVコード、意味は粗い）">
            code: {issuerKey}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 flex flex-col items-start">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-bold tabular-nums" style={{ color: tone.fg }}>{s}</span>
            <span className="text-sm text-gray-500">/ 100</span>
          </div>
          <span
            className="mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded border"
            style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
          >
            {data.label}
          </span>
        </div>

        <div className="md:col-span-2 space-y-2">
          {comps.map((c) => {
            const v = data.components[c.key];
            const value = v ?? 50;
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#333]">
                    {c.label}
                    {c.sub && <span className="text-gray-400 ml-2">{c.sub}</span>}
                  </span>
                  <span className="tabular-nums text-[#333] font-medium">{value}</span>
                </div>
                <div className="mt-1 h-2 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full" style={{ width: `${value}%`, backgroundColor: tone.fg }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data.reasons?.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-[#333]">
          {data.reasons.map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-gray-400 shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-gray-400 mt-3">
        * 重み: 企業 {(data.weights.entity_score*100).toFixed(0)}% /
        市場 {(data.weights.market_score*100).toFixed(0)}% /
        業種 {(data.weights.category_score*100).toFixed(0)}% /
        issuer {((data.weights.issuer_affinity_score ?? 0)*100).toFixed(0)}%。
        取得不能な component は中立 50 として合成。
      </p>
    </div>
  );
}

function scoreSub(label) {
  return label ? `「${label}」` : null;
}

// ─── Phase H Step 1: Entity Momentum Score UI ────────────────
// 左に大きなスコア、右に内訳（各 component 0..100 のバー）。
// ラベルは score >= 80 非常に強い / >=60 成長中 / >=40 安定 / 下降傾向。
function EntityScoreCard({ score, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">スコア計算中…</p>
      </div>
    );
  }
  if (!score) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">スコアなし</p>
      </div>
    );
  }
  const s = score.score;
  // score 帯ごとのトーン（ラベル色）
  const tone =
    s >= 80 ? { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" } :
    s >= 60 ? { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" } :
    s >= 40 ? { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" } :
              { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };

  const comps = [
    { key: "rank_momentum",   label: "順位変動", sub: formatRankSub(score.inputs)   },
    { key: "volume_growth",   label: "件数成長", sub: formatVolumeSub(score.inputs) },
    { key: "amount_strength", label: "金額強度", sub: formatAmountSub(score.inputs) },
  ];

  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-[#2F9FD3]">企業スコア</h2>
        <span className="text-xs text-gray-500">
          {score.year_prev} → {score.year_current} の比較
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* 左: 大スコア */}
        <div className="md:col-span-1 flex flex-col items-start">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-bold tabular-nums" style={{ color: tone.fg }}>{s}</span>
            <span className="text-sm text-gray-500">/ 100</span>
          </div>
          <span
            className="mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded border"
            style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
          >
            {score.label}
          </span>
        </div>

        {/* 右: 内訳 */}
        <div className="md:col-span-2 space-y-2">
          {comps.map((c) => {
            const v = score.components[c.key];
            const isNull = v == null;
            const value = isNull ? 50 : v;
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#333]">
                    {c.label}
                    <span className="text-gray-400 ml-2">{c.sub}</span>
                  </span>
                  <span className={`tabular-nums ${isNull ? "text-gray-400" : "text-[#333] font-medium"}`}>
                    {isNull ? "測定不能" : `${v}`}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${value}%`,
                      backgroundColor: isNull ? "#CBD5E1" : tone.fg,
                      opacity: isNull ? 0.5 : 1,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-gray-400 pt-1">
            * 重み: 順位変動 {(score.weights.rank_momentum*100).toFixed(0)}% /
            件数成長 {(score.weights.volume_growth*100).toFixed(0)}% /
            金額強度 {(score.weights.amount_strength*100).toFixed(0)}%。
            測定不能は中立 50 として合成。
          </p>
        </div>
      </div>
    </div>
  );
}

function formatRankSub(i) {
  if (i.rank_current == null) return `TOP${i.rank_lookup_limit}圏外`;
  if (i.rank_prev == null)    return `#${i.rank_current}（前年圏外）`;
  const d = i.rank_diff;
  const arrow = d > 0 ? `↑${d}` : d < 0 ? `↓${Math.abs(d)}` : "±0";
  return `#${i.rank_current} ← #${i.rank_prev} (${arrow})`;
}
function formatVolumeSub(i) {
  if (i.count_prev <= 0) return `${formatCount(i.count_current)}件 / 前年0件`;
  const g = ((i.count_current - i.count_prev) / i.count_prev) * 100;
  const sign = g >= 0 ? "+" : "";
  return `${formatCount(i.count_current)}件 (${sign}${g.toFixed(0)}%)`;
}
function formatAmountSub(i) {
  if (!i.avg_amount_current) return "平均金額不明";
  return `平均 ${formatAmount(Math.round(i.avg_amount_current))}`;
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-4">
      <p className="text-xs text-[#666]">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-[#2F9FD3] mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Step 1 受注傾向サマリー UI ────────────────────

function EntityBandsCard({ bands }) {
  // 件数 > 0 のみ、count 降順で TOP3 を表示
  const top3 = [...(bands || [])].filter((b) => b.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#2F9FD3] mb-2">主な金額帯 TOP3</h3>
      {top3.length === 0 ? (
        <p className="text-xs text-gray-500">データなし</p>
      ) : (
        <ol className="space-y-1.5 text-xs">
          {top3.map((b, i) => (
            <li key={b.band} className="flex items-center justify-between gap-2">
              <span className="text-[#333]">
                <span className="inline-block w-4 text-gray-400 tabular-nums">{i + 1}.</span>
                {b.band}
              </span>
              <span className="text-gray-500 tabular-nums">{formatCount(b.count)}件</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EntityCategoryCard({ items }) {
  const top3 = (items || []).slice(0, 3);
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#2F9FD3] mb-2">主な業種 TOP3</h3>
      {top3.length === 0 ? (
        <p className="text-xs text-gray-500">データなし</p>
      ) : (
        <ol className="space-y-1.5 text-xs">
          {top3.map((c, i) => (
            <li key={c.category} className="flex items-center justify-between gap-2">
              <span className="text-[#333] truncate">
                <span className="inline-block w-4 text-gray-400 tabular-nums">{i + 1}.</span>
                {c.category}
              </span>
              <span className="text-gray-500 tabular-nums shrink-0">{formatCount(c.count)}件</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EntityYearlyCard({ items }) {
  // 直近 5 年だけ
  const recent = [...(items || [])].slice(-5);
  const max = recent.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#2F9FD3] mb-2">年度別 件数（直近5年）</h3>
      {recent.length === 0 ? (
        <p className="text-xs text-gray-500">データなし</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {recent.map((y) => (
            <li key={y.year}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[#333] font-medium">{y.year}</span>
                <span className="text-gray-500 tabular-nums">{formatCount(y.count)}件</span>
              </div>
              <div className="h-1 bg-gray-100 rounded overflow-hidden">
                <div className="h-full bg-[#2F9FD3]" style={{ width: max > 0 ? `${(y.count / max * 100).toFixed(1)}%` : "0%" }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
