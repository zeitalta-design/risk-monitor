# ドメイン別ロールアウト計画

## Phase 1: 先行立ち上げ（Day 16-35）

---

### 1. 補助金ナビ（hojokin）

**既存状況**: 実装済み。テーブル・API・UI・管理画面・ソース（hojokin-gov.js）あり。

#### MVP範囲
- 既存UIの改善（検索精度・フィルタ追加）
- ソース追加（経産省、厚労省等の補助金情報）
- データ品質向上（AI抽出で不足フィールド補完）
- 締切通知の強化

#### データ項目
| 項目 | 既存 | 追加 |
|---|---|---|
| title, summary, category | あり | — |
| max_amount, deadline | あり | — |
| provider_name, provider_url | あり | — |
| target（対象者種別） | あり | — |
| application_url | — | 追加 |
| required_documents | — | 追加 |
| selection_criteria | — | 追加 |

#### 流用できる既存要素
- `lib/repositories/hojokin.js` — CRUD全て
- `lib/importers/hojokin.js` — 正規化ロジック
- `lib/hojokin-config.js` — カテゴリ・フィルタ定義
- `app/hojokin/` — 一覧・詳細・比較ページ
- `lib/core/automation/sources/hojokin-gov.js` — ソース取得

#### 新規実装が必要な要素
- ソース追加（経産省、地方自治体等）
- 締切通知のユーザー配信
- 申請方法・必要書類の構造化

#### 着手条件
即時着手可。既存実装の拡充のみ。

---

### 2. 許認可検索（kyoninka）

**既存状況**: 実装済み。テーブル・API・UI・管理画面・ソース（kyoninka-mlit.js）あり。

#### MVP範囲
- 対象県の拡大（現在10県 → 全国）
- 許認可種別の追加（建設業以外も）
- 検索UXの改善（法人名・番号検索）
- 事業者詳細ページの充実

#### データ項目
| 項目 | 既存 | 追加 |
|---|---|---|
| entity_name, slug | あり | — |
| corporate_number | あり | — |
| prefecture, city, address | あり | — |
| primary_license_family | あり | — |
| registration_count | あり | — |
| registrations (1:N) | あり | — |
| penalty_history | — | 追加（行政処分DBと連携） |
| financial_grade | — | 追加（経審情報） |

#### 流用できる既存要素
- `lib/repositories/kyoninka.js` — CRUD
- `lib/importers/kyoninka.js` — 正規化
- `lib/kyoninka-config.js` — 許認可種別定義
- `lib/core/automation/sources/kyoninka-mlit.js` — 国交省スクレイパー
- `app/kyoninka/` — ページ全て

#### 新規実装が必要な要素
- 追加県のソース（各都道府県庁サイト）
- 行政処分DBとの連携（FK or 名寄せ）
- 経審（経営事項審査）情報の取込

#### 着手条件
即時着手可。既存実装の拡充のみ。

---

### 3. 行政処分DB（gyosei-shobun）— 新規

**既存状況**: なし。新規ドメイン。ただし sanpai の penalties パターンを流用可能。

#### MVP範囲
- 国交省の建設業行政処分情報をスクレイピング
- 処分種別（営業停止、指示、勧告等）で分類
- 事業者名・処分日・処分内容で検索
- 許認可検索との連携（同一事業者の許認可状況を参照）

#### データ項目
| 項目 | 新規 |
|---|---|
| slug | 必須 |
| entity_name（被処分事業者名） | 必須 |
| corporate_number | 任意 |
| prefecture | 必須 |
| penalty_type（営業停止/指示/勧告/許可取消） | 必須 |
| penalty_date | 必須 |
| penalty_period（停止期間） | 任意 |
| authority_name（処分庁） | 必須 |
| reason（処分理由） | 必須 |
| related_law（根拠法令） | 任意 |
| source_url | 必須 |
| summary | 任意 |
| is_published | 必須 |

#### 流用できる既存要素
- `lib/domains/_template.js` — ドメイン登録テンプレート
- `lib/core/automation/sync-runner.js` — 同期フロー
- `lib/core/automation/adapters/sanpai-adapter.js` — 処分系アダプタの参考
- `components/core/DomainListPage.js` — 一覧UI
- `components/core/DomainDetailPage.js` — 詳細UI
- admin CRUD パターン

#### 新規実装が必要な要素
- `lib/gyosei-shobun-config.js` — 処分種別・フィルタ定義
- `lib/domains/gyosei-shobun.js` — ドメイン登録
- `lib/repositories/gyosei-shobun.js` — CRUD
- `lib/importers/gyosei-shobun.js` — 正規化
- `lib/core/automation/sources/gyosei-shobun-mlit.js` — 国交省ソース
- `lib/core/automation/adapters/gyosei-shobun-adapter.js`
- `app/gyosei-shobun/` — ページ群
- DB テーブル定義
- 許認可検索との名寄せロジック

#### 着手条件
共通基盤の organizations テーブル設計完了後。

---

## Phase 2: 横展開1（Day 36-55）

---

### 4. 指名停止・談合ウォッチ（shimei-teishi）— 新規

#### MVP範囲
- 国・地方公共団体の指名停止情報を収集
- 談合事案を含む入札関連処分を追跡
- 事業者名・処分期間・発注機関で検索
- 行政処分DBとの横断参照

