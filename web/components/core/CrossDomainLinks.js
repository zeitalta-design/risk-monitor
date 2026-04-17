"use client";

/**
 * 企業横断参照セクション（Phase 2 Step E）
 *
 * /api/companies/[key] を叩いて、指定企業が他DB（nyusatsu / hojokin / sanpai /
 * 許認可以外）に存在するかを件数とリンクで示す。
 *
 * ポリシー:
 *   - 集計や統合ダッシュボードは作らない（件数と検索リンクのみ）
 *   - 0件ドメインは表示しない
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
    icon: "📝",
    field: "results",
    searchPath: (key, kind) => `/nyusatsu?keyword=${encodeURIComponent(key)}`,
  },
  hojokin: {
    label: "補助金",
    icon: "💰",
    field: "items",
    searchPath: (key) => `/hojokin?keyword=${encodeURIComponent(key)}`,
  },
  kyoninka: {
    label: "許認可",
    icon: "📋",
    field: "entities",
    searchPath: (key) => `/kyoninka?keyword=${encodeURIComponent(key)}`,
  },
  sanpai: {
    label: "産廃処分",
    icon: "🚛",
    field: "items",
    searchPath: (key) => `/sanpai?keyword=${encodeURIComponent(key)}`,
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
    })
    .filter((r) => r.count > 0);

  const hasAnchors = !!(data.anchors?.organization_id || data.anchors?.resolved_entity_id);

  if (rows.length === 0) {
    return (
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">他DB情報</h2>
        <p className="text-xs text-gray-500">
          {hasAnchors
            ? "他DBには関連レコードが見つかりませんでした。"
            : "他DBへの企業 link はまだ解決されていません（法人番号 / organizations 側が未登録）。"}
        </p>
      </section>
    );
  }

  return (
    <section className="card p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-900 mb-3">他DB情報</h2>
      <p className="text-xs text-gray-500 mb-3">
        同じ企業の関連レコードを他DBから抽出しています（件数と検索リンクのみ）。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Link
            key={r.domain}
            href={r.cfg.searchPath(data.query.key, data.query.kind)}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <span className="text-xl">{r.cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">{r.cfg.label}</div>
              <div className="text-sm font-bold text-gray-900">{r.count}件</div>
            </div>
            <span className="text-xs text-blue-600">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
