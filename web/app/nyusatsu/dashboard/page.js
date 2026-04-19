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

// 年度切替オプション（最新 5 年 + 全期間）。"" は全期間。
const RANKING_YEAR_OPTIONS = ["", "2026", "2025", "2024", "2023", "2022"];

export default function NyusatsuDashboardPage() {
  const [by, setBy] = useState("entity"); // entity | cluster | issuer
  const [metric, setMetric] = useState("count"); // count | amount
  const [rankingYear, setRankingYear] = useState(""); // "" = 全期間
  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineMetric, setTimelineMetric] = useState("count"); // count | amount

  // Step 1 分析深掘り
  const [amountBands, setAmountBands] = useState([]);
  const [yearlyStats, setYearlyStats] = useState([]);
  const [categoryYear, setCategoryYear] = useState(null); // { categories, years, matrix }
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Step 2 分析深掘り: 業種 × 金額帯
  const [catBand, setCatBand] = useState(null);
  const [catBandLoading, setCatBandLoading] = useState(true);

  // Step 4: 金額帯 × 年度
  const [bandYear, setBandYear] = useState(null);
  const [bandYearLoading, setBandYearLoading] = useState(true);

  // Phase H Step 2: 市場スコア
  const [marketScore, setMarketScore] = useState(null);
  const [marketScoreLoading, setMarketScoreLoading] = useState(true);

  // Phase H Step 3: 業種別市場スコア
  const [categoryScore, setCategoryScore] = useState(null);
  const [categoryScoreLoading, setCategoryScoreLoading] = useState(true);

  // Step 3: ランキング変動（yearCurrent vs yearPrev）
  const [diffYearCurrent, setDiffYearCurrent] = useState("2025");
  const [diffYearPrev, setDiffYearPrev]       = useState("2024");
  const [diffData, setDiffData]               = useState(null);
  const [diffLoading, setDiffLoading]         = useState(true);

  // Ranking 取得（year フィルタあり）
  useEffect(() => {
    setRankingLoading(true);
    const yearQuery = rankingYear ? `&year=${rankingYear}` : "";
    const url = `/api/nyusatsu/analytics/ranking?by=${by}&metric=${metric}&limit=20${yearQuery}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setRanking(d.items || []))
      .catch(() => setRanking([]))
      .finally(() => setRankingLoading(false));
  }, [by, metric, rankingYear]);

  // Timeline 取得（全体、月次）
  useEffect(() => {
    setTimelineLoading(true);
    fetch(`/api/nyusatsu/analytics/timeline?granularity=month`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.items || []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  }, []);

  // Step 1 分析深掘り: 金額帯 / 年度別 / 業種×年度 を並列 fetch
  useEffect(() => {
    setAnalyticsLoading(true);
    Promise.all([
      fetch("/api/nyusatsu/analytics/amount-bands").then((r) => r.json()),
      fetch("/api/nyusatsu/analytics/yearly-stats").then((r) => r.json()),
      fetch("/api/nyusatsu/analytics/category-year?topCategories=8").then((r) => r.json()),
    ])
      .then(([a, y, c]) => {
        setAmountBands(a.items || []);
        setYearlyStats(y.items || []);
        setCategoryYear(c || null);
      })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  // Step 2: 業種 × 金額帯
  useEffect(() => {
    setCatBandLoading(true);
    fetch("/api/nyusatsu/analytics/category-band?topCategories=8")
      .then((r) => r.json())
      .then((d) => setCatBand(d || null))
      .catch(() => setCatBand(null))
      .finally(() => setCatBandLoading(false));
  }, []);

  // Step 4: 金額帯 × 年度
  useEffect(() => {
    setBandYearLoading(true);
    fetch("/api/nyusatsu/analytics/band-year")
      .then((r) => r.json())
      .then((d) => setBandYear(d || null))
      .catch(() => setBandYear(null))
      .finally(() => setBandYearLoading(false));
  }, []);

  // Phase H Step 2: 市場スコア
  useEffect(() => {
    setMarketScoreLoading(true);
    fetch("/api/nyusatsu/analytics/market-score")
      .then((r) => r.json())
      .then((d) => setMarketScore(d?.error ? null : d))
      .catch(() => setMarketScore(null))
      .finally(() => setMarketScoreLoading(false));
  }, []);

  // Phase H Step 3: 業種別市場スコア
  useEffect(() => {
    setCategoryScoreLoading(true);
    fetch("/api/nyusatsu/analytics/category-score?limit=8")
      .then((r) => r.json())
      .then((d) => setCategoryScore(d?.error ? null : d))
      .catch(() => setCategoryScore(null))
      .finally(() => setCategoryScoreLoading(false));
  }, []);

  // Step 3: ランキング変動
  useEffect(() => {
    setDiffLoading(true);
    const url = `/api/nyusatsu/analytics/ranking-diff?yearCurrent=${diffYearCurrent}&yearPrev=${diffYearPrev}&limit=200`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setDiffData(d || null))
      .catch(() => setDiffData(null))
      .finally(() => setDiffLoading(false));
  }, [diffYearCurrent, diffYearPrev]);

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

      {/* ================= Phase H Step 2: 市場スコア ================= */}
      <section className="mb-8">
        <MarketScoreCard score={marketScore} loading={marketScoreLoading} />
      </section>

      {/* ================= Phase H Step 3: 業種別市場スコア ================= */}
      <section className="mb-8">
        <CategoryScoreCard data={categoryScore} loading={categoryScoreLoading} />
      </section>

      {/* ================= Ranking ================= */}
      <section className="mb-12 bg-white border border-[#DCEAF2] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#2F9FD3]">
            落札ランキング TOP20
            {rankingYear && <span className="ml-2 text-xs text-gray-500 font-normal">（{rankingYear}年）</span>}
          </h2>
          <div className="flex items-center gap-4 text-sm flex-wrap">
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
            <ToggleGroup
              label="年度"
              value={rankingYear}
              onChange={setRankingYear}
              options={RANKING_YEAR_OPTIONS.map((y) => ({ v: y, l: y || "全期間" }))}
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

      {/* ================= Step 1 分析深掘り ================= */}
      <section className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <AmountBandsCard items={amountBands} loading={analyticsLoading} />
        <YearlyStatsCard items={yearlyStats} loading={analyticsLoading} />
        <CategoryYearCard data={categoryYear} loading={analyticsLoading} />
      </section>

      {/* ================= Step 2 分析深掘り: 業種 × 金額帯 ================= */}
      <section className="mb-12">
        <CategoryBandHeatmap data={catBand} loading={catBandLoading} />
      </section>

      {/* ================= Step 4 分析深掘り: 金額帯 × 年度 ================= */}
      <section className="mb-12">
        <BandYearHeatmap data={bandYear} loading={bandYearLoading} />
      </section>

      {/* ================= Step 3 分析深掘り: ランキング変動 ================= */}
      <section className="mb-12">
        <RankingDiffCard
          data={diffData}
          loading={diffLoading}
          yearCurrent={diffYearCurrent}
          yearPrev={diffYearPrev}
          onChangePair={(cur, prev) => {
            setDiffYearCurrent(cur);
            setDiffYearPrev(prev);
          }}
        />
      </section>
    </main>
  );
}

// ─── Step 1 分析深掘り UI ────────────────────────

function AmountBandsCard({ items, loading }) {
  const total = useMemo(() => items.reduce((s, r) => s + r.count, 0), [items]);
  const max   = useMemo(() => items.reduce((m, r) => Math.max(m, r.count), 0), [items]);
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <h2 className="text-base font-bold text-[#2F9FD3] mb-3">金額帯別 件数</h2>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2 tabular-nums">全件 {formatCount(total)}件</p>
          <ul className="space-y-1.5">
            {items.map((b) => (
              <li key={b.band} className="text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[#333]">{b.band}</span>
                  <span className="text-gray-500 tabular-nums">{formatCount(b.count)}件</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full bg-[#2F9FD3]" style={{ width: max > 0 ? `${(b.count / max * 100).toFixed(1)}%` : "0%" }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 mt-3">* NULL / 0 円は「不明」に分類</p>
        </>
      )}
    </div>
  );
}

function YearlyStatsCard({ items, loading }) {
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <h2 className="text-base font-bold text-[#2F9FD3] mb-3">年度別 推移（暦年）</h2>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">データなし</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[#888] border-b border-[#EDF7FC]">
              <tr>
                <th className="text-left py-1.5">年</th>
                <th className="text-right py-1.5">件数</th>
                <th className="text-right py-1.5">総額</th>
                <th className="text-right py-1.5">平均</th>
              </tr>
            </thead>
            <tbody>
              {items.map((y) => (
                <tr key={y.year} className="border-b border-[#F5FAFD]">
                  <td className="py-1.5 text-[#333] font-medium">{y.year}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCount(y.count)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatAmount(y.total_amount)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500">{formatAmount(y.avg_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryYearCard({ data, loading }) {
  const summary = useMemo(() => {
    if (!data?.matrix) return [];
    const byCat = new Map();
    for (const m of data.matrix) {
      const cur = byCat.get(m.category) || { category: m.category, count: 0, total_amount: 0 };
      cur.count += m.count;
      cur.total_amount += m.total_amount || 0;
      byCat.set(m.category, cur);
    }
    return (data.categories || []).map((c) => byCat.get(c) || { category: c, count: 0, total_amount: 0 });
  }, [data]);
  const totalCount = useMemo(() => summary.reduce((s, r) => s + r.count, 0), [summary]);
  const max = useMemo(() => summary.reduce((m, r) => Math.max(m, r.count), 0), [summary]);
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <h2 className="text-base font-bold text-[#2F9FD3] mb-3">業種カテゴリ（全期間）</h2>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : summary.length === 0 ? (
        <p className="text-sm text-gray-500">データなし</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2 tabular-nums">
            {data?.years?.length || 0}年分 / 全 {formatCount(totalCount)}件
          </p>
          <ul className="space-y-1.5">
            {summary.map((r) => (
              <li key={r.category} className="text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[#333] truncate">{r.category}</span>
                  <span className="text-gray-500 tabular-nums shrink-0 ml-2">{formatCount(r.count)}件</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full bg-[#2F9FD3]" style={{ width: max > 0 ? `${(r.count / max * 100).toFixed(1)}%` : "0%" }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 mt-3">* 元データ nyusatsu_results.category に依存。未分類は「未分類」。</p>
        </>
      )}
    </div>
  );
}

// Step 2: 業種 × 金額帯 ヒートマップ（CSS のみ、chart lib 不使用）
function CategoryBandHeatmap({ data, loading }) {
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-base font-bold text-[#2F9FD3]">業種 × 金額帯</h2>
        {data?.totals?.count != null && (
          <span className="text-xs text-gray-500 tabular-nums">全 {formatCount(data.totals.count)}件</span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3">行ごとの最大値を基準に濃淡を表示（その業種の中でどの金額帯に集中しているか）</p>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : !data || data.categories.length === 0 ? (
        <p className="text-sm text-gray-500">データなし</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: "2px 2px" }}>
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium py-1 pr-2 sticky left-0 bg-white z-10 min-w-[100px]">業種</th>
                {data.bands.map((b) => (
                  <th key={b} className="text-right font-medium py-1 px-1 whitespace-nowrap">{b}</th>
                ))}
                <th className="text-right font-medium py-1 pl-2">計</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => {
                const rowMax = c.cells.reduce((m, cell) => Math.max(m, cell.count), 0);
                return (
                  <tr key={c.category}>
                    <td className="py-1 pr-2 font-medium text-[#333] sticky left-0 bg-white z-10 truncate max-w-[120px]">
                      {c.category}
                    </td>
                    {c.cells.map((cell) => {
                      const intensity = rowMax > 0 ? cell.count / rowMax : 0;
                      // 0..1 → 薄い #EDF7FC (alpha 0) から濃い #2F9FD3 (alpha 1)
                      const bg = `rgba(47, 159, 211, ${(intensity * 0.85).toFixed(3)})`;
                      const fg = intensity > 0.55 ? "white" : "#333";
                      return (
                        <td
                          key={cell.band}
                          className="text-right py-1 px-1.5 tabular-nums whitespace-nowrap rounded"
                          style={{ backgroundColor: bg, color: fg }}
                          title={`${c.category} × ${cell.band}: ${formatCount(cell.count)}件`}
                        >
                          {cell.count > 0 ? formatCount(cell.count) : ""}
                        </td>
                      );
                    })}
                    <td className="text-right py-1 pl-2 tabular-nums font-medium text-[#333]">
                      {formatCount(c.totalCount)}
                    </td>
                  </tr>
                );
              })}
              {/* 列合計行 */}
              <tr className="border-t border-gray-200">
                <td className="py-1 pr-2 text-[#666] sticky left-0 bg-white z-10">計</td>
                {data.bands.map((b) => (
                  <td key={b} className="text-right py-1 px-1 tabular-nums text-[#666]">
                    {formatCount(data.totals?.byBand?.[b] || 0)}
                  </td>
                ))}
                <td className="text-right py-1 pl-2 tabular-nums text-[#333] font-medium">
                  {formatCount(data.totals?.count || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-3">* 金額帯は Step 1 と同一定義（9区分）。上位8カテゴリ以外は「その他」に集約。</p>
    </div>
  );
}

// Phase H Step 2: 市場スコアカード
// 左: 大スコア + ラベル、右: 3 component バー + inputs 表示。
// entity-score の意匠を踏襲しつつ「市場全体」の文脈に合わせた文言にする。
function MarketScoreCard({ score, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">市場スコア計算中…</p>
      </div>
    );
  }
  if (!score) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">市場スコアを取得できませんでした</p>
      </div>
    );
  }
  const s = score.score;
  // 帯別トーン。entity-score と揃える。
  const tone =
    s >= 80 ? { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" } :
    s >= 60 ? { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" } :
    s >= 40 ? { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" } :
              { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };

  const { count_current, count_prev, amount_current, amount_prev,
          premium_share_current, premium_share_prev } = score.inputs;
  const volGrowth = count_prev > 0 ? ((count_current - count_prev) / count_prev) * 100 : null;
  const amtGrowth = amount_prev > 0 ? ((amount_current - amount_prev) / amount_prev) * 100 : null;
  const premDiffPt = (premium_share_current != null && premium_share_prev != null)
    ? (premium_share_current - premium_share_prev) * 100
    : null;

  const comps = [
    {
      key: "volume_trend",
      label: "件数成長",
      sub: volGrowth == null
        ? `${formatCount(count_current)}件 / 前年 ${formatCount(count_prev)}件`
        : `${formatCount(count_current)}件 (${volGrowth >= 0 ? "+" : ""}${volGrowth.toFixed(1)}%)`,
    },
    {
      key: "amount_trend",
      label: "金額成長",
      sub: amtGrowth == null
        ? formatAmount(amount_current)
        : `${formatAmount(amount_current)} (${amtGrowth >= 0 ? "+" : ""}${amtGrowth.toFixed(1)}%)`,
    },
    {
      key: "premium_shift",
      label: "高額帯シフト",
      sub: (premium_share_current == null || premDiffPt == null)
        ? "高額帯データなし"
        : `${(premium_share_current * 100).toFixed(1)}% (${premDiffPt >= 0 ? "+" : ""}${premDiffPt.toFixed(1)}pt)`,
    },
  ];

  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-[#2F9FD3]">市場スコア</h2>
        <span className="text-xs text-gray-500">
          {score.years.prev} → {score.years.current} の比較
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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
            * 重み: 件数成長 {(score.weights.volume_trend*100).toFixed(0)}% /
            金額成長 {(score.weights.amount_trend*100).toFixed(0)}% /
            高額帯シフト {(score.weights.premium_shift*100).toFixed(0)}%。
            高額帯 = 5000万〜1億円 + 1億円以上。測定不能は中立 50 として合成。
          </p>
        </div>
      </div>
    </div>
  );
}

// Phase H Step 3: 業種別市場スコアカード
// 各行 = 1 カテゴリ。左にランク・カテゴリ名・入力サマリ、右に 3 component mini バー + 大スコア。
// 全体市場スコア（MarketScoreCard）と視覚的に揃えつつ、1 行で読み切れる密度に調整。
function CategoryScoreCard({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">業種別市場スコアを計算中…</p>
      </div>
    );
  }
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return (
      <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
        <p className="text-sm text-gray-500">業種別市場スコアなし</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-lg font-bold text-[#2F9FD3]">業種別市場スコア</h2>
        <span className="text-xs text-gray-500">
          {data.yearPrev} → {data.yearCurrent} の比較
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        全体市場スコアと同じ 3 要素（件数 / 金額 / 高額帯シフト）をカテゴリ単位で合成。スコア降順で上位表示。
      </p>
      <div className="divide-y divide-[#F5FAFD]">
        {data.items.map((it, i) => (
          <CategoryScoreRow key={it.category} rank={i + 1} item={it} />
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-3">
        * 重み: 件数成長 {(data.weights.volume_trend*100).toFixed(0)}% /
        金額成長 {(data.weights.amount_trend*100).toFixed(0)}% /
        高額帯シフト {(data.weights.premium_shift*100).toFixed(0)}%。
        高額帯 = 5000万円超の落札。category 空欄は「未分類」に集約。
      </p>
    </div>
  );
}

function CategoryScoreRow({ rank, item }) {
  const s = item.score;
  const tone =
    s >= 80 ? { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" } :
    s >= 60 ? { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" } :
    s >= 40 ? { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" } :
              { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };

  const { count_current, count_prev, amount_current, amount_prev,
          premium_share_current, premium_share_prev } = item.inputs;
  const vg = count_prev > 0 ? ((count_current - count_prev) / count_prev) * 100 : null;
  const ag = amount_prev > 0 ? ((amount_current - amount_prev) / amount_prev) * 100 : null;
  const pd = (premium_share_current != null && premium_share_prev != null)
    ? (premium_share_current - premium_share_prev) * 100
    : null;

  const comps = [
    { v: item.components.volume_trend,  label: "件数", sub: vg == null ? "—" : `${vg >= 0 ? "+" : ""}${vg.toFixed(0)}%` },
    { v: item.components.amount_trend,  label: "金額", sub: ag == null ? "—" : `${ag >= 0 ? "+" : ""}${ag.toFixed(0)}%` },
    { v: item.components.premium_shift, label: "高額", sub: pd == null ? "—" : `${pd >= 0 ? "+" : ""}${pd.toFixed(1)}pt` },
  ];

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-6 text-xs text-gray-400 tabular-nums shrink-0">{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#333] truncate">{item.category}</div>
        <div className="text-[11px] text-gray-500 tabular-nums">
          {formatCount(count_current)}件 / {formatAmount(amount_current)}
        </div>
      </div>
      <div className="hidden sm:flex w-44 md:w-56 flex-col gap-0.5 shrink-0">
        {comps.map((c, idx) => {
          const isNull = c.v == null;
          const value = isNull ? 50 : c.v;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-5 shrink-0">{c.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${value}%`,
                    backgroundColor: isNull ? "#CBD5E1" : tone.fg,
                    opacity: isNull ? 0.5 : 1,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-500 tabular-nums w-12 text-right shrink-0">{c.sub}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col items-center shrink-0 w-16">
        <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: tone.fg }}>{s}</span>
        <span
          className="mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap"
          style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
        >
          {item.label}
        </span>
      </div>
    </div>
  );
}

