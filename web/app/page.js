"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * トップページ — 大海ナビ
 * Grok版デザイン準拠: 公開データ・業務DB・コンプライアンス支援
 */

const INDUSTRY_TAGS = [
  { label: "建設業", value: "construction" },
  { label: "宅建業", value: "real_estate" },
  { label: "建築士事務所", value: "architecture" },
  { label: "産廃業", value: "waste" },
];

const DB_CARDS = [
  {
    id: "gyosei-shobun", status: "公開中", title: "行政処分",
    subtitle: "建設業・不動産業などの行政処分を検索・監視",
    description: "建設業・宅建業・建築士事務所など各業種の行政処分を横断検索。リスクスコアで定量評価。",
    href: "/gyosei-shobun",
    iconPath: "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z",
  },
  {
    id: "sanpai", status: "公開中", title: "産廃処分",
    subtitle: "廃棄物処理業の行政処分情報を迅速に確認",
    description: "産業廃棄物処理業者への行政処分情報を業者名・地域・処分種別で確認できます。",
    href: "/sanpai",
    iconPath: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  },
  {
    id: "nyusatsu", status: "公開中", title: "入札",
    subtitle: "全国の官公庁入札情報を横断検索",
    description: "国・都道府県・市区町村の入札公告、公募情報を横断して確認できます。",
    href: "/nyusatsu",
    iconPath: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  },
  {
    id: "shitei", status: "公開中", title: "指定管理",
    subtitle: "公共施設の指定管理者公募情報を効率的に把握",
    description: "公共施設の指定管理者の募集情報や選定結果を確認できます。",
    href: "/shitei",
    iconPath: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21",
  },
  {
    id: "hojokin", status: "準備中", title: "補助金",
    subtitle: "国・自治体の補助金情報を一括検索",
    description: "事業者向けの補助金・助成金・支援制度を効率的に検索できます。",
    href: null,
    iconPath: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "kyoninka", status: "準備中", title: "許認可",
    subtitle: "各種許認可・登録情報の最新状況を確認",
    description: "許認可や登録事業者の公開情報を横断して確認できます。",
    href: null,
    iconPath: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
];

function DbCard({ card }) {
  const isActive = !!card.href && card.status !== "準備中";
  const inner = (
    <div className={`h-full bg-white border border-gray-200 rounded-xl flex flex-col transition-all duration-150 ${isActive ? "hover:border-blue-300 hover:shadow-md group" : "opacity-70"}`}>
      <div className="p-5 sm:p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
            </svg>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${card.status === "公開中" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
            {card.status}
          </span>
        </div>
        <h3 className={`font-bold text-lg text-gray-900 mb-1 ${isActive ? "group-hover:text-blue-700" : ""} transition-colors`}>{card.title}</h3>
        <p className="text-sm text-gray-600 mb-2">{card.subtitle}</p>
        <p className="text-[13px] text-gray-500 leading-relaxed">{card.description}</p>
      </div>
    </div>
  );
  return isActive ? <Link href={card.href} className="block">{inner}</Link> : <div>{inner}</div>;
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/gyosei-shobun?keyword=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <>
      <section className="bg-[#1A2F4B] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#152540] via-[#1A2F4B] to-[#1F3A5C]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-xs font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              企業リスク監視 ・ 公開データ横断検索
            </span>
          </div>

          <h1 className="text-[1.75rem] sm:text-[2.5rem] md:text-[3rem] font-extrabold text-white leading-[1.25] tracking-tight mb-4">
            企業リスクを可視化し、<br /><span className="text-blue-400">迅速な意思決定</span>を支援。
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed mb-8">
            行政処分・入札・補助金情報を横断監視。お気に入り登録で新着アラートを自動受信。
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mb-5">
            <div className="flex items-center bg-white rounded-xl shadow-xl shadow-black/10">
              <div className="pl-4 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              </div>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="事業者名・キーワードで検索..." className="flex-1 px-3 py-3.5 sm:py-4 text-sm sm:text-base text-gray-800 placeholder-gray-400 bg-transparent border-none focus:outline-none" />
              <button type="submit" className="px-6 sm:px-8 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-r-xl transition-colors shrink-0">検索</button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2 mb-8">
            {INDUSTRY_TAGS.map((tag) => (
              <button key={tag.value} onClick={() => router.push(`/gyosei-shobun?industry=${tag.value}`)} className="px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                {tag.label}
              </button>
            ))}
            <span className="text-xs text-slate-500 ml-1">↑ 行政処分DBを絞り込む</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/gyosei-shobun" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />行政処分DB <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <Link href="/gyosei-shobun/favorites" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />リスク監視 <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <span className="text-slate-500 text-xs ml-2">無料で利用可能 ・ 会員登録で通知・監視機能を追加</span>
          </div>
        </div>
      </section>

      <section id="databases" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-18 scroll-mt-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-7 rounded-full bg-blue-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">データベース一覧</h2>
        </div>
        <p className="text-sm text-gray-500 mb-8 ml-4">各カテゴリの公開情報を横断検索・確認できます。公開中のDBからご利用いただけます。</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DB_CARDS.map((card) => <DbCard key={card.id} card={card} />)}
        </div>
      </section>

      <section className="bg-slate-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-18">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 rounded-full bg-blue-600" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">こんな用途で活用できます</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z", title: "調査・審査", description: "取引先の行政処分履歴を確認。リスクスコアで定量評価し、初動調査を効率化。" },
              { icon: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z", title: "監視・継続確認", description: "ウォッチリスト登録で新着処分を自動検知。メール通知で変化を見逃さない。" },
              { icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z", title: "営業・企画", description: "入札情報や補助金制度を検索し、市場調査や提案機会の把握に活用。" },
            ].map((uc) => (
              <div key={uc.title} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={uc.icon} /></svg>
                </div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">{uc.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1A2F4B]">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">まずは行政処分DBから試す</h2>
          <p className="text-sm text-slate-500 mb-6">ユーザー登録なしで全機能を利用できます。</p>
          <Link href="/gyosei-shobun" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors">
            行政処分DBを開く <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
      </section>
    </>
  );
}
