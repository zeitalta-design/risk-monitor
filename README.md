# Risk Monitor

**企業リスク監視プラットフォーム**

行政処分・入札情報・補助金・許認可など、官公庁が公開するビジネスデータを横断検索し、企業単位で監視・アラートできるツールです。

> 公開URL: https://taikainavi.jp/gyosei-shobun

<!-- スクリーンショット: サービスのメイン画面を入れる場合はここに -->
<!-- ![Risk Monitor](./docs/screenshot-main.png) -->

---

## 主な機能

### 行政処分DB

| 機能 | 説明 |
|------|------|
| **横断検索** | 建設業・不動産業・廃棄物処理業・運送業など、業種横断で行政処分情報を検索 |
| **統計ダッシュボード** | 年別推移・業種別・都道府県別の集計を視覚的に表示 |
| **詳細ページ** | 処分内容・法的根拠・処分期間・関連事案を一画面で確認 |
| **リスクスコア** | 処分種別・新しさ・業種を考慮したスコア（0〜100）を自動算出 |
| **お気に入り** | 気になる処分案件をブックマーク保存。ログイン時にアカウントに自動移行 |
| **比較機能** | 最大6件の処分案件を横並びで比較（デスクトップ: テーブル / モバイル: カードスクロール） |
| **ウォッチリスト** | 特定企業を監視登録。新着処分があればメール通知 |
| **審査ワークフロー** | 管理者向け。一括承認・却下・ステータスフィルタ |
| **自動データ更新** | 国交省（MLIT）+ 対応都道府県から定期的にデータを自動取得 |

### 対応データソース

| ソース | 方式 | 頻度 |
|--------|------|------|
| 国土交通省ネガティブ情報検索 | 自動スクレイピング | 毎週月曜 |
| 都道府県（6県対応済み） | 自動スクレイピング | 毎週水曜 |
| 手動キュレーション | 管理画面 | 随時 |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | JavaScript (JSX) |
| データベース | SQLite (better-sqlite3) |
| CSS | Tailwind CSS 4 |
| 認証 | Cookie/Session ベース（bcryptjs + HMAC-SHA256） |
| メール送信 | nodemailer (SMTP) |
| ホスティング | Vercel |
| 定期実行 | Vercel Cron |

---

## セットアップ

### 前提条件

- Node.js 20 以上
- npm

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd risk-monitor

# 依存パッケージのインストール
cd web
npm install

# 開発サーバーの起動
npm run dev
# → http://localhost:3001
```

### 環境変数

`web/.env.local` を作成し、以下を設定します。

```bash
# 必須
SESSION_SECRET=ランダムな32文字以上の文字列
APP_BASE_URL=http://localhost:3001

# メール送信（任意 — 未設定時はEtherealテストモード）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
MAIL_FROM=Risk Monitor <noreply@taikainavi.jp>

# Cron認証（本番用）
CRON_SECRET=ランダムな文字列

# ユーザー登録の許可（デフォルトは停止中）
ALLOW_SIGNUP=true
```

### データベース初期化

```bash
# スキーマ自動作成（dev起動時に自動実行）
npm run dev

# サンプルデータ投入
node scripts/seed-gyosei-shobun.js

# 管理者アカウント作成
node ../scripts/create-admin.js
```

### データ取得

```bash
# 国交省MLITからデータ取得
node scripts/fetch-gyosei-shobun-mlit.js --dry-run        # テスト実行
node scripts/fetch-gyosei-shobun-mlit.js --max-pages=3     # 3ページ分取得

