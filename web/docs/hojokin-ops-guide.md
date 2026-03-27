# 補助金ナビ (hojokin) 運用ガイド

## 実ソース一覧

| # | ソース名 | ID | URL | 状態 | 詳細取得 | 取得件数 |
|---|---------|-----|-----|------|---------|---------|
| 1 | ミラサポPlus | mirasapo | mirasapo-plus.go.jp/subsidy/ | active | あり（金額/補助率/状態） | 7件 |
| 2 | J-Net21 支援制度ナビ | jnet21 | j-net21.smrj.go.jp/publicsupport/index.html | active | あり（概要/対象者/提供元/金額） | 55件 |
| 3 | 中小企業庁 公募情報 | chusho_meti | chusho.meti.go.jp/koukai/koubo/ | inactive | なし | 0件 |

### ソース状態詳細

- **ミラサポPlus**: 安定。一覧7件 + 詳細ページから max_amount/subsidy_rate/status を取得
- **J-Net21**: 安定。一覧55件 + 詳細ページから summary/target_type/provider_name/max_amount を補完
- **中小企業庁**: TLS renegotiation loop でタイムアウト（サーバー側問題）。復旧次第コメントアウト解除

### J-Net21 detail 取得の仕様

- 一覧から取得した `detail_url` にアクセスし、本文テキストから以下を抽出:
  - `summary`: 概要セクション優先、フォールバックで最初の意味のある段落
  - `target_type`: 個人事業主/スタートアップ/NPO/中小企業 のキーワード判定
  - `provider_name`: 省庁名/機構名のキーワード判定
  - `max_amount`: 「上限」「最大」「補助金額」等のプレフィックス + 金額パターン
  - `subsidy_rate`: 「補助率」「助成率」近傍の分数/パーセント
  - `deadline`: 締切・期限キーワード近傍の日付
  - `status`: 募集終了/受付停止等の文言検出
- detail 取得失敗時は一覧データ（タイトル+カテゴリ）で継続
- 環境変数 `HOJOKIN_MAX_DETAIL_FETCH` で取得上限を制御（デフォルト30、推奨60）
- 500ms ディレイでポライトフェッチ

### 未接続の候補ソース

| 候補 | URL | 備考 |
|------|-----|------|
| 補助金ポータル | hojyokin-portal.jp | JS動的ロード+bot検知あり。Playwright必要 |
| jGrants | jgrants-portal.go.jp | 電子申請ポータル。API調査未実施 |

## 同期コマンド

```bash
# hojokin 同期
node scripts/cron-sync.js --domain hojokin

# dry-run
node scripts/cron-sync.js --domain hojokin --dry-run

# review 状況確認
node scripts/bulk-review.js status

# 設定確認
node scripts/cron-sync.js --status
```

## cron 設定（推奨: 週次 火曜 07:30）

```
30 7 * * 2 cd /path/to/web && node scripts/cron-sync.js --domain hojokin >> logs/hojokin-sync.log 2>&1
```

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| HOJOKIN_MAX_DETAIL_FETCH | 30 | 詳細ページ取得の上限数（推奨60） |

## フロー

```
ミラサポPlus一覧 → 詳細取得(金額/補助率/状態) → normalize
J-Net21一覧 → 詳細取得(概要/対象/提供元/金額/率) → normalize
  → slug dedup → 既存比較
  → new/updated/unchanged 判定
  → DB upsert (is_published=0) → change_logs 記録
  → 期限切れチェック → expired → closed + change_log
```

## fallback 条件

- 全ソース（mirasapo + jnet21）が失敗した場合のみ `getSampleHojokinItems()` を使用
- 個別ソースの失敗は他ソースに影響しない

## is_published ルール

- 実ソースからの新規: `is_published = 0`（review 後に公開）
- seed データ: `is_published = 1`（初期公開済み）
- admin 手動作成: `is_published = 1`

## review / publish 手順

```bash
# review待ち確認
node -e "const {getDb}=require('./lib/db.js'); const db=getDb();
const c=db.prepare('SELECT COUNT(*) as c FROM hojokin_items WHERE is_published=0').get().c;
console.log('review待ち:', c, '件')"

# 全件公開（確認済みの場合）
node -e "const {getDb}=require('./lib/db.js'); const db=getDb();
const r=db.prepare(\"UPDATE hojokin_items SET is_published=1 WHERE is_published=0\").run();
console.log('公開:', r.changes, '件')"
```

