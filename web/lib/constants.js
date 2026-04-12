export const SITE_NAME = "Risk Monitor";
export const SITE_DESCRIPTION = "企業リスク監視プラットフォーム";

/**
 * スポーツ種別マスター
 *
 * enabled: true のものがUI/ルーティングで有効。
 * 新ジャンル追加時: ここに定義 → app/{slug}/page.js 作成 → スクレイパー追加
 *
 * ルーティング設計:
 *   /marathon     — マラソン・ランニング（Phase1 対応済み）
 *   /trail        — トレイルラン
 *   /cycling      — サイクリング・自転車
 *   /triathlon    — トライアスロン
 *   /walking      — ウォーキング
 *   /swimming     — 水泳
 *   /workshop     — 練習会・講習会
 */
export const SPORT_TYPES = [
  { key: "marathon", label: "マラソン", slug: "marathon", icon: "🏃", enabled: true },
  { key: "trail", label: "トレイルラン", slug: "trail", icon: "⛰️", enabled: false },
  { key: "triathlon", label: "トライアスロン", slug: "triathlon", icon: "🏊", enabled: false },
  { key: "cycling", label: "サイクリング", slug: "cycling", icon: "🚴", enabled: false },
  { key: "walking", label: "ウォーキング", slug: "walking", icon: "🚶", enabled: false },
  { key: "swimming", label: "水泳", slug: "swimming", icon: "🏊‍♂️", enabled: false },
  { key: "workshop", label: "練習会・講習会", slug: "workshop", icon: "📋", enabled: false },
];

export const REGIONS = [
  { key: "hokkaido", label: "北海道", prefectures: ["北海道"] },
  { key: "tohoku", label: "東北", prefectures: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { key: "kanto", label: "関東", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { key: "chubu", label: "中部", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { key: "kinki", label: "近畿", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { key: "chugoku", label: "中国", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { key: "shikoku", label: "四国", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { key: "kyushu", label: "九州・沖縄", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];

export const ENTRY_STATUS = {
  open: { label: "受付中", color: "green" },
  upcoming: { label: "受付予定", color: "blue" },
  closed: { label: "締切", color: "gray" },
  cancelled: { label: "中止", color: "red" },
  unknown: { label: "不明", color: "gray" },
};

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  key: String(i + 1),
  label: `${i + 1}月`,
}));
