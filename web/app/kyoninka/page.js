"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DomainListPage from "@/components/core/DomainListPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  kyoninkaConfig,
  getLicenseFamilyLabel,
  getLicenseFamilyIcon,
  getEntityStatusBadge,
  formatDate,
} from "@/lib/kyoninka-config";

const kyoninkaDomain = getDomain("kyoninka");

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function CardBadges({ item }) {
  const sb = getEntityStatusBadge(item.entity_status);
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      <span className="badge badge-blue">{getLicenseFamilyLabel(item.primary_license_family)}</span>
      {item.registration_count > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">許認可{item.registration_count}件</span>
      )}
      {item.corporate_number && (
        <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">法人番号あり</span>
      )}
    </div>
  );
}

function KyoninkaCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/kyoninka/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getLicenseFamilyIcon(item.primary_license_family)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/kyoninka/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.entity_name}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {kyoninkaDomain && <DomainFavoriteButton itemId={item.id} domain={kyoninkaDomain} />}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{[item.prefecture, item.city].filter(Boolean).join(" ") || "—"}</p>
        {item.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.notes}</p>}
        <CardBadges item={item} />
      </div>
    </div>
  );
}

export default function KyoninkaListPage() {
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [licenseFamily, setLicenseFamily] = useState("");
  const [entityStatus, setEntityStatus] = useState("");
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
      if (licenseFamily) params.set("license_family", licenseFamily);
      if (entityStatus) params.set("entity_status", entityStatus);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      const res = await fetch(`/api/kyoninka?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch kyoninka items:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, prefecture, licenseFamily, entityStatus, sort, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function resetFilters() {
    setKeyword(""); setPrefecture(""); setLicenseFamily("");
    setEntityStatus(""); setSort("newest"); setPage(1);
  }

  return (
    <DomainListPage
      title="許認可検索"
      subtitle={loading ? "読み込み中..." : `${total}件の事業者`}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      renderItem={(item) => <KyoninkaCard key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="事業者名・法人番号・住所で検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={prefecture} onChange={(e) => { setPrefecture(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての都道府県</option>
              {PREFECTURES.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>

            <select value={licenseFamily} onChange={(e) => { setLicenseFamily(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべての許認可カテゴリ</option>
              {kyoninkaConfig.licenseFamilies.map((f) => (
                <option key={f.slug} value={f.slug}>{f.icon} {f.label}</option>
              ))}
            </select>

            <select value={entityStatus} onChange={(e) => { setEntityStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">すべてのステータス</option>
              {kyoninkaConfig.entityStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">並び順:</span>
            {kyoninkaConfig.sorts.map((s) => (
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

          {(keyword || prefecture || licenseFamily || entityStatus) && (
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
            <h2 className="text-sm font-bold text-gray-700 mb-3">許認可カテゴリから探す</h2>
            <div className="flex flex-wrap gap-2">
              {kyoninkaConfig.licenseFamilies.map((f) => (
                <button key={f.slug} onClick={() => { setLicenseFamily(f.slug); setPage(1); }} className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
