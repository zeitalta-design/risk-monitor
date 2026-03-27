# 共通基盤スコープ定義

## 1. 共通基盤の責務一覧

| 責務 | 説明 | 既存実装 | 対応方針 |
|---|---|---|---|
| ドメインレジストリ | 全ドメインの設定・メタデータ管理 | `lib/core/domain-registry.js` | そのまま利用 |
| 事業者/法人管理 | 法人番号・名寄せ・組織情報 | ドメイン別テーブルに分散 | 共通 organizations テーブル新設 |
| ソース管理 | データ取得元の登録・状態管理 | `data_sources` テーブル | そのまま利用、新ドメイン登録 |
| クロール/取込 | ソースからのデータ取得・正規化 | `sync-runner.js` + adapters | そのまま利用 |
| 差分検知 | フィールド単位の変更追跡 | `change-detector.js` + `change_logs` | そのまま利用 |
| 公開判定 | 自動公開 vs レビュー必要の判定 | `publish-decision.js` | そのまま利用 |
| AI構造化抽出 | LLMによるデータ補完 | `ai-drafter.js` + `ai_extractions` | そのまま利用 |
| 通知 | 管理者通知・変更アラート | `notifier.js` + `admin_notifications` | 拡張（ユーザー通知追加） |
| 検索 | キーワード横断検索 | `/api/platform/search` | 拡充（新ドメイン対応） |
| お気に入り | ドメイン横断のお気に入り | `item-favorites` API パターン | そのまま利用 |
| 保存検索 | 検索条件の保存・通知 | `saved-searches` パターン | そのまま利用 |
| 比較 | 同ドメイン内のアイテム比較 | `DomainCompareBar` + compare API | 必要なドメインのみ利用 |
| 管理画面 | CRUD・レビュー・監視 | AdminNav + admin pages | そのまま利用 |
| 監査ログ | 管理操作の記録 | `audit-log.js` + `admin_audit_logs` | そのまま利用 |
| 重複判定 | 同一エンティティの検出・マージ | なし | **新規実装** |
| タグ | ドメイン横断タグ付け | `item_tags`（SaaS用） | 汎用化検討 |

## 2. 共通化対象 / 非共通化対象

### 共通化する（全ドメインで共有）

```
lib/core/
  domain-registry.js     — ドメイン登録・参照
  automation/
    sync-runner.js        — 同期実行の統一フロー
    change-detector.js    — 差分検知
    publish-decision.js   — 公開判定
    ai-drafter.js         — AI構造化抽出
    fetch-helper.js       — HTTP取得・HTML前処理
    db-accessor.js        — DB操作ラッパー
    notifier.js           — 通知
    sync-logger.js        — 同期ログ

lib/auth.js              — 認証
lib/admin-api-guard.js   — 管理API認可
lib/audit-log.js         — 監査ログ

components/core/
  DomainListPage.js      — 汎用一覧ページ
  DomainDetailPage.js    — 汎用詳細ページ
  DomainCompareBar.js    — 比較UI
  DomainFavoriteButton.js — お気に入りボタン
```

### 共通化しない（ドメイン固有）

```
lib/{domain}-config.js          — カテゴリ・ステータス・フィルタ定義
lib/domains/{domain}.js         — ドメイン登録（registerDomain呼び出し）
lib/repositories/{domain}.js    — CRUD（テーブル構造に依存）
lib/importers/{domain}.js       — データ正規化（ソース形式に依存）
lib/core/automation/adapters/{domain}-adapter.js  — 同期アダプタ
lib/core/automation/sources/{domain}-*.js         — ソース固有の取得ロジック

app/{domain}/                   — フロントエンドページ（レイアウト・SEO含む）
app/api/{domain}/               — ドメイン固有API
app/admin/{domain}/             — 管理画面
```

## 3. ディレクトリ構成案

現状の構成を維持しつつ、新ドメイン追加時のパターンを統一する。