# 詳細情報のエンリッチ
node scripts/enrich-gyosei-shobun-details.js --limit=10
```

### Cron設定（Vercel）

`web/vercel.json` に定義済み:

| ジョブ | スケジュール | JST |
|--------|------------|-----|
| MLIT取得 | `0 18 * * 1` | 月曜 3:00 |
| 都道府県取得 | `0 19 * * 3` | 木曜 4:00 |
| ウォッチリスト通知 | `0 19 * * 1` | 月曜 4:00 |

---

## ディレクトリ構成

```
risk-monitor/
├── web/                              ← Next.js アプリケーション
│   ├── app/
│   │   ├── gyosei-shobun/            ← 行政処分DB（一覧・詳細・比較・お気に入り）
│   │   ├── admin/gyosei-shobun/      ← 管理画面（審査・CRUD）
│   │   ├── api/
│   │   │   ├── gyosei-shobun/        ← 公開API（検索・統計・お気に入り）
│   │   │   ├── cron/                 ← Cronジョブ（自動取得・通知）
│   │   │   └── watchlist/            ← ウォッチリストAPI
│   │   └── login/                    ← 認証
│   ├── components/
│   │   └── gyosei-shobun/            ← 専用コンポーネント
│   │       ├── FavoriteButton.js
│   │       ├── WatchButton.js
│   │       ├── AddToCompareButton.js
│   │       └── RiskScoreBadge.js
│   ├── lib/
│   │   ├── db.js                     ← DB接続・スキーマ管理
│   │   ├── auth.js                   ← 認証基盤
│   │   ├── risk-score.js             ← リスクスコア計算
│   │   ├── gyosei-shobun-fetcher.js  ← MLIT自動取得
│   │   ├── prefecture-scraper.js     ← 都道府県スクレイパー
│   │   ├── watchlist-notification-service.js
│   │   └── repositories/
│   │       ├── gyosei-shobun.js      ← DBアクセス層
│   │       ├── gyosei-shobun-review.js
│   │       └── watched-organizations.js
│   └── scripts/                      ← データ取込・管理スクリプト
├── scripts/                          ← 共有スクリプト
├── sql/                              ← スキーマ定義
└── data/                             ← 共有データ
```

---

## リスクスコア

各行政処分に自動算出されるリスクスコア（0〜100点）。

| 要素 | 最大配点 | 例 |
|------|---------|-----|
| 処分種別 | 70点 | 許可取消=70, 営業停止=55, 改善命令=30 |
| 新しさ | 20点 | 1年以内=+20, 2年以内=+12 |
| 業種 | 8点 | 産廃=+8, 建設=+5 |
| 処分期間 | 10点 | 長期ほど加点 |

| レベル | スコア | 表示 |
|--------|--------|------|
| 高リスク | 70〜100 | 🔴 赤バッジ |
| 中リスク | 40〜69 | 🟡 黄バッジ |
| 低リスク | 0〜39 | 🟢 緑バッジ |

---

## セキュリティ

- **認証**: Cookie/Session ベース（HMAC-SHA256 署名、bcrypt パスワードハッシュ）
- **管理画面保護**: middleware（セッション検証）+ AdminGuard（role=admin チェック）+ API ガード
- **レート制限**: ログイン試行回数を制限
- **Cron認証**: `CRON_SECRET` ヘッダーで保護

---

## 法的配慮・注意事項

- 本サービスで提供するデータは、**官公庁が公開している情報**（国土交通省、各都道府県の公式ウェブサイト）を基に構築しています。
- データの**正確性・完全性を保証するものではありません**。最新かつ正確な情報は各官公庁の公式サイトでご確認ください。
- 本サービスの利用により生じた損害について、運営者は一切の責任を負いません。**利用は自己責任**でお願いいたします。
- データの転載・二次利用については、**各情報源の利用規約**に従ってください。
- 掲載情報は事実の記載であり、特定の企業や個人を誹謗中傷する意図はありません。

---

## 今後の予定

- [ ] 企業単位ダッシュボード（同一企業の処分履歴を一画面で表示）
- [ ] LINE通知対応
- [ ] ブラウザプッシュ通知
- [ ] CSV/PDFエクスポート
- [ ] 入札情報・補助金DBの本格実装
- [ ] 企業名寄せの自動化（organization_id統合）
- [ ] REST APIの外部公開（有料プラン）

---

## ライセンス

Private — 無断複製・転載を禁じます。

---

## 開発者向け情報

### ビルド

```bash
cd web
npm run build
```

### 管理者アカウント作成

```bash
node ../scripts/create-admin.js
# → メールアドレスとパスワードを入力
```

### 手動データ更新

```bash
# 管理画面の「🔄 MLIT更新」ボタンからも実行可能
curl -X POST http://localhost:3001/api/cron/fetch-gyosei-shobun
curl -X POST http://localhost:3001/api/cron/fetch-prefecture-shobun
curl -X POST http://localhost:3001/api/cron/watchlist-notify
```
