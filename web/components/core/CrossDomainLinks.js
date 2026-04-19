"use client";

/**
 * 企業横断参照セクション（Phase 2 Step E）
 *
 * /api/companies/[key] を叩いて、指定企業が他DB（nyusatsu / hojokin / sanpai /
 * 許認可以外）に存在するかを件数とリンクで示す。
 *
 * ポリシー:
 *   - 集計や統合ダッシュボードは作らない（件数と検索リンクのみ）
 *   - 0件ドメインも淡く表示（「観測なし」を可視化）
 *   - link key 未解決なら非表示
 *
 * Props:
 *   - lookupKey: corporate_number (優先) または normalized_name
 *   - skipDomain: 自ドメイン（"kyoninka" 等）を結果から除外
 */
import { useEffect, useState } from "react";
import Link from "next/link";

const DOMAIN_CONFIG = {
  nyusatsu: {
    label: "入札（落札実績）",
    short: "入札",
    icon: "📝",
    field: "results",
    searchPath: (key) => `/nyusatsu?keyword=${encodeURIComponent(key)}`,
    accent: "hover:border-purple-300 hover:bg-purple-50/50",
  },
  hojokin: {
    label: "補助金",
    short: "補助金",
    icon: "💰",
    field: "items",
    searchPath: (key) => `/hojokin?keyword=${encodeURIComponent(key)}`,
    accent: "hover:border-amber-300 hover:bg-amber-50/50",
  },
  kyoninka: {
    label: "許認可",
    short: "許認可",
    icon: "📋",
    field: "entities",
    searchPath: (key) => `/kyoninka?keyword=${encodeURIComponent(key)}`,
    accent: "hover:border-cyan-300 hover:bg-cyan-50/50",
  },
  gyosei_shobun: {
    label: "行政処分",
    short: "行政処分",
    icon: "⚠️",
    field: "actions",
    searchPath: (key) => `/gyosei-shobun?keyword=${encodeURIComponent(key)}`,
    accent: "hover:border-red-300 hover:bg-red-50/50",
  },
  sanpai: {
    label: "産廃処分",
    short: "産廃",
    icon: "🚛",
    field: "items",
    searchPath: (key) => `/sanpai?keyword=${encodeURIComponent(key)}`,
    accent: "hover:border-emerald-300 hover:bg-emerald-50/50",
  },
};

export default function CrossDomainLinks({ lookupKey, skipDomain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lookupKey) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/companies/${encodeURIComponent(lookupKey)}`);
        if (!res.ok) { if (!cancelled) setData(null); return; }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lookupKey]);

  if (!lookupKey) return null;
  if (loading) {
    return (
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">他DB情報</h2>
        <p className="text-xs text-gray-400">読み込み中...</p>
      </section>
    );
  }
  if (!data) return null;

  const rows = Object.entries(DOMAIN_CONFIG)
    .filter(([domain]) => domain !== skipDomain)
    .map(([domain, cfg]) => {
      const section = data[domain] || {};
      const block = section[cfg.field] || { count: 0, ids: [] };
      return { domain, cfg, count: block.count || 0 };
    });

  const hasAnchors = !!(data.anchors?.organization_id || data.anchors?.resolved_entity_id);
  const totalHits = rows.reduce((s, r) => s + r.count, 0);
  const presentDomains = rows.filter((r) => r.count > 0).length;

  return (
    <section className="card p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="text-sm font-bold text-gray-900">他DB情報</h2>
        {hasAnchors && (
          <div className="text-xs text-gray-500 tabular-nums">
            <span className="font-bold text-gray-700">{presentDomains}</span>
            <span className="text-gray-400">/{rows.length}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            計 <span className="font-bold text-gray-700">{totalHits.toLocaleString()}</span>件
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {hasAnchors
          ? "同じ企業の関連レコードを他DBから抽出しています（件数と検索リンクのみ）。"
          : "他DBへの企業 link はまだ解決されていません（法人番号 / organizations 側が未登録）。以下は該当0件です。"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {rows.map((r) => r.count > 0 ? (
          <Link
            key={r.domain}
            href={r.cfg.searchPath(data.query.key, data.query.kind)}
            className={`flex items-center gap-2 p-3 border border-gray-200 rounded-lg transition-colors ${r.cfg.accent}`}
          >
            <span className="text-xl shrink-0">{r.cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-500 truncate">{r.cfg.short}</div>
              <div className="text-sm font-bold text-gray-900 tabular-nums">{r.count.toLocaleString()}件</div>
            </div>
            <span className="text-xs text-gray-400">→</span>
          </Link>
        ) : (
          <div
            key={r.domain}
            className="flex items-center gap-2 p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50/50"
            title="このドメインでの観測なし"
          >
            <span className="text-xl shrink-0 grayscale opacity-50">{r.cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-400 truncate">{r.cfg.short}</div>
              <div className="text-sm text-gray-300">—</div>
            </div>
          </div>
        ))}
      </div>
      {totalHits === 0 && hasAnchors && (
        <p className="text-xs text-gray-400 mt-3">いずれのDBにも該当なし。</p>
      )}
    </section>
  );
}
