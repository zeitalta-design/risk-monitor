"use client";

/**
 * 保存した有望案件（Phase J-14）
 *
 * `/api/deals/saved` を読んで、ユーザーがピン留めした nyusatsu_items の基本情報を
 * 保存日時 DESC で一覧表示する。最小実装: 案件名 / 発注者 / カテゴリ / 予算 /
 * 締切 / 保存日時 / 解除ボタン。
 *
 * 未公開 / 削除された案件は API 側 (INNER JOIN) で自動的に落ちる。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import {
  getCategoryIcon,
  getCategoryLabel,
  formatBudget,
  formatDeadline,
  getDeadlineRemaining,
} from "@/lib/nyusatsu-config";
import {
  computeSavedDealPriority,
  sortSavedDealsByPriority,
} from "@/lib/saved-deals-priority";

const PAGE_SIZE = 30;

function formatSavedAt(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return String(s).slice(0, 10);
}

export default function SavedDealsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [busySlug, setBusySlug] = useState(null);
  // Phase J-17: pin/unpin の最中に対応行だけ disable したいので slug ベース管理
  const [pinBusySlug, setPinBusySlug] = useState(null);

  const load = useCallback(async (nextOffset = 0, append = false) => {
    if (!append) setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      const r = await fetch(`/api/deals/saved?${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setTotal(d.total || 0);
      setItems((prev) => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
    } catch (e) {
      setError(e.message || "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, false); }, [load]);

  async function handleUnsave(slug) {
    if (!slug || busySlug) return;
    setBusySlug(slug);
    try {
      const r = await fetch("/api/deals/unsave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_slug: slug }),
      });
      if (r.ok) {
        setItems((prev) => prev.filter((x) => x.deal_slug !== slug));
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setBusySlug(null);
    }
  }

  // Phase J-17: pin 切り替え。
  // Phase J-Post: pin/unpin 成功後は lib/saved-deals-priority.js を使って
  //   client-side で priority を再計算＆並び替えし、再 fetch を省略する
  //   (サーバ実装と同じ純関数を共有しているので二重実装にはならない)。
  async function handleTogglePin(slug, currentlyPinned) {
    if (!slug || pinBusySlug) return;
    setPinBusySlug(slug);
    try {
      const endpoint = currentlyPinned ? "/api/deals/unpin" : "/api/deals/pin";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_slug: slug }),
      });
      if (!r.ok) return;
      setItems((prev) => {
        const next = prev.map((it) => {
          if (it.deal_slug !== slug) return it;
          const withPin = { ...it, is_pinned: currentlyPinned ? 0 : 1 };
          return { ...withPin, ...computeSavedDealPriority(withPin) };
        });
        return sortSavedDealsByPriority(next);
      });
    } finally {
      setPinBusySlug(null);
    }
  }

  function handleLoadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    load(next, true);
  }

  const hasMore = items.length < total;

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">保存した有望案件</h1>
          <Link href="/nyusatsu" className="text-xs text-gray-500 hover:text-blue-600">
            入札ナビ一覧 →
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          ピン留めした案件を優先度順に表示します。
        </p>

        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-6 text-sm text-red-600">取得に失敗しました: {error}</div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-gray-500">まだ保存した案件はありません。</p>
            <div className="mt-3">
              <Link href="/nyusatsu" className="text-sm text-blue-600 hover:underline">
                案件を探す →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">{total} 件保存中</p>
            <ul className="space-y-2.5">
              {items.map((it) => (
                <li key={it.saved_id}>
                  <SavedRow
                    item={it}
                    onUnsave={handleUnsave}
                    onTogglePin={handleTogglePin}
                    busy={busySlug === it.deal_slug}
                    pinBusy={pinBusySlug === it.deal_slug}
                  />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? "読み込み中..." : "もっと見る"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}

// Phase J-18: priority_label 用の配色。
// Phase J-Post: 「高」「中」を semibold でわずかに強め、「低」は弱めに留める。
const PRIORITY_STYLES = {
  "高": "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
  "中": "bg-amber-50 text-amber-700 border-amber-200 font-medium",
  "低": "bg-gray-50 text-gray-400 border-gray-200",
};

function SavedRow({ item, onUnsave, onTogglePin, busy, pinBusy }) {
  const href = `/nyusatsu/${encodeURIComponent(item.deal_slug)}`;
  const pinned = (item.is_pinned || 0) === 1;
  const priorityLabel = item.priority_label || "低";
  const priorityReasons = Array.isArray(item.priority_reasons) ? item.priority_reasons : [];
  // 「ピン留め」は専用バッジで、「期限切れ」「終了済み」はカードのグレーアウトで
  // それぞれ視覚的に伝わるので reasons からは除外（情報の二重表示を避ける）。
  const REDUNDANT_REASONS = new Set(["ピン留め", "期限切れ", "終了済み"]);
  const reasonsForDisplay = priorityReasons.filter((r) => !REDUNDANT_REASONS.has(r));
  const priorityStyle = PRIORITY_STYLES[priorityLabel] || PRIORITY_STYLES["低"];
  // Phase J-Post: 期限切れ / 終了案件はグレーアウト（pin は例外：pin は所有者意図として残す）。
  const remaining = getDeadlineRemaining(item.deadline);
  const isExpired = !!remaining?.expired || item.status === "closed";
  const mutedClass = isExpired && !pinned ? "opacity-60" : "";
  return (
    <div className={`card ${pinned ? "ring-1 ring-amber-200 bg-amber-50/30" : ""} ${mutedClass}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {pinned && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200"
                title="ピン留め中"
              >
                <span>📌</span>
                <span>ピン留め</span>
              </span>
            )}
            <span
              className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${priorityStyle}`}
              title="優先度（pin / 締切 / 状況から自動判定）"
            >
              優先度: {priorityLabel}
            </span>
            {reasonsForDisplay.map((r) => (
              <span
                key={r}
                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-600 border border-gray-200"
              >
                {r}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
              <span>{getCategoryIcon(item.category)}</span>
              <span>{getCategoryLabel(item.category)}</span>
            </span>
            {item.target_area && (
              <span className="text-[10px] text-gray-500">{item.target_area}</span>
            )}
            <span className="text-[10px] text-gray-400 ml-auto tabular-nums">
              保存 {formatSavedAt(item.saved_at)}
            </span>
          </div>
          <Link
            href={href}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
          >
            {item.title || "(件名不明)"}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-500">
            {item.issuer_name && <span className="truncate max-w-[240px]">{item.issuer_name}</span>}
            {item.budget_amount != null && <span>{formatBudget(item.budget_amount)}</span>}
            {item.deadline && (
              <span className={remaining?.expired ? "text-gray-400" : ""}>
                締切: {formatDeadline(item.deadline)}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <Link href={href} className="text-xs text-blue-500 hover:text-blue-700">
            詳細 →
          </Link>
          <button
            onClick={() => onTogglePin?.(item.deal_slug, pinned)}
            disabled={pinBusy}
            className={
              pinned
                ? "text-xs text-amber-700 hover:text-amber-900 disabled:opacity-50"
                : "text-xs text-gray-500 hover:text-amber-700 disabled:opacity-50"
            }
            title={pinned ? "ピンを解除" : "ピン留めして先頭表示"}
          >
            {pinned ? "📌 解除" : "📌 ピン"}
          </button>
          <button
            onClick={() => onUnsave?.(item.deal_slug)}
            disabled={busy}
            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            解除
          </button>
        </div>
      </div>
    </div>
  );
}
