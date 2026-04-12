import Link from "next/link";

const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
      </svg>
    ),
    title: "大会を検索",
    desc: "全国のマラソン大会を日程・エリア・距離で横断検索。RUNNET等の公開情報をもとに掲載しています。",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
      </svg>
    ),
    title: "お気に入りでウォッチ",
    desc: "気になる大会をお気に入り登録。情報更新やエントリー状況をいつでも確認できます。",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
      </svg>
    ),
    title: "締切通知を受け取る",
    desc: "エントリー締切が近づいたらメールでお知らせ。申し込み忘れを防ぎます。",
  },
];

export default function TopFeatureList() {
  return (
    <section className="bg-gray-50 py-14">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-lg font-bold" style={{ color: "#1a1a1a" }}>Risk Monitorでできること</h2>
          <p className="text-xs font-medium mt-1" style={{ color: "#1a1a1a" }}>探す → 保存する → 通知を受け取る</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl p-6 text-center border border-gray-100"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-600 mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold text-sm mb-2" style={{ color: "#1a1a1a" }}>{f.title}</h3>
              <p className="text-xs font-medium leading-relaxed" style={{ color: "#1a1a1a" }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8 space-y-2" suppressHydrationWarning>
          <p className="text-[11px] text-gray-400" suppressHydrationWarning>
            ※ 大会情報はRUNNET等の公開情報をもとに掲載しています。最終的な条件確認は掲載元ページでご確認ください。
          </p>
          <p className="text-[11px] text-gray-400" suppressHydrationWarning>
            掲載内容の修正・削除をご希望の場合は、
            <Link href="/contact" className="text-blue-500 hover:text-blue-700 underline">
              お問い合わせ
            </Link>
            よりご連絡ください。
          </p>
        </div>
      </div>
    </section>
  );
}
