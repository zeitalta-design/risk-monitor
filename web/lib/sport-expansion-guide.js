/**
 * ============================================================
 * Phase127: 新スポーツ追加ガイド
 * ============================================================
 *
 * Risk Monitorに新しいスポーツを追加する際の完全手順書。
 * 現在対応: marathon（マラソン）, trail（トレイルラン）
 * 今後追加予定: triathlon, cycling, walking, swimming, workshop
 *
 * ── 前提条件 ──
 * - events テーブルに sport_type カラムで新スポーツのデータが入っていること
 * - スクレイパーが新スポーツの大会データを取得・格納済みであること
 *
 * ============================================================
 * STEP 1: sport-config.js にエントリ追加
 * ============================================================
 *
 * ファイル: lib/sport-config.js
 *
 * SPORT_CONFIGS 配列に新エントリを追加:
 * {
 *   key: "cycling",           // 内部キー（一意）
 *   slug: "cycling",          // URLパスに使うslug
 *   label: "サイクリング",      // 正式名称
 *   shortLabel: "自転車",      // 短縮名（ナビ用）
 *   icon: "🚴",               // アイコン絵文字
 *   categoryType: "race",     // race | workshop
 *   enabled: true,            // true で有効化
 *   order: 4,                 // 表示順
 *   themeColor: "#ea580c",    // テーマカラー（Tailwind互換）
 *   description: "ロード・ヒルクライム・グランフォンド",
 *   sportTypeForDb: "cycling", // events.sport_type の値
 *   distanceFilters: [        // 一覧ページのフィルタ選択肢
 *     { key: "", label: "すべて" },
 *     { key: "short", label: "ショート(〜50km)" },
 *     { key: "medium", label: "ミドル(50〜100km)" },
 *     { key: "long", label: "ロング(100km〜)" },
 *   ],
 *   meta: {                   // SEOメタデータ
 *     title: "サイクリングイベント検索",
 *     pageHeading: "サイクリングイベント一覧",
 *     description: "全国のサイクリングイベント・自転車レースを検索。",
 *     ogTitle: "サイクリングイベント検索 | Risk Monitor",
 *     ogDescription: "全国の自転車イベントを検索。",
 *     searchPlaceholder: "イベント名・コース名",
 *     emptyText: "該当するサイクリングイベントが見つかりませんでした",
 *     ctaText: "サイクリングイベント一覧へ →",
 *     heroText: "全国のサイクリングイベントを探す",
 *     subText: "ロード・ヒルクライムを距離・エリアで絞り込み",
 *   },
 * }
 *
 * → これだけで /cycling が一覧ページとして動作（[sportSlug]/page.js）
 * → ナビゲーション、フッター等にも自動反映
 *
 * ============================================================
 * STEP 2: 距離slug定義（スポーツ固有の場合）
 * ============================================================
 *
 * ファイル: lib/seo-mappings.js
 *
 * マラソンと異なる距離区分がある場合:
 * export const CYCLING_DISTANCE_SLUGS = {
 *   short:  { label: "ショート（〜50km）", shortLabel: "ショート",  range: [0, 50] },
 *   medium: { label: "ミドル（50〜100km）", shortLabel: "ミドル",   range: [50.1, 100] },
 *   long:   { label: "ロング（100km〜）",   shortLabel: "ロング",   range: [100.1, 999] },
 * };
 *
 * ファイル: lib/seo-config.js
 * - getDistanceSlugsForSport() に分岐追加
 *
 * ファイル: lib/seo-queries.js
 * - getEventsByRegionAndDistance() の距離解決に新定義を追加
 *
 * ファイル: app/api/events/route.js
 * - distance の ranges に新キー追加
 *
 * ============================================================
 * STEP 3: テーマslug定義（スポーツ固有の場合）
 * ============================================================
 *
 * ファイル: lib/seo-config.js
 *
 * export const CYCLING_THEME_SLUGS = {
 *   beginner: { label: "初心者向けイベント", shortLabel: "初心者向け", icon: "🔰", ... },
 *   hillclimb: { label: "ヒルクライム大会", shortLabel: "ヒルクライム", icon: "⛰️", ... },
 *   deadline: { label: "締切間近のイベント", ... },
 *   open: { label: "募集中のイベント", ... },
 *   popular: { label: "人気のイベント", ... },
 * };
 *
 * - getThemeSlugsForSport() に分岐追加
 * - buildThemeMetadata() / buildThemeRelatedLinks() が自動対応
 *
 * ============================================================
 * STEP 4: SEOページファイル作成
 * ============================================================
 *
 * app/{sportSlug}/ 以下に以下ファイルを作成（trail のファイルをテンプレートに）:
 *
 * 必須ページ:
 * - app/{slug}/region/page.js          ← 地方別インデックス
 * - app/{slug}/region/[region]/page.js  ← 地方別詳細
 * - app/{slug}/region/[region]/[distance]/page.js ← 地方×距離
 * - app/{slug}/season/page.js          ← 季節別インデックス
 * - app/{slug}/season/[season]/page.js  ← 季節別詳細
 * - app/{slug}/theme/page.js           ← テーマ別インデックス
 * - app/{slug}/theme/[theme]/page.js    ← テーマ別詳細
 * - app/{slug}/distance/page.js        ← 距離別インデックス
 * - app/{slug}/distance/[distance]/page.js ← 距離別詳細
 *
 * 既存ページ（通常は自動で動作）:
 * - app/{slug}/prefecture/[prefecture]/page.js ← 都道府県別
 * - app/{slug}/month/[month]/page.js    ← 月別
 *
 * 各ページで必ず含めること:
 * - trackingPageType + trackingSlug + trackingSportType props
 * - SeoCirculationSection（回遊導線）
 * - SportSwitcher（クロススポーツナビ）← 共通テーマのみ
 *
 * ============================================================
 * STEP 5: sitemap.js に新ページ追加
 * ============================================================
 *
 * ファイル: app/sitemap.js
 *
 * 以下を追加:
 * - 静的インデックスページ（region, season, theme, distance）
 * - 動的ページ（各region, season, theme, distance, prefecture, month）
 *
 * 参考: trail用ページの追加箇所を検索して同パターンで追加
 *
 * ============================================================
 * STEP 6: フッター導線追加
 * ============================================================
 *
 * ファイル: components/Footer.js
 *
 * 新スポーツ用のSEOナビゲーションセクションを追加:
 * - 距離別リンク
 * - 地方別リンク
 * - テーマ別リンク
 * - 季節別リンク
 *
 * ============================================================
 * STEP 7: ランキング対応（任意）
 * ============================================================
 *
 * ファイル: app/rankings/page.js
 * - RANKING_TYPES_BY_SPORT にスポーツ固有カテゴリ追加
 * - SPORT_FILTER_OPTIONS に選択肢追加
 *
 * ファイル: app/api/rankings/route.js
 * - スポーツ固有のランキングカテゴリ追加（必要なら）
 *
 * ファイル: app/calendar/page.js
 * - SPORT_FILTER_OPTIONS に選択肢追加
 *
 * ============================================================
 * STEP 8: seo-sport-helpers.js 更新
 * ============================================================
 *
 * ファイル: lib/seo-sport-helpers.js
 * - getAllSportSeoSlugs() に新slugを追加
 *
 * ============================================================
 * STEP 9: 詳細ページ対応
 * ============================================================
 *
 * ファイル: lib/event-related.js
 * - buildSearchLinksFromEvent() にスポーツ固有の距離slug解決を追加
 *
 * ============================================================
 * STEP 10: 動作確認チェックリスト
 * ============================================================
 *
 * □ npm run build が成功する
 * □ /{slug} 一覧ページが表示される
 * □ SEOページ（region/season/theme/distance/prefecture/month）が表示される
 * □ metadata（title, description, OG）が正しい
 * □ パンくずリストが正しい
 * □ SportSwitcher で他スポーツに遷移できる
 * □ SeoCirculationSection の回遊リンクが正しい
 * □ フッターに新スポーツのリンクが表示される
 * □ sitemap.xml に新ページが含まれる
 * □ ランキング/カレンダーのスポーツフィルタに表示される
 * □ GA4イベントに sport_type が正しく含まれる
 * □ モバイルレスポンシブ確認
 *
 * ============================================================
 * 設計ポイント（FAQ）
 * ============================================================
 *
 * Q: なぜ [sportSlug] ではなく sport 別にファイルを作るのか？
 * A: SEOページはスポーツごとに文言・距離・テーマが異なるため、
 *    薄いラッパーでもファイル分離しておく方がメンテ性が高い。
 *    一覧ページ [sportSlug]/page.js は共通で動作する。
 *
 * Q: テーマが全スポーツ共通ではない理由は？
 * A: "flat-course"はマラソン、"scenic"はトレイル固有。
 *    beginner/open/deadline/popular は共通テーマとして SportSwitcher 対応。
 *
 * Q: 距離slugが重複しても大丈夫？
 * A: 距離slugはURLパス内でスポーツslugにスコープされるため問題ない。
 *    /marathon/distance/full と /trail/distance/short は別ページ。
 */

// このファイルはドキュメント専用です。実行時のコードは含みません。
export const EXPANSION_GUIDE_VERSION = "1.0.0";