// Step 4: 金額帯 × 年度 ヒートマップ（CSS のみ、chart lib 不使用）
// 行=帯（Step 1 と同一 9 区分）、列=年（暦年）。件数ベース。
function BandYearHeatmap({ data, loading }) {
  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-base font-bold text-[#2F9FD3]">金額帯 × 年度</h2>
        {data?.totals?.count != null && (
          <span className="text-xs text-gray-500 tabular-nums">全 {formatCount(data.totals.count)}件</span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        行ごとの最大値を基準に濃淡を表示（その金額帯が近年増えたか / 減ったか を色で把握）
      </p>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : !data || !data.rows || data.rows.length === 0 || data.years.length === 0 ? (
        <p className="text-sm text-gray-500">データなし</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: "2px 2px" }}>
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium py-1 pr-2 sticky left-0 bg-white z-10 min-w-[110px]">金額帯</th>
                {data.years.map((y) => (
                  <th key={y} className="text-right font-medium py-1 px-1 whitespace-nowrap">{y}</th>
                ))}
                <th className="text-right font-medium py-1 pl-2">計</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const rowMax = row.cells.reduce((m, c) => Math.max(m, c.count), 0);
                return (
                  <tr key={row.band}>
                    <td className="py-1 pr-2 font-medium text-[#333] sticky left-0 bg-white z-10 whitespace-nowrap">
                      {row.band}
                    </td>
                    {row.cells.map((cell) => {
                      const intensity = rowMax > 0 ? cell.count / rowMax : 0;
                      const bg = `rgba(47, 159, 211, ${(intensity * 0.85).toFixed(3)})`;
                      const fg = intensity > 0.55 ? "white" : "#333";
                      return (
                        <td
                          key={cell.year}
                          className="text-right py-1 px-1.5 tabular-nums whitespace-nowrap rounded"
                          style={{ backgroundColor: bg, color: fg }}
                          title={`${row.band} × ${cell.year}: ${formatCount(cell.count)}件`}
                        >
                          {cell.count > 0 ? formatCount(cell.count) : ""}
                        </td>
                      );
                    })}
                    <td className="text-right py-1 pl-2 tabular-nums font-medium text-[#333]">
                      {formatCount(row.totalCount)}
                    </td>
                  </tr>
                );
              })}
              {/* 列合計行 */}
              <tr className="border-t border-gray-200">
                <td className="py-1 pr-2 text-[#666] sticky left-0 bg-white z-10">計</td>
                {data.totals?.byYear?.map((t) => (
                  <td key={t.year} className="text-right py-1 px-1 tabular-nums text-[#666]">
                    {formatCount(t.count)}
                  </td>
                ))}
                <td className="text-right py-1 pl-2 tabular-nums text-[#333] font-medium">
                  {formatCount(data.totals?.count || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-3">
        * 金額帯は Step 1 と同一定義（9区分）。年度は暦年（award_date 欠損は除外）。金額 NULL/0/負数は「不明」行に分類。
      </p>
    </div>
  );
}

