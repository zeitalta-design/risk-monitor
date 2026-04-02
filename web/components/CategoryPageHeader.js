/**
 * CategoryPageHeader — カテゴリ一覧ページ共通ヘッダー
 *
 * 行政処分DBと同系統のB2B業務UIトーンで各カテゴリページに統一感を持たせる。
 * DomainListPage の headerSlot に渡して使用する。
 * ロジック・API・フィルタには一切干渉しない。
 */

const CATEGORY_META = {
  gyosei: {
    accent: "#1F6FB2",
    lightBg: "#EBF4FB",
    label: "行政 / 規制",
    title: "行政処分データベース",
    description: "建設業・宅建業・建築士事務所など各業種の行政処分情報を横断検索できます。",
    note: "国土交通省・都道府県等の公開情報をもとに収録しています。",
  },
  sanpai: {
    accent: "#0E7490",
    lightBg: "#E6F7FA",
    label: "産廃 / 環境",
    title: "産廃処分データベース",
    description: "産業廃棄物処理業者への行政処分情報を業者名・地域・処分種別で確認できます。",
    note: "都道府県・政令市等の公開情報をもとに収録しています。",
  },
  nyusatsu: {
    accent: "#4A5568",
    lightBg: "#EEF0F5",
    label: "調達 / 入札",
    title: "公共調達・入札データベース",
    description: "官公庁・自治体の入札公告・公募情報を横断して確認できます。",
    note: "各省庁・都道府県・市区町村の公開情報をもとに収録しています。",
  },
  shitei: {
    accent: "#2E7D6B",
    lightBg: "#EAF4F1",
    label: "公共施設",
    title: "指定管理者データベース",
    description: "公共施設の指定管理者制度に関する公募・選定・更新情報を確認できます。",
    note: "都道府県・市区町村の公開情報をもとに収録しています。",
  },
  hojokin: {
    accent: "#2E8B57",
    lightBg: "#EAF5EF",
    label: "支援制度",
    title: "補助金・支援制度データベース",
    description: "国・都道府県・市区町村の補助金・助成金・支援制度を条件付きで確認できます。",
    note: "各省庁・自治体の公開情報をもとに収録しています。",
  },
  kyoninka: {
    accent: "#6B46C1",
    lightBg: "#F0ECFE",
    label: "事業者情報",
    title: "許認可・登録事業者データベース",
    description: "各業種の許認可・登録事業者情報を横断して確認できます。",
    note: "各省庁・都道府県等の公開情報をもとに収録しています。",
  },
};

// カテゴリ別SVGアイコン
const CATEGORY_ICONS = {
  gyosei: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  sanpai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  nyusatsu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  shitei: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  hojokin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  kyoninka: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

/**
 * @param {"gyosei"|"sanpai"|"nyusatsu"|"shitei"|"hojokin"|"kyoninka"} categoryId
 */
export default function CategoryPageHeader({ categoryId }) {
  const meta = CATEGORY_META[categoryId];
  const icon = CATEGORY_ICONS[categoryId];
  if (!meta) return null;

  return (
    <div
      className="rounded-2xl mb-6 px-4 sm:px-5 py-3.5 sm:py-4 flex items-start gap-3 sm:gap-4"
      style={{ background: `linear-gradient(135deg, ${meta.accent}18 0%, ${meta.lightBg} 100%)`, borderLeft: `4px solid ${meta.accent}` }}
    >
      {/* アイコン */}
      <div
        className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mt-0.5"
        style={{ backgroundColor: meta.lightBg, color: meta.accent }}
      >
        {icon}
      </div>

      {/* テキスト */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: meta.accent, borderColor: `${meta.accent}40`, backgroundColor: `${meta.accent}12` }}
          >
            {meta.label}
          </span>
          <h1 className="text-base font-extrabold text-gray-900 leading-tight">
            {meta.title}
          </h1>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed">
          {meta.description}
        </p>
        <p className="text-[11px] text-gray-400 mt-1">
          {meta.note}
        </p>
      </div>
    </div>
  );
}
