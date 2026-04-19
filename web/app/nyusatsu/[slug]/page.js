"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import SaveDealButton from "@/components/SaveDealButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getCategoryLabel,
  getCategoryIcon,
  getBiddingMethodLabel,
  formatBudget,
  formatDeadline,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");

// ─── キー情報バー ─────────────────────

function NyusatsuInfoBanner({ item }) {
  // 締切の緊急度でアクセントカラー決定
  // item.deadline が文字列 "YYYY-MM-DD" 形式を想定
  const deadline = item.deadline ? new Date(item.deadline) : null;
  const now = new Date();
  const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && !isPast && daysLeft <= 7;
  const isSoon = daysLeft !== null && !isPast && daysLeft <= 30;
  const accent = isPast ? "#9CA3AF" : isUrgent ? "#DC2626" : isSoon ? "#D97706" : "#2563EB";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {item.issuer_name && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">発注機関</span>
              <span className="font-bold text-gray-900">{item.issuer_name}</span>
            </div>
          )}
          {item.target_area && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">対象地域</span>
              <span className="font-medium text-gray-800">{item.target_area}</span>
            </div>
          )}
          {item.budget_amount != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">予算規模</span>
              <span className="font-bold text-gray-900">{formatBudget(item.budget_amount)}</span>
            </div>
          )}
          {item.deadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">締切</span>
              <span className={`font-bold ${isPast ? "text-gray-400" : isUrgent ? "text-red-600" : isSoon ? "text-amber-600" : "text-gray-900"}`}>
                {formatDeadline(item.deadline)}{daysLeft !== null && !isPast ? ` (残${daysLeft}日)` : isPast ? " (締切済)" : ""}
              </span>
            </div>
          )}
          {item.announcement_url && (
            <div className="ml-auto">
              <a href={item.announcement_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                原文ソース
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NyusatsuDetailPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const entityIdParam = searchParams.get("entityId");
  const entityId = entityIdParam && /^\d+$/.test(entityIdParam) ? parseInt(entityIdParam, 10) : null;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  // Phase I 先行: items 用 Deal Score（entityId 指定時のみ計算）
  const [dealScore, setDealScore] = useState(null);
  const [dealScoreLoading, setDealScoreLoading] = useState(false);

  // Phase J-14: 保存状態。ログイン中のみ取得、未ログインは false のまま。
  const [initialSaved, setInitialSaved] = useState(false);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch("/api/deals/saved?mode=set")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const set = new Set(d.slugs || []);
        setInitialSaved(set.has(slug));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/nyusatsu/${slug}`);
        if (!res.ok) { setItem(null); return; }
        const data = await res.json();
        setItem(data.item || null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!item?.id || !entityId) { setDealScore(null); return; }
    setDealScoreLoading(true);
    fetch(`/api/nyusatsu/analytics/deal-score?entityId=${entityId}&dealId=${item.id}&source=items`)
      .then((r) => r.json())
      .then((d) => setDealScore(d?.error ? null : d))
      .catch(() => setDealScore(null))
      .finally(() => setDealScoreLoading(false));
  }, [item?.id, entityId]);

  if (loading) return <DomainDetailPage loading />;

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">案件が見つかりません</p>
            <Link href="/nyusatsu" className="btn-primary inline-block">入札ナビ一覧へ</Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/nyusatsu" className="hover:text-blue-600">入札ナビ</Link><span>/</span><span>{item.title}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={item.issuer_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className="text-sm text-gray-600">{formatBudget(item.budget_amount)}</span>
          <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
        </>
      }
      actions={
        <>
          <SaveDealButton dealSlug={slug} initialSaved={initialSaved} />
          {nyusatsuDomain && <DomainFavoriteButton itemId={item.id} domain={nyusatsuDomain} variant="button" />}
          <DomainCompareButton domainId="nyusatsu" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/nyusatsu" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      <NyusatsuInfoBanner item={item} />

      {/* Phase I 先行: Deal Score（?entityId=X で評価対象企業を指定） */}
      <ItemDealScoreSection
        item={item}
        entityId={entityId}
        data={dealScore}
        loading={dealScoreLoading}
        onSelectEntity={(eid) => {
          const sp = new URLSearchParams(searchParams.toString());
          if (eid) sp.set("entityId", String(eid));
          else sp.delete("entityId");
          router.replace(`/nyusatsu/${slug}?${sp.toString()}`, { scroll: false });
        }}
      />

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">案件概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["発注機関", item.issuer_name],
              ["カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["対象地域", item.target_area],
              ["予算規模", <span key="b" className="font-medium">{formatBudget(item.budget_amount)}</span>],
              ["入札方式", getBiddingMethodLabel(item.bidding_method)],
              ["公告日", item.announcement_date ? formatDeadline(item.announcement_date) : null],
              ["締切日", formatDeadline(item.deadline)],
              ["契約期間", item.contract_period],
            ].filter(([, v]) => v != null && v !== "—" && v !== "").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 応募・参加条件 */}
      {item.qualification && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">応募・参加条件</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.qualification}</p>
        </section>
      )}

      {/* 履行・納入情報 */}
      {(item.delivery_location || item.contract_period) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">履行・納入情報</h2>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["履行場所", item.delivery_location],
                ["契約期間", item.contract_period],
              ].filter(([, v]) => v).map(([label, value], i, arr) => (
                <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                  <td className="py-3 text-gray-500 w-40">{label}</td>
                  <td className="py-3 text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 公告・資料 */}
      {(item.announcement_url || item.has_attachment) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">公告・資料</h2>
          <div className="space-y-2">
            {item.announcement_url && (
              <div>
                <a href={item.announcement_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  公告元サイトを見る →
                </a>
              </div>
            )}
            {item.has_attachment ? (
              <p className="text-sm text-green-700">📎 添付資料あり</p>
            ) : null}
          </div>
        </section>
      )}

      {/* 問い合わせ先 */}
      {item.contact_info && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">問い合わせ先</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.contact_info}</p>
        </section>
      )}

      {/* 関連導線 */}
      <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
        {item.category && (
          <Link href={`/nyusatsu/category/${item.category}`} className="block text-sm text-blue-600 hover:underline">
            {getCategoryIcon(item.category)} {getCategoryLabel(item.category)}の案件をもっと見る →
          </Link>
        )}
        {item.target_area && (
          <Link href={`/nyusatsu/area/${encodeURIComponent(item.target_area)}`} className="block text-sm text-blue-600 hover:underline">
            {item.target_area}の案件をもっと見る →
          </Link>
        )}
      </div>
    </DomainDetailPage>
  );
}

// ─── Phase I 先行: items 向け Deal Score カード ───────────────
// 公告中案件に「ある企業が追う価値」を Deal Score で可視化する。
// entityId 未指定時は入力フォームのみ表示（スコア計算は任意）。
function ItemDealScoreSection({ item, entityId, data, loading, onSelectEntity }) {
  const [inputId, setInputId] = useState(entityId ? String(entityId) : "");

  useEffect(() => {
    setInputId(entityId ? String(entityId) : "");
  }, [entityId]);

  function tone(s) {
    if (s >= 80) return { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" };
    if (s >= 60) return { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" };
    if (s >= 40) return { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" };
    return { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };
  }

  return (
    <section className="card p-6 mb-6 border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-gray-900">Deal Score（この企業にとって）</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = inputId.trim();
            if (v && /^\d+$/.test(v)) onSelectEntity(parseInt(v, 10));
            else onSelectEntity(null);
          }}
          className="flex items-center gap-2 text-xs"
        >
          <label className="text-gray-500">評価対象 企業ID:</label>
          <input
            type="text"
            inputMode="numeric"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="例: 16542"
            className="px-2 py-1 border border-gray-300 rounded w-24 font-mono"
          />
          <button type="submit" className="px-2 py-1 bg-[#2F9FD3] text-white rounded hover:bg-[#2589b8]">
            評価
          </button>
          {entityId && (
            <button
              type="button"
              className="px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              onClick={() => onSelectEntity(null)}
            >
              クリア
            </button>
          )}
        </form>
      </div>

      {!entityId ? (
        <p className="text-xs text-gray-500">
          企業 ID を入力して「評価」するとこの案件の Deal Score を計算します。
          entity は{" "}
          <Link href="/nyusatsu/dashboard" className="text-blue-600 hover:underline">
            落札ランキング
          </Link>{" "}
          から選べます。
        </p>
      ) : loading ? (
        <p className="text-xs text-gray-500">Deal Score 計算中…</p>
      ) : !data ? (
        <p className="text-xs text-gray-500">この案件 × 企業 ID では Deal Score を取得できませんでした</p>
      ) : (
        <ItemDealScoreCardInner data={data} entityId={entityId} tone={tone(data.score)} />
      )}
    </section>
  );
}

function ItemDealScoreCardInner({ data, entityId, tone }) {
  const comps = [
    { key: "entity_score",          label: "企業",   sub: data.sources?.entity?.label ? `「${data.sources.entity.label}」` : null },
    { key: "market_score",          label: "市場",   sub: data.sources?.market?.label ? `「${data.sources.market.label}」` : null },
    { key: "category_score",        label: "業種",   sub: data.deal?.category
        ? `${data.deal.category}${data.sources?.category?.label ? `: 「${data.sources.category.label}」` : ""}`
        : "category なし → 中立" },
    { key: "issuer_affinity_score", label: "issuer", sub: !data.deal?.issuer_key
        ? "識別不能 → 中立"
        : data.sources?.issuer
          ? `「${data.sources.issuer.label}」 ${data.sources.issuer.inputs?.count ?? 0}件 / 直近 ${data.sources.issuer.inputs?.last_awarded_year ?? "-"}`
          : null },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold tabular-nums" style={{ color: tone.fg }}>{data.score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
          <span
            className="inline-block text-xs font-medium px-2 py-0.5 rounded border"
            style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
          >
            {data.label}
          </span>
        </div>
        <Link
          href={`/nyusatsu/entities/${entityId}`}
          className="text-xs text-blue-600 hover:underline ml-auto"
        >
          企業 #{entityId} の詳細 →
        </Link>
        {data.deal?.issuer_key && data.deal.issuer_key_type === "dept_hint" && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDF7FC] text-[#2F9FD3]" title="issuer_dept_hint（補助値）">
            issuerヒント: {data.deal.issuer_key}
          </span>
        )}
        {data.deal?.issuer_key && data.deal.issuer_key_type === "code" && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono" title="issuer_code（元CSVコード）">
            code: {data.deal.issuer_key}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {comps.map((c) => {
          const v = data.components[c.key];
          const value = v ?? 50;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-900">
                  {c.label}
                  {c.sub && <span className="text-gray-400 ml-2">{c.sub}</span>}
                </span>
                <span className="tabular-nums font-medium text-gray-900">{value}</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className="h-full" style={{ width: `${value}%`, backgroundColor: tone.fg }} />
              </div>
            </div>
          );
        })}
      </div>

      {data.reasons?.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-gray-700">
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
        予算金額はスコア合成には未使用（公告中のため未確定）。
      </p>
    </div>
  );
}
