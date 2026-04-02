"use client";
import Link from "next/link";

/**
 * トップページ — 大海ナビ: 公開データ / 業務DBカタログ
 *
 * 利用可能なデータベースをカード一覧で表示する。
 * DB_CARDS 配列にカードを追加するだけで拡張可能。
 */

// ─── カテゴリカラー定義 ─────────────────────
const CATEGORY_COLORS = {
  "行政 / 規制":    { accent: "#1F6FB2", bg: "bg-[#EBF4FB]", text: "text-[#1F6FB2]" },
  "調達 / 入札":    { accent: "#0E7490", bg: "bg-[#E6F7FA]", text: "text-[#0E7490]" },
  "支援制度":       { accent: "#2E8B57", bg: "bg-[#EAF5EF]", text: "text-[#2E8B57]" },
  "事業者情報":     { accent: "#7C5CFA", bg: "bg-[#F0ECFE]", text: "text-[#7C5CFA]" },
  "監視 / アラート": { accent: "#D97706", bg: "bg-[#FEF3E2]", text: "text-[#D97706]" },
};

// ─── 状態バッジスタイル ─────────────────────
const STATUS_STYLES = {
  "公開中":     { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  "一部提供中": { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  "準備中":     { bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200" },
  "構想中":     { bg: "bg-gray-50",   text: "text-gray-400",   border: "border-gray-200" },
};

// ─── DBカードデータ ─────────────────────
const DB_CARDS = [
  {
    id: "gyosei-shobun",
    status: "公開中",
    category: "行政 / 規制",
    icon: "📋",
    title: "行政処分データベース",
    description: "不動産・建設・運輸などの行政処分情報を確認できるデータベースです。事業者確認や継続監視に活用できます。",
    tags: ["コンプライアンス", "監視", "調査", "審査"],
    targetUsers: "管理部門 / 審査部門 / 調査担当",
    href: "/gyosei-shobun",
    cta: "詳細を見る",
  },
  {
    id: "nyusatsu",
    status: "準備中",
    category: "調達 / 入札",
    icon: "🏛",
    title: "公共調達・入札データベース",
    description: "官公庁・自治体の調達、公募、入札関連情報を整理して確認できるデータベースです。",
    tags: ["公共営業", "案件探索", "市場調査"],
    targetUsers: "営業部門 / 企画部門",
    href: null,
    cta: "準備中",
  },
  {
    id: "hojokin",
    status: "準備中",
    category: "支援制度",
    icon: "💡",
    title: "補助金・支援制度データベース",
    description: "国や自治体の補助金・助成金・支援制度を整理して確認できるデータベースです。",
    tags: ["制度調査", "営業支援", "情報収集"],
    targetUsers: "営業部門 / 企画部門 / 支援担当",
    href: null,
    cta: "準備中",
  },
  {
    id: "kyoninka",
    status: "構想中",
    category: "事業者情報",
    icon: "🔍",
    title: "許認可・登録事業者データベース",
    description: "許認可や登録事業者の公開情報を横断して確認できるデータベースです。",
    tags: ["事業者確認", "調査", "審査補助"],
    targetUsers: "審査部門 / 管理部門 / 調査担当",
    href: null,
    cta: "構想中",
  },
  {
    id: "watchlist",
    status: "提供中",
    category: "監視 / アラート",
    icon: "👁",
    title: "リスク監視・通知",
    description: "取引先・競合の行政処分を継続監視。新着処分が登録されると通知を受け取れます。危険度スコアで優先度を可視化。",
    tags: ["ウォッチ", "リスク管理", "通知", "継続監視"],
    targetUsers: "管理部門 / 審査部門 / 経営層",
    href: "/risk-watch",
    cta: "監視を始める",
  },
];

// ─── 用途セクションデータ ─────────────────────
const USE_CASES = [
  { icon: "🔎", title: "調査・審査", description: "対象事業者の確認や初動調査に。" },
  { icon: "👁", title: "監視・継続確認", description: "更新や変化の継続監視に。" },
  { icon: "📊", title: "営業・企画", description: "市場調査や提案機会の把握に。" },
];

// ─── DBカードコンポーネント ─────────────────────
function DbCard({ card }) {
  const catColor = CATEGORY_COLORS[card.category] || CATEGORY_COLORS["行政 / 規制"];
  const statusStyle = STATUS_STYLES[card.status] || STATUS_STYLES["準備中"];
  const isActive = !!card.href && card.status !== "準備中" && card.status !== "構想中";

  const inner = (
    <div
      className={`h-full overflow-hidden rounded-2xl bg-white border border-gray-100
                  shadow-sm flex flex-col transition-all duration-300
                  ${isActive ? "hover:shadow-md hover:-translate-y-0.5 group" : "opacity-90"}`}
    >
      {/* アクセントバー */}
      <div className="h-1 w-full" style={{ backgroundColor: catColor.accent }} />

      {/* ヘッダー: 状態バッジ + カテゴリ */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
          {card.status}
        </span>
        <span className={`text-[10px] font-semibold ${catColor.text}`}>
          {card.category}
        </span>
      </div>

      {/* タイトル */}
      <div className="px-5 pb-2 flex items-start gap-2.5">
        <span className="text-2xl flex-shrink-0 mt-0.5">{card.icon}</span>
        <h3 className={`font-bold text-[15px] leading-snug text-gray-900 ${isActive ? "group-hover:text-[#1F6FB2]" : ""} transition-colors`}>
          {card.title}
        </h3>
      </div>

      {/* 説明 */}
      <div className="px-5 pb-3 flex-1">
        <p className="text-[13px] leading-[1.7] text-gray-600 line-clamp-3">
          {card.description}
        </p>
      </div>

      {/* タグ */}
      <div className="px-5 pb-3 flex flex-wrap gap-1.5">
        {card.tags.map((tag) => (
          <span key={tag} className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
            {tag}
          </span>
        ))}
      </div>

      {/* 対象ユーザー */}
      <div className="px-5 pb-3">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-600">対象:</span> {card.targetUsers}
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4 pt-2 mt-auto border-t border-gray-50">
        {isActive ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1F6FB2] group-hover:gap-2 transition-all">
            {card.cta}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        ) : (
          <span className="text-sm text-gray-400 font-medium">{card.cta}</span>
        )}
      </div>
    </div>
  );

  if (isActive) {
    return <Link href={card.href} className="block">{inner}</Link>;
  }
  return <div>{inner}</div>;
}

// ─── メインページ ─────────────────────
export default function HomePage() {
  return (
    <>
      {/* ── ヒーロー — 行政処分DB統合エントリー ── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0F2A4A 0%, #1A3F6B 40%, #1F5080 100%)" }}>
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 60%, rgba(100,180,255,0.5), transparent 45%), " +
              "radial-gradient(circle at 85% 30%, rgba(80,160,240,0.4), transparent 50%)",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          {/* ラベル */}
          <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-3">
            行政処分 · リスク監視 · コンプライアンス支援
          </p>
          {/* タイトル */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mb-2">
            行政処分データベース
          </h1>
          <p className="text-sm text-white/60 mb-6 max-w-xl">
            建設業・宅建業・建築士事務所・産廃業の行政処分情報を横断検索。取引先の確認・継続監視に活用できます。
          </p>
          {/* 検索フォーム — GETで /gyosei-shobun へ */}
          <form
            action="/gyosei-shobun"
            method="get"
            className="flex gap-2 max-w-xl"
          >
            <input
              name="organization"
              type="text"
              placeholder="事業者名・キーワードで検索..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:bg-white/15 focus:border-white/40"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#1F6FB2] hover:bg-[#1a5e99] text-white text-sm font-bold transition-colors whitespace-nowrap"
            >
              検索
            </button>
          </form>
          {/* 業種タグ */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: "建設業", slug: "construction" },
              { label: "宅建業", slug: "real_estate" },
              { label: "建築士事務所", slug: "architecture" },
              { label: "産廃業", slug: "waste" },
            ].map(({ label, slug }) => (
              <a
                key={slug}
                href={`/gyosei-shobun?industry=${slug}`}
                className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 text-white/55 hover:border-white/35 hover:text-white/80 transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
          {/* 統計バー */}
          <div className="flex items-center gap-6 mt-6 pt-5 border-t border-white/10">
            <a href="/gyosei-shobun" className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <span className="text-xs font-medium">行政処分DB</span>
              <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </a>
            <a href="/risk-watch" className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium">リスク監視</span>
              <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── 大海ナビとは ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-7 rounded-full" style={{ backgroundColor: "#1F6FB2" }} />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
            大海ナビとは
          </h2>
        </div>
        <p className="text-sm sm:text-[15px] leading-relaxed text-gray-600">
          公開情報や業務利用可能なデータを、実務で使いやすい形で整理して案内するためのカタログです。
        </p>
        <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-gray-500">
          単なるリンク集ではなく、概要・用途・対象ユーザーを確認しながらデータベースを探せます。
        </p>
      </section>

      {/* ── DB一覧 ── */}
      <section id="databases" className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 scroll-mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1 h-7 rounded-full" style={{ backgroundColor: "#1F6FB2" }} />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
            公開中 / 提供予定のデータベース
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mb-8 ml-4">
          各データベースの概要、用途、対象ユーザーを一覧で確認できます。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DB_CARDS.map((card) => (
            <DbCard key={card.id} card={card} />
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          各データベースの収録範囲や提供状況は、順次更新・拡充していきます。
        </p>
      </section>

      {/* ── 用途セクション ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-7 rounded-full" style={{ backgroundColor: "#1F6FB2" }} />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
            こんな用途で活用できます
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <span className="text-2xl">{uc.icon}</span>
              <h3 className="mt-2 font-bold text-sm text-gray-900">{uc.title}</h3>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{uc.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 締め ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 text-center">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2">
          大海原の情報を、業務で使える形に。
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
          大海ナビは、公開情報の中から実務に役立つデータベースを見つけやすく整理していきます。
        </p>
      </section>
    </>
  );
}
