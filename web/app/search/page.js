"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

const DOMAIN_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "food-recall", label: "🥫 食品リコール" },
  { value: "shitei", label: "🏛️ 指定管理" },
  { value: "sanpai", label: "🚛 産廃" },
  { value: "kyoninka", label: "📋 許認可" },
  { value: "saas", label: "💻 SaaS" },
  { value: "hojokin", label: "💰 補助金" },
];

export default function PlatformSearchPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/platform/search?q=${encodeURIComponent(query)}&domain=${domain}&limit=30`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, domain]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">横断検索</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/platform/search"
            className="text-xs text-blue-600 hover:underline"
          >
            プラットフォーム版 →
          </Link>
          <Link
            href="/platform/dashboard"
            className="text-xs text-blue-600 hover:underline"
          >
            ダッシュボード →
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">全ドメインからキーワードで検索できます</p>

      <div className="card p-4 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="キーワードで検索..."
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
          />
          <button onClick={search} disabled={loading || query.length < 2} className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "検索中..." : "検索"}
          </button>
        </div>
        <div className="flex gap-1 mt-3 flex-wrap">
          {DOMAIN_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setDomain(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${domain === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {searched && !loading && (
        <p className="text-sm text-gray-500 mb-4">{total}件の結果</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <Link key={`${r.domain}-${r.slug}-${i}`} href={r.url} className="card p-4 block hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{r.domainIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{r.title}</h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">{r.domainLabel}</span>
                  </div>
                  {r.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.summary}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-500">検索結果がありません</p>
          <p className="text-xs text-gray-400 mt-1">キーワードを変えてお試しください</p>
        </div>
      )}
    </div>
  );
}