#### データ項目
| 項目 | 新規 |
|---|---|
| slug | 必須 |
| entity_name（被処分事業者名） | 必須 |
| corporate_number | 任意 |
| prefecture | 必須 |
| suspension_type（指名停止/入札参加資格停止） | 必須 |
| suspension_start_date | 必須 |
| suspension_end_date | 任意 |
| ordering_entity（発注機関） | 必須 |
| reason（処分理由：談合/不正/施工不良等） | 必須 |
| related_case（関連事件名） | 任意 |
| source_url | 必須 |
| is_published | 必須 |

#### 流用できる既存要素
- 行政処分DB のパターン全て（config, repository, importer, adapter）
- DomainListPage / DomainDetailPage
- 名寄せロジック（行政処分DBで実装済みの場合）

#### 新規実装が必要な要素
- ソース（国交省指名停止一覧、各自治体サイト）
- 談合事案の分類ロジック
- 処分期間の計算・表示UI

#### 着手条件
行政処分DB の MVP 完了後。パターンを横展開。

---

### 5. 物流・運送行政処分ウォッチ（butsuryu-shobun）— 新規

#### MVP範囲
- 国交省の貨物自動車運送事業・旅客自動車運送事業の行政処分情報
- 処分種別（車両使用停止/事業停止/許可取消等）
- 事業者名・処分日で検索

#### データ項目
| 項目 | 新規 |
|---|---|
| slug | 必須 |
| entity_name | 必須 |
| corporate_number | 任意 |
| prefecture | 必須 |
| transport_type（貨物/旅客/倉庫） | 必須 |
| penalty_type（車両使用停止/事業停止/許可取消） | 必須 |
| penalty_date | 必須 |
| vehicle_count（対象車両数） | 任意 |
| authority_name | 必須 |
| reason | 必須 |
| source_url | 必須 |
| is_published | 必須 |

#### 流用できる既存要素
- 行政処分DB パターン全て

#### 新規実装が必要な要素
- ソース（国交省 自動車交通局の処分情報）
- transport_type の分類ロジック
- config（運送業種別の定義）

#### 着手条件
行政処分DB の MVP 完了後。

---

### 6. 産廃処分ウォッチ（sanpai）— 既存拡充

**既存状況**: テーブル・API・UI・管理画面・ソース（sanpai-env.js）・アダプタ全てあり。

#### MVP範囲
- ソース追加（対象都道府県の拡大）
- 処分履歴（sanpai_penalties）の表示強化
- 行政処分DBとの連携

#### データ項目
既存で十分。penalties テーブルも既存。

#### 流用できる既存要素
全て既存。

#### 新規実装が必要な要素
- 追加県のソース
- 行政処分DBとの名寄せ連携
- UI微改善

#### 着手条件
即時着手可。

---

## Phase 3: 横展開2（Day 56-75）

---

### 7. 指定管理公募まとめ（shitei）— 既存拡充

**既存状況**: テーブル・API・UI・管理画面・ソース（shitei-municipalities.js）全てあり。

#### MVP範囲
- ソース追加（対象自治体の拡大）
- 締切通知の強化
- 施設カテゴリの細分化

#### データ項目
既存で十分。

#### 流用できる既存要素
全て既存。

#### 新規実装が必要な要素
- 追加自治体のソース
- 締切通知のユーザー配信

#### 着手条件
即時着手可。

---

### 8. 派遣・人材業 処分ウォッチ（haken-shobun）— 新規

#### MVP範囲
- 厚生労働省の労働者派遣事業・職業紹介事業の行政処分情報
- 処分種別（事業停止/改善命令/許可取消等）
- 事業者名・処分日で検索

#### データ項目
| 項目 | 新規 |
|---|---|
| slug | 必須 |
| entity_name | 必須 |
| corporate_number | 任意 |
| prefecture | 必須 |
| business_type（一般派遣/特定派遣/職業紹介） | 必須 |
| penalty_type（事業停止/改善命令/許可取消） | 必須 |
| penalty_date | 必須 |
| authority_name | 必須 |
| reason | 必須 |
| affected_workers_count | 任意 |
| source_url | 必須 |
| is_published | 必須 |

#### 流用できる既存要素
- 行政処分DB パターン全て

#### 新規実装が必要な要素
- ソース（厚労省 労働者派遣事業関連）
- business_type の分類ロジック
- config

#### 着手条件
行政処分DB の MVP 完了後。

---

## 横断まとめ

### 実装パターンの類型

| パターン | 該当ドメイン |
|---|---|
| 行政処分系（処分案件 + 処分履歴） | 行政処分DB, 指名停止, 物流処分, 派遣処分, 産廃処分 |
| 公募/募集系（案件 + 締切管理） | 補助金ナビ, 指定管理公募 |
| 事業者検索系（事業者 + 許認可履歴） | 許認可検索 |

### 着手順序の依存関係

```
共通基盤整備
    ↓
補助金ナビ拡充 ───────── 即時
許認可検索拡充 ───────── 即時
行政処分DB MVP ────────── 共通基盤（organizations）後
    ↓
指名停止ウォッチ ──────── 行政処分DB後
物流処分ウォッチ ──────── 行政処分DB後
産廃処分ウォッチ拡充 ──── 即時（既存あり）
    ↓
指定管理公募拡充 ──────── 即時（既存あり）
派遣処分ウォッチ ──────── 行政処分DB後
```
