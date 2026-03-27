"use client";

import Link from "next/link";

/**
 * 関連ドメイン回遊導線
 * 各ドメインの一覧/詳細ページに配置し、自然な関連ドメインへ誘導
 *
 * Usage: <RelatedDomains currentDomain="hojokin" />
 */

const DOMAIN_RELATIONS = {
  "food-recall": [
    { id: "sanpai", icon: "🚛", label: "産廃処分ウォッチ", path: "/sanpai", reason: "環境・廃棄物の監視情報" },
    { id: "hojokin", icon: "💰", label: "補助金ナビ", path: "/hojokin", reason: "食品業向け補助金を探す" },
  ],
  "shitei": [
    { id: "hojokin", icon: "💰", label: "補助金ナビ", path: "/hojokin", reason: "事業者向け補助金・助成金" },
    { id: "kyoninka", icon: "📋", label: "許認可検索", path: "/kyoninka", reason: "施設運営に必要な許認可を確認" },
  ],
  "sanpai": [
    { id: "kyoninka", icon: "📋", label: "許認可検索", path: "/kyoninka", reason: "建設・廃棄物の許認可事業者を検索" },
    { id: "food-recall", icon: "🥫", label: "食品リコール監視", path: "/food-recall", reason: "食品関連のリコール情報" },
  ],
  "kyoninka": [
    { id: "sanpai", icon: "🚛", label: "産廃処分ウォッチ", path: "/sanpai", reason: "廃棄物処理業者の行政処分情報" },
    { id: "shitei", icon: "🏛️", label: "指定管理公募", path: "/shitei", reason: "公共施設の管理運営公募" },
  ],
  "saas": [
    { id: "hojokin", icon: "💰", label: "補助金ナビ", path: "/hojokin", reason: "IT導入・DX補助金を探す" },
    { id: "yutai", icon: "🎁", label: "株主優待ナビ", path: "/yutai", reason: "IT企業の株主優待を比較" },
  ],
  "hojokin": [
    { id: "saas", icon: "💻", label: "SaaS比較ナビ", path: "/saas", reason: "IT導入補助金の対象ツールを比較" },
    { id: "shitei", icon: "🏛️", label: "指定管理公募", path: "/shitei", reason: "公共施設の管理運営案件" },
    { id: "kyoninka", icon: "📋", label: "許認可検索", path: "/kyoninka", reason: "事業に必要な許認可を確認" },
  ],
  "yutai": [
    { id: "saas", icon: "💻", label: "SaaS比較ナビ", path: "/saas", reason: "業務ツールを比較" },
    { id: "minpaku", icon: "🏠", label: "民泊ナビ", path: "/minpaku", reason: "比較型ドメインで物件を探す" },
  ],
  "minpaku": [
    { id: "yutai", icon: "🎁", label: "株主優待ナビ", path: "/yutai", reason: "レジャー・旅行系の優待を探す" },
    { id: "hojokin", icon: "💰", label: "補助金ナビ", path: "/hojokin", reason: "観光・宿泊業向け補助金" },
  ],
};

export default function RelatedDomains({ currentDomain }) {
  const relations = DOMAIN_RELATIONS[currentDomain];
  if (!relations || relations.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-bold text-gray-500 mb-3">関連ドメイン</h3>
        <div className="flex flex-wrap gap-3">
          {relations.map((rel) => (
            <Link
              key={rel.id}
              href={rel.path}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
            >
              <span className="text-xl">{rel.icon}</span>
              <div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 block">
                  {rel.label}
                </span>
                <span className="text-xs text-gray-400">{rel.reason}</span>
              </div>
              <span className="text-gray-300 group-hover:text-blue-400 ml-1">→</span>
            </Link>
          ))}
          <Link
            href="/search"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-500 transition-colors text-sm"
          >
            🔍 全ドメイン横断検索
          </Link>
        </div>
      </div>
    </div>
  );
}
