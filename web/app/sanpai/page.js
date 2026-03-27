"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DomainListPage from "@/components/core/DomainListPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  sanpaiConfig,
  getLicenseTypeLabel,
  getLicenseTypeIcon,
  getRiskLevel,
  getStatusBadge,
  formatDate,
  getDaysSincePenalty,
} from "@/lib/sanpai-config";

const sanpaiDomain = getDomain("sanpai");

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function RiskBadge({ level }) {
  const r = getRiskLevel(level);
  return <span className={`badge ${r.color}`}>{r.label}</span>;
}

function CardBadges({ item }) {
  const sb = getStatusBadge(item.status);
  const days = getDaysSincePenalty(item.latest_penalty_date);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <RiskBadge level={item.risk_level} />
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getLicenseTypeLabel(item.license_type)}</span>
      {item.penalty_count > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">処分{item.penalty_count}件</span>
      )}
      {days && (
        <span className={`text-xs ${days.recent ? "text-red-600 font-bold" : "text-gray-500"}`}>
          最終処分: {days.text}
        </span>
      )}
    </div>
  );
}

function SanpaiCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/sanpai/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getLicenseTypeIcon(item.license_type)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/sanpai/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.company_name}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {sanpaiDomain && <DomainFavoriteButton itemId={item.id} domain={sanpaiDomain} />}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{[item.prefecture, item.city].filter(Boolean).join(" ") || "—"}</p>
        {item.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.notes}</p>}
        <CardBadges item={item} />
      </div>
    </div>
  );
}

export default function SanpaiListPage() {
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (prefecture) params.set("prefecture", prefecture);
      if (licenseType) params.set("license_type", licenseType);
      if (riskLevel) params.set("risk_level", riskLevel);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      const res = await fetch(`/api/sanpai?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch sanpai items:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, prefecture, licenseType, riskLevel, status, sort, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function resetFilters() {
    setKeyword(""); setPrefecture(""); setLicenseType("");
    setRiskLevel(""); setStatus(""); setSort("newest"); setPage(1);
  }

  return (
    <DomainListPage
      title="産廃処分ウォッチ"
      subtitle={loading ? "読み込み中..." : `${total}件の事業者`}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      renderItem={(item) => <SanpaiCard key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="事業者名・事業区域で検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select value={prefecture} onChange={(e) => { setPrefecture(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての都道府県</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select value={licenseType} onChange={(e) => { setLicenseType(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての許可種別</option>
              {sanpaiConfig.licenseTypes.map((t) => (
                <option key={t.slug} value={t.slug}>{t.icon} {t.label}</option>
              ))}
            </select>

            <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのリスクレベル</option>
              {sanpaiConfig.riskLevels.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのステータス</option>
              {sanpaiConfig.statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">並び順:</span>
            {sanpaiConfig.sorts.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSort(s.key); setPage(1); }}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  sort === s.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {(keyword || prefecture || licenseType || riskLevel || status) && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-blue-600">
              条件をリセット
            </button>
          )}
        </div>
      )}
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致する事業者が見つかりません</p>
          <button onClick={resetFilters} className="btn-secondary mt-4">フィルタをリセット</button>
        </div>
      }
      footerSlot={
        <div className="mt-10 pt-8 border-t border-gray-100 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">許可種別から探す</h2>
            <div className="flex flex-wrap gap-2">
              {sanpaiConfig.licenseTypes.map((t) => (
                <button key={t.slug} onClick={() => { setLicenseType(t.slug); setPage(1); }} className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
