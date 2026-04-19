"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCategoryLabel, getCategoryIcon } from "@/lib/nyusatsu-config";
import SaveDealButton from "@/components/SaveDealButton";

/**
 * Phase J-2: 有望案件セクション（トップ/landing 用）
 *
 * 指定 entity の Deal Score 上位 N 件を Hero 的に表示する。
 * 初期は固定 entityId でも、将来 picker に差し替えやすいよう prop で受ける。
 *
 * Props:
 *   - entityId   (必須)  対象 entity id（resolved_entities.id）
 *   - limit      (任意, default 5, 1..10)
 *   - minScore   (任意, default 60)
 *   - source     (任意, default "items")
 *   - title      (任意, default "有望案件")
 *   - subtitle   (任意)
 */
export default function TopDealsSection({
  entityId,
  limit = 5,
  minScore = 60,
  source = "items",
  title = "有望案件",
  subtitle = "Deal Score をもとに、今追う価値の高い案件を表示しています",
}) {
  const [items, setItems] = useState(null); // null=loading, []=empty, [..]=data
  const [error, setError] = useState(null);
  const [savedSet, setSavedSet] = useState(() => new Set());

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    const qs = new URLSearchParams({
      entityId: String(entityId),
      limit:    String(limit),
      minScore: String(minScore),
      source,
    });
    fetch(`/api/nyusatsu/analytics/deals/top?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || "failed");
        setItems([]);
      });
    return () => { cancelled = true; };
  }, [entityId, limit, minScore, source]);

  // Phase J-14: ログインしている場合のみ saved slug を取って初期 pressed 状態に反映する。
  //   401 は静かに無視（未ログインでは保存ボタンを押しても SaveDealButton 側で disabled）。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/deals/saved?mode=set")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setSavedSet(new Set(d.slugs || []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mb-6 bg-white border border-[#DCEAF2] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold text-[#2F9FD3]">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {/* Phase J-14: 保存した案件一覧への導線 */}
        <Link href="/saved-deals" className="text-xs text-gray-500 hover:text-[#2F9FD3] shrink-0">
          ★ 保存した案件 →
        </Link>
      </div>

      {items === null && !error && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && items?.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">
          有望案件の取得に失敗しました（{error}）
        </p>
      )}

      {!error && items?.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">
          現在、条件に合う有望案件はありません
        </p>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <DealCard
              key={it.id}
              item={it}
              entityId={entityId}
              initialSaved={!!(it.slug && savedSet.has(it.slug))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DealCard({ item, entityId, initialSaved }) {
  const tone = scoreTone(item.score);
  const href = item.slug
    ? `/nyusatsu/${encodeURIComponent(item.slug)}?entityId=${encodeURIComponent(entityId)}`
    : null;

  const issuerHint =
    (item.issuer?.dept_hint && item.issuer.dept_hint) ||
    (item.issuer?.code      && `code: ${item.issuer.code}`) ||
    null;

  // Phase J-13: 有望な理由 1 行を控えめに添える。
  //   reasons[0] は `buildDealReasons` で「実際の根拠」が先頭に入る。
  //   「各スコアが中位...」のような判定不能メッセージは出さない。
  const headReason = Array.isArray(item.reasons) && item.reasons.length > 0 ? String(item.reasons[0]) : null;
  const topReason = headReason && !headReason.startsWith("各スコアが中位") ? headReason : null;

  const body = (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#2F9FD3] hover:bg-[#F8FBFD] transition-colors">
      <div className="flex-shrink-0 w-16 flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: tone.fg }}>
          {item.score}
        </span>
        <span
          className="mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap"
          style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
        >
          {item.label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate" title={item.title || ""}>
          {item.title || "(no title)"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-500">
          {item.category && (
            <span className="inline-flex items-center gap-1">
              <span>{getCategoryIcon(item.category)}</span>
              <span>{getCategoryLabel(item.category)}</span>
            </span>
          )}
          {item.date && <span>{item.date}</span>}
          {issuerHint && (
            <span className="truncate max-w-[180px]" title={issuerHint}>
              {issuerHint}
            </span>
          )}
        </div>
        {topReason && (
          <p className="mt-1 text-[11px] text-[#2F9FD3] truncate" title={topReason}>
            💡 {topReason}
          </p>
        )}
      </div>
      {item.slug && (
        <div className="flex-shrink-0 self-center">
          <SaveDealButton dealSlug={item.slug} initialSaved={initialSaved} compact />
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}

// Deal Score の既存 tone と統一（entities/[id]/page.js と同値）
function scoreTone(s) {
  if (s >= 80) return { fg: "#1F7A52", bg: "#E4F6EC", border: "#B5E2C5" };
  if (s >= 60) return { fg: "#2F9FD3", bg: "#EDF7FC", border: "#DCEAF2" };
  if (s >= 40) return { fg: "#8A6D00", bg: "#FBF4DC", border: "#EAD9A0" };
  return            { fg: "#B4281E", bg: "#FBECEA", border: "#F0C0BA" };
}
