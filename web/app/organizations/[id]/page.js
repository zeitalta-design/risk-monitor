"use client";

/**
 * 企業詳細ページ（cross-domain hub）
 *
 * - organizations テーブル 1 行を表示
 * - CrossDomainLinks で入札/補助金/許認可/行政処分/産廃の件数＋検索リンク
 * - 表記ゆれ（variants）と resolved_entities 接続を整理表示
 *
 * 重い集計や統合ダッシュボードは意図的に載せていない。件数+リンクで十分。
 */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import CrossDomainLinks from "@/components/core/CrossDomainLinks";

export const dynamic = "force-dynamic";

// source_domain / source の値を人間表記に。
const DOMAIN_META = {
  nyusatsu:          { label: "入札",     icon: "📝" },
  nyusatsu_backfill: { label: "入札",     icon: "📝" },
  hojokin:           { label: "補助金",   icon: "💰" },
  kyoninka:          { label: "許認可",   icon: "📋" },
  gyosei_shobun:     { label: "行政処分", icon: "⚠️" },
  gyosei_shobun_seed:{ label: "行政処分", icon: "⚠️" },
  sanpai:            { label: "産廃",     icon: "🚛" },
  seed:              { label: "seed",     icon: "🌱" },
};

function domainMeta(raw) {
  if (!raw) return null;
  const base = String(raw).toLowerCase();
  // prefix match（_backfill / _seed などを吸収）
  for (const key of Object.keys(DOMAIN_META)) {
    if (base === key || base.startsWith(`${key}_`)) return { ...DOMAIN_META[key], raw };
  }
  return { label: raw, icon: "•", raw };
}

function DomainPill({ source, variant = "default" }) {
  const meta = domainMeta(source);
  if (!meta) return null;
  const cls = variant === "solid"
    ? "bg-blue-50 text-blue-700 border-blue-100"
    : "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${cls}`}>
      <span aria-hidden>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

export default function OrganizationDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/organizations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <main className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">読み込み中…</main>;
  }
  if (error || !data) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-red-600 mb-4">企業が見つかりません: {error || "not found"}</p>
        <Link href="/" className="text-blue-600 hover:underline">← ホームに戻る</Link>
      </main>
    );
  }

  const { organization: org, variants, links } = data;
  const displayName = org.display_name || org.normalized_name;
  const lookupKey = org.corporate_number || displayName;
  const prefCity = [org.prefecture, org.city].filter(Boolean).join(" ");

  // variants を raw_name ごとにグルーピング（どのドメインでどう観測されたか）
  const groupedVariants = (() => {
    const map = new Map();
    for (const v of variants || []) {
      const key = v.raw_name || "(未記録)";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    }
    return [...map.entries()].map(([raw_name, obs]) => ({
      raw_name,
      observations: obs,
      // 代表 confidence は最大値
      maxConfidence: obs.reduce((m, o) => Math.max(m, o.confidence ?? 0), 0),
    }));
  })();

  // 観測ドメイン（variants のソース + links のソース + organizations.source）をユニークに
  const observedDomains = (() => {
    const s = new Set();
    if (org.source) s.add(domainMeta(org.source)?.label);
    for (const v of variants || []) {
      const m = domainMeta(v.source_domain);
      if (m) s.add(m.label);
    }
    s.delete(undefined);
    s.delete(null);
    return [...s];
  })();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">HOME</Link>
        <span className="mx-1">/</span>
        <Link href="/organizations" className="hover:underline">企業</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900 font-medium truncate">{displayName}</span>
      </nav>

      {/* ヘッダ */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{displayName}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
          {org.corporate_number && (
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
              法人番号 {org.corporate_number}
            </span>
          )}
          {prefCity && <span className="text-xs">📍 {prefCity}</span>}
          {org.source && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <span className="text-gray-400">初出:</span>
              <DomainPill source={org.source} variant="solid" />
            </span>
          )}
          {observedDomains.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <span className="text-gray-400">観測ドメイン</span>
              <span className="font-bold text-gray-700 tabular-nums">{observedDomains.length}</span>
              <span className="text-gray-400">/5</span>
            </span>
          )}
          {org.is_active === 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">非表示</span>
          )}
        </div>
      </header>

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["表示名", displayName],
              ["正規化名", org.normalized_name],
              ["法人番号", org.corporate_number || "—"],
              ["所在地", prefCity || "—"],
              ["住所", org.address || "—"],
              ["作成日", org.created_at],
              ["更新日", org.updated_at],
            ].filter(([, v]) => v != null && v !== "" && v !== "—").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b border-gray-100" : ""}>
                <td className="py-2 text-gray-500 w-32">{label}</td>
                <td className="py-2 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 他DB情報（cross-domain hub の本体） */}
      <CrossDomainLinks lookupKey={lookupKey} />

      {/* 表記ゆれ（raw_name ごとにグルーピング） */}
      {groupedVariants.length > 0 && (
        <section className="card p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-900">表記ゆれ履歴</h2>
            <span className="text-xs text-gray-400 tabular-nums">
              {groupedVariants.length}通りの表記 / 計 {variants.length}件観測
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            各ドメインでこの企業を観測した際の原文表記と照合方法。
          </p>
          <ul className="space-y-2">
            {groupedVariants.map((g, i) => (
              <li key={i} className="border-b border-gray-50 last:border-b-0 pb-2 last:pb-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 break-all">{g.raw_name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {g.observations.map((o, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <DomainPill source={o.source_domain} />
                          {o.match_method && (
                            <span className="text-gray-400">· {o.match_method}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-gray-400">max conf</span>
                    <div className="text-xs tabular-nums text-gray-600">
                      {g.maxConfidence ? g.maxConfidence.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* resolved_entities 接続（低レイヤ情報だが traceability 目的で見せる） */}
      {links.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">resolved_entities 接続</h2>
          <p className="text-xs text-gray-500 mb-3">
            この企業が nyusatsu 側の resolver でどの entity として扱われているか。
          </p>
          <ul className="text-sm space-y-1">
            {links.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-1.5 last:border-b-0">
                <Link
                  href={`/nyusatsu/entities/${l.resolved_entity_id}`}
                  className="text-blue-600 hover:underline truncate"
                >
                  {l.resolved_canonical_name || `entity #${l.resolved_entity_id}`}
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Phase J-4: この entity で /nyusatsu landing に遷移（entity picker が拾う） */}
                  <Link
                    href={`/nyusatsu?entityId=${l.resolved_entity_id}`}
                    className="text-xs text-[#2F9FD3] hover:text-[#2789b8] hover:underline"
                  >
                    この企業で有望案件を見る →
                  </Link>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {l.link_type} · {l.source} · conf={l.confidence?.toFixed?.(2) ?? l.confidence}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