## tracked fields（差分検知対象）

title, category, status, deadline, max_amount, subsidy_rate, target_type, provider_name

## review 優先度

| 優先度 | 対象フィールド | 例 |
|--------|--------------|-----|
| P1 | deadline, status, max_amount | 締切変更、募集終了、金額変更 |
| P2 | target_type, provider_name | 対象条件変更 |
| P3 | category, title | カテゴリ変更、名称変更 |

## ended/closed 判定

1. **締切超過**: `checkHojokinExpiry()` — deadline < today && status == 'open'
2. **文言検出**: `detectClosedStatus()` — 募集終了/受付終了/受付停止
3. **手動**: admin 画面から status を closed に変更

## カテゴリマッピング

| カテゴリ | slug | キーワード |
|---------|------|-----------|
| IT導入 | it | IT, デジタル, DX, ICT, AI |
| 設備投資 | equipment | ものづくり, 設備, 省力化, 環境, GX |
| 雇用 | employment | 雇用, 人材, テレワーク |
| 創業 | startup | 創業, 起業, スタートアップ |
| 研究開発 | rd | 研究, 開発, 技術, イノベーション |
| 海外 | export | 海外, 輸出, 国際 |
| その他 | other | 事業承継, 持続化, etc |

## 制度タイプ別抽出ルール

`detectSchemeType()` でタイトルから制度タイプを判定し、抽出ルールを切り替える。

| 制度タイプ | 判定キーワード | max_amount | subsidy_rate | 備考 |
|-----------|--------------|-----------|-------------|------|
| subsidy（補助金） | 補助金, 補助 | 補助上限額 | 補助率 X/X | 標準パターン |
| grant（助成金） | 助成金, 助成 | 助成上限額 | 助成率 | 同上 |
| loan（融資） | 融資, 貸付, 資金, 共済 | 融資限度額 | 利率 X% / 低利融資 | 金利も取得 |
| tax（税制優遇） | 税制, 税額控除, 特別償却 | 取得しない | 控除率 X% | 金額誤抽出防止 |
| consultation（相談） | ホットライン, ポータル | 取得しない | 取得しない | 金額概念なし |

### 誤抽出回避方針

- 税制・相談系は `max_amount` を取得しない（事業規模の金額と混同するため）
- 100億円超の金額はガードで除外
- タイトルベースで制度タイプを優先判定（本文はあらゆるキーワードが混在するため）
- 融資限度額と補助上限額は別パターンで分離

### 取得できない/しない項目

| 項目 | 理由 |
|------|------|
| 画像内の金額 | J-Net21 の一部ページは金額を画像で表示。テキスト取得不可 |
| 税制の減税額 | 制度ごとに計算方法が異なり、単一金額にできない |
| 通年制度の deadline | 「随時受付」「通年」は null を維持 |
| キャリアアップ助成金の金額 | パンフレット/画像参照型で本文にテキストなし |

## 新ソース追加手順

1. `lib/core/automation/sources/hojokin-gov.js` の `HOJOKIN_SOURCES` にエントリ追加
2. パーサー関数 `parseXxxPage()` を実装
3. `parseHojokinPage()` の switch に追加
4. テスト: `node scripts/cron-sync.js --domain hojokin --dry-run`
5. 本番: `node scripts/cron-sync.js --domain hojokin`

## トラブルシューティング

- **ソース HTML 構造変更**: パーサーのみ修正。他ソースに影響なし
- **タイムアウト**: `fetchHtml()` の timeout を調整（デフォルト 25000ms）
- **レート制限**: 詳細取得間の sleep を 500ms→1000ms に変更
- **slug 重複**: ソースプレフィックス (`mirasapo-`, `jnet21-`) で回避
- **summary にJS混入**: `extractSummary()` のフィルタを強化済み
- **中小企業庁 復旧時**: `hojokin-gov.js` の HOJOKIN_SOURCES コメントアウトを解除
