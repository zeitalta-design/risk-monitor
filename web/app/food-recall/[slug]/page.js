"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getCategoryLabel,
  getCategoryIcon,
  getRiskLevel,
  getReasonLabel,
  getRecallTypeLabel,
  getStatusBadge,
  formatRecallDate,
} from "@/lib/food-recall-config";

const foodRecallDomain = getDomain("food-recall");

export default function FoodRecallDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/food-recall/${slug}`);
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

  if (loading) return <DomainDetailPage loading />;

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">リコール情報が見つかりません</p>
            <Link href="/food-recall" className="btn-primary inline-block">リコール一覧へ</Link>
          </div>
        }
      />
    );
  }

  const risk = getRiskLevel(item.risk_level);
  const sb = getStatusBadge(item.status);

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/food-recall" className="hover:text-blue-600">食品リコール監視</Link><span>/</span><span>{item.product_name}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.product_name}
      subtitle={item.manufacturer}
      meta={
        <>
          <span className={`badge ${risk.color}`}>{risk.label}</span>
          <span className={`badge ${sb.color}`}>{sb.label}</span>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className="text-xs text-gray-500">リコール日: {formatRecallDate(item.recall_date)}</span>
        </>
      }
      actions={
        <>
          {foodRecallDomain && <DomainFavoriteButton itemId={item.id} domain={foodRecallDomain} variant="button" />}
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/food-recall" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      {/* 概要 */}
      {item.summary && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">リコール概要</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
        </section>
      )}

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["商品名", item.product_name],
              ["製造者", item.manufacturer],
              ["食品カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["リコール種別", getRecallTypeLabel(item.recall_type)],
              ["原因", getReasonLabel(item.reason)],
              ["リスクレベル", <span key="r" className={`badge ${risk.color}`}>{risk.label}</span>],
              ["対象地域", item.affected_area],
              ["ロット番号", item.lot_number],
              ["リコール日", formatRecallDate(item.recall_date)],
              ["ステータス", <span key="s" className={`badge ${sb.color}`}>{sb.label}</span>],
            ].filter(([, v]) => v != null && v !== "—" && v !== "").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 消費者への対応 */}
      {item.consumer_action && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">消費者への対応</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.consumer_action}</p>
        </section>
      )}

      {/* 参照リンク */}
      {(item.source_url || item.manufacturer_url) && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">参照リンク</h2>
          <div className="space-y-2">
            {item.source_url && (
              <div>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  情報元を見る →
                </a>
              </div>
            )}
            {item.manufacturer_url && (
              <div>
                <a href={item.manufacturer_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  製造者のお知らせを見る →
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 関連導線 */}
      <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
        {item.category && (
          <Link href={`/food-recall/category/${item.category}`} className="block text-sm text-blue-600 hover:underline">
            {getCategoryIcon(item.category)} {getCategoryLabel(item.category)}のリコール情報をもっと見る →
          </Link>
        )}
      </div>
    </DomainDetailPage>
  );
}