// Step 3: 2年比較ランキング変動カード（上昇 TOP10 / 下降 TOP10）
const DIFF_YEAR_PAIRS = [
  { cur: "2025", prev: "2024", label: "2025 vs 2024" },
  { cur: "2024", prev: "2023", label: "2024 vs 2023" },
  { cur: "2023", prev: "2022", label: "2023 vs 2022" },
  { cur: "2022", prev: "2021", label: "2022 vs 2021" },
];

function RankingDiffCard({ data, loading, yearCurrent, yearPrev, onChangePair }) {
  const items = data?.items || [];
  // rank_diff > 0 が上昇、< 0 が下降。new_entry は rank_diff=null なのでどちらにも入らない。
  const risers   = useMemo(() => items.filter((i) => i.rank_diff != null && i.rank_diff > 0).slice(0, 10), [items]);
  const fallers  = useMemo(
    () => items.filter((i) => i.rank_diff != null && i.rank_diff < 0)
                .sort((a, b) => a.rank_diff - b.rank_diff)
                .slice(0, 10),
    [items]
  );
  const newbies  = useMemo(() => items.filter((i) => i.new_entry).slice(0, 5), [items]);

  return (
    <div className="bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <h2 className="text-base font-bold text-[#2F9FD3]">
          ランキング変動 <span className="text-xs text-gray-500 font-normal">（{yearPrev}→{yearCurrent}）</span>
        </h2>
        <ToggleGroup
          label="対象"
          value={`${yearCurrent}|${yearPrev}`}
          onChange={(v) => { const [c, p] = v.split("|"); onChangePair?.(c, p); }}
          options={DIFF_YEAR_PAIRS.map((p) => ({ v: `${p.cur}|${p.prev}`, l: p.label }))}
        />
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        両年の TOP200 で resolved（法人番号＋別名統合済）な entity を比較。
        rank_diff = 前年順位 − 当年順位。
      </p>
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">データなし</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RiserTable title="上昇 TOP10" rows={risers} direction="up" />
          <RiserTable title="下降 TOP10" rows={fallers} direction="down" />
          {newbies.length > 0 && (
            <div className="md:col-span-2">
              <h3 className="text-xs font-bold text-[#666] mb-1.5">新規参入 TOP{newbies.length}（前年 TOP200 外から今年ランク入り）</h3>
              <ul className="flex flex-wrap gap-1.5">
                {newbies.map((r) => (
                  <li key={r.entity_id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[#DCEAF2] bg-[#EDF7FC] text-[#2F9FD3]">
                    <span className="tabular-nums font-medium">#{r.rank_current}</span>
                    <span className="text-[#333]">{r.name || "(unknown)"}</span>
                    <span className="text-gray-500 tabular-nums">{formatCount(r.count_current)}件</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RiserTable({ title, rows, direction }) {
  const isUp = direction === "up";
  const arrow = isUp ? "↑" : "↓";
  const colorClass = isUp ? "text-green-600" : "text-red-500";
  return (
    <div>
      <h3 className="text-xs font-bold text-[#666] mb-1.5">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">該当なし</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-500 border-b border-[#EDF7FC]">
            <tr>
              <th className="text-left py-1 pr-2">企業</th>
              <th className="text-right py-1 px-1 whitespace-nowrap">当 → 前</th>
              <th className="text-right py-1 pl-1 whitespace-nowrap">変動</th>
              <th className="text-right py-1 pl-2 whitespace-nowrap">件数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entity_id} className="border-b border-[#F5FAFD]">
                <td className="py-1 pr-2 truncate max-w-[180px] text-[#333]">{r.name || "(unknown)"}</td>
                <td className="py-1 px-1 text-right tabular-nums text-gray-500 whitespace-nowrap">
                  #{r.rank_current} ← #{r.rank_prev}
                </td>
                <td className={`py-1 pl-1 text-right tabular-nums font-medium whitespace-nowrap ${colorClass}`}>
                  {arrow}{Math.abs(r.rank_diff)}
                </td>
                <td className="py-1 pl-2 text-right tabular-nums text-gray-600 whitespace-nowrap">
                  {formatCount(r.count_current)}
                  <span className="text-gray-400 ml-1">({r.count_current - r.count_prev >= 0 ? "+" : ""}{formatCount(r.count_current - r.count_prev)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
