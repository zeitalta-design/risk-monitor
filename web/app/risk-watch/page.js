"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import RiskBadge from "@/components/RiskBadge";

const INDUSTRY_LABELS = {
  construction: "建設業",
  real_estate: "宅建業",
  architecture: "建築士",
  sanpai: "産廃業",
  transport: "運送業",
  other: "その他",
};

const ACTION_LABELS = {
  license_revocation: "許可取消",
  business_suspension: "業務停止",
  improvement_order: "指示処分",
  warning: "警告",
  guidance: "指導",
  other: "その他",
};

const FREE_WATCH_LIMIT = 3;

export default function RiskWatchPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>}>
      <RiskWatchPage />
    </Suspense>
  );
}

function RiskWatchPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [riskScores, setRiskScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest"); // newest | risk | registered
  const [autoAdded, setAutoAdded] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        window.location.href = "/login?next=/risk-watch";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  const fetchRiskScores = useCallback(async (watchItems) => {
    if (!watchItems || watchItems.length === 0) return;
    const results = {};
    await Promise.all(
      watchItems.map(async (w) => {
        const key = `${w.organization_name}::${w.industry || ""}`;
        try {
          const res = await fetch(
            `/api/entities/risk-summary?name=${encodeURIComponent(w.organization_name)}&industry=${encodeURIComponent(w.industry || "")}`
          );
          if (res.ok) results[key] = await res.json();
        } catch {}
      })
    );
    setRiskScores(results);
  }, []);

  // URL params ?add= による自動登録（詳細ページからの導線）
  useEffect(() => {
    const addName = searchParams.get("add");
    const addIndustry = searchParams.get("industry") || "";
    if (addName && !autoAdded) {
      setAutoAdded(true);
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_name: addName, industry: addIndustry }),
      }).then(() => fetchList());
    } else {
      fetchList();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (items.length > 0) fetchRiskScores(items);
  }, [items, fetchRiskScores]);

  const handleRemove = async (item) => {
    if (!confirm(`「${item.organization_name}」のウォッチを解除しますか？`)) return;
    const res = await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (res.status === 401) {
      window.location.href = "/login?next=/risk-watch";
      return;
    }
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sort === "risk") {
      const ka = `${a.organization_name}::${a.industry || ""}`;
      const kb = `${b.organization_name}::${b.industry || ""}`;
      return (riskScores[kb]?.score ?? 0) - (riskScores[ka]?.score ?? 0);
    }
    if (sort === "newest") {
      return (b.latest_action_date || "") > (a.latest_action_date || "") ? 1 : -1;
    }
    // registered
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ヘッダー */}
        <div className="mb-6">
          <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
            <Link href="/" className="hover:text-blue-600 transition-colors">トップ</Link>
            <span>/</span>
            <span className="text-gray-600">リスク監視</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">リスク監視</h1>
              <p className="text-sm text-gray-500">
                登録した事業者の行政処分状況を一括監視できます。
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">
                {items.length} / {FREE_WATCH_LIMIT} 件
              </span>
              {items.length < FREE_WATCH_LIMIT && (
                <Link
                  href="/gyosei-shobun"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  + 事業者を追加
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ソート */}
        {items.length > 1 && (
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="text-gray-400">並び替え:</span>
            {[
              { value: "newest", label: "新着順" },
              { value: "risk",   label: "確認優先度順" },
              { value: "registered", label: "登録日順" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`px-2.5 py-1 rounded border transition-colors ${
                  sort === s.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中…</div>
        )}

        {/* 空状態 */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="text-4xl mb-4">👁</div>
            <h2 className="text-lg font-bold text-gray-700 mb-2">まだウォッチ登録がありません</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
              行政処分DBから事業者を登録すると、ここで一括監視できます。
              取引先・競合の行政処分動向を継続的に把握したい場合にご利用ください。
            </p>
            <Link
              href="/gyosei-shobun"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              行政処分DBを検索する
            </Link>
          </div>
        )}

        {/* ウォッチ一覧 */}
        {!loading && sortedItems.length > 0 && (
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const key = `${item.organization_name}::${item.industry || ""}`;
              const risk = riskScores[key];
              const industryLabel = INDUSTRY_LABELS[item.industry] || item.industry || "";
              const latestActionLabel = ACTION_LABELS[item.latest_action_type] || item.latest_action_type || "";

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 事業者名 + バッジ */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-base font-bold text-gray-900">
                          {item.organization_name}
                        </h3>
                        {item.has_new === 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">
                            NEW
                          </span>
                        )}
                        {risk && (
                          <RiskBadge score={risk.score} level={risk.level} label={risk.label} showScore />
                        )}
                      </div>

                      {/* メタ情報 */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                        {industryLabel && <span>{industryLabel}</span>}
                        {item.prefecture && <span>{item.prefecture}</span>}
                        {item.action_count > 0 && (
                          <span>処分 {item.action_count} 件</span>
                        )}
                        {item.latest_action_date && (
                          <span>最新: {item.latest_action_date}{latestActionLabel ? ` (${latestActionLabel})` : ""}</span>
                        )}
                      </div>

                      {/* アクション */}
                      <div className="flex items-center gap-3">
                        {item.latest_slug && (
                          <Link
                            href={`/gyosei-shobun/${item.latest_slug}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            最新処分を見る →
                          </Link>
                        )}
                        <Link
                          href={`/gyosei-shobun?organization=${encodeURIComponent(item.organization_name)}`}
                          className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
                        >
                          処分一覧を検索 →
                        </Link>
                      </div>
                    </div>

                    {/* 解除ボタン */}
                    <button
                      onClick={() => handleRemove(item)}
                      className="flex-shrink-0 text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 transition-colors"
                      title="ウォッチ解除"
                    >
                      解除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 無料制限 → アップグレード導線 */}
        {!loading && items.length >= FREE_WATCH_LIMIT && (
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  無料プランの上限（{FREE_WATCH_LIMIT}件）に達しています
                </p>
                <ul className="text-xs text-blue-600 space-y-1 mt-2">
                  <li>✓ ウォッチ件数の無制限登録</li>
                  <li>✓ 新着処分の毎日メール通知</li>
                  <li>✓ 業種・地域フィルタ監視</li>
                  <li>✓ CSV出力・週次レポート</li>
                </ul>
              </div>
              <div className="flex flex-col items-end gap-2">
                <a
                  href="mailto:info@taikainavi.jp?subject=リスク監視プラン（有料）のお問い合わせ"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  プランについて問い合わせる →
                </a>
                <span className="text-[10px] text-blue-400">現在ベータ提供中。ご要望をお聞かせください。</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