```
web/
├── app/
│   ├── platform/                  # プラットフォーム共通ページ
│   │   ├── dashboard/
│   │   └── search/
│   ├── hojokin/                   # 補助金ナビ
│   ├── kyoninka/                  # 許認可検索
│   ├── gyosei-shobun/            # 行政処分DB（新規）
│   ├── shimei-teishi/            # 指名停止・談合ウォッチ（新規）
│   ├── butsuryu-shobun/          # 物流・運送行政処分（新規）
│   ├── sanpai/                   # 産廃処分ウォッチ（既存）
│   ├── shitei/                   # 指定管理公募まとめ（既存）
│   ├── haken-shobun/             # 派遣・人材業 処分（新規）
│   ├── api/
│   │   ├── platform/             # プラットフォーム横断API
│   │   ├── admin/
│   │   │   ├── automation/       # 自動化管理API（共通）
│   │   │   ├── {domain}/         # ドメイン別管理API
│   │   └── {domain}/             # ドメイン別公開API
│   └── admin/
│       ├── automation/           # 自動化管理画面（共通）
│       └── {domain}/             # ドメイン別管理画面
├── components/
│   ├── core/                     # 共通UIコンポーネント
│   ├── platform/                 # プラットフォームナビ等
│   └── admin/                    # 管理画面コンポーネント
├── lib/
│   ├── core/
│   │   ├── domain-registry.js    # ドメイン登録
│   │   └── automation/           # 自動化共通基盤
│   │       ├── adapters/         # ドメイン別アダプタ
│   │       └── sources/          # ドメイン別ソース
│   ├── domains/                  # ドメイン登録ファイル
│   ├── repositories/             # ドメイン別データアクセス
│   ├── importers/                # ドメイン別インポーター
│   ├── {domain}-config.js        # ドメイン別設定
│   ├── db.js                     # DB初期化・スキーマ
│   └── platform-og.js            # OGP画像生成
└── docs/                         # 運用ドキュメント
```

## 4. モジュール分割案

### 新ドメイン追加時の最小セット

| ファイル | 役割 | テンプレート |
|---|---|---|
| `lib/domains/{domain}.js` | ドメイン登録 | `lib/domains/_template.js` |
| `lib/{domain}-config.js` | カテゴリ・フィルタ定義 | 既存 config を参考 |
| `lib/repositories/{domain}.js` | CRUD | 既存 repository を参考 |
| `lib/importers/{domain}.js` | 正規化・インポート | 既存 importer を参考 |
| `lib/core/automation/adapters/{domain}-adapter.js` | 同期アダプタ | 既存 adapter を参考 |
| `lib/core/automation/sources/{domain}-*.js` | ソース取得 | 既存 source を参考 |
| `app/{domain}/page.js` | 一覧ページ | DomainListPage 利用 |
| `app/{domain}/[slug]/page.js` | 詳細ページ | DomainDetailPage 利用 |
| `app/api/{domain}/route.js` | 公開API | 既存パターン |
| `app/admin/{domain}/page.js` | 管理画面 | 既存パターン |
| `lib/db.js` に追記 | テーブル定義 | CREATE TABLE IF NOT EXISTS |

### 共通基盤で新規実装が必要なもの

| モジュール | 責務 | 優先度 |
|---|---|---|
| 重複判定 | 法人番号・名称による重複検出 | 高 |
| 共通 organizations テーブル | ドメイン横断の法人/事業者管理 | 中 |
| ユーザー通知拡張 | 変更通知のユーザー向け配信 | 低（Phase 2以降） |

## 5. DB責務分離案

### 共通テーブル（全ドメイン共有）

```sql
-- 既存（そのまま利用）
data_sources          -- ソース管理
sync_runs             -- 同期実行ログ
change_logs           -- 差分記録
admin_notifications   -- 管理者通知
ai_extractions        -- AI抽出結果
admin_audit_logs      -- 監査ログ

-- 新規（検討）
organizations         -- 法人/事業者の名寄せマスタ
  id, corporate_number, name, normalized_name,
  prefecture, address, website, created_at, updated_at
```

### ドメイン別テーブル（ドメイン固有）

各ドメインは以下のパターンでテーブルを持つ:

```
{domain}_items        -- 本体データ（必須）
{domain}_details      -- 付随詳細（任意）
{domain}_favorites    -- お気に入り（任意）
{domain}_saved_searches -- 保存検索（任意）
```

行政処分系の場合:

```
{domain}_items             -- 処分案件本体
{domain}_penalties         -- 処分履歴（1:N）
{domain}_related_entities  -- 関連事業者（N:M）
```

### テーブル間の関係

```
organizations (共通)
  ↑ organization_id
{domain}_items (ドメイン固有)
  ↑ entity_id
change_logs (共通)
  ↑ source_id
data_sources (共通)
```

organizations テーブルは任意参照（nullable FK）とし、
既存ドメインが organizations なしでも動くようにする。
