# スポ活 (SpoKatsu) 本番デプロイメントガイド

## ⚠️ インフラ要件（重要）

**SQLite を使用しているため、Vercel / Netlify 等のサーバーレス環境にはデプロイできません。**

サーバーレス環境ではファイルシステムが揮発性のため、SQLite データベースが永続化されません。
以下のいずれかの環境を使用してください。

| 推奨環境 | 備考 |
|---|---|
| **VPS** (ConoHa, さくらVPS, Vultr 等) | 最も安定。推奨 |
| **Railway** | SQLite 対応。簡単デプロイ |
| **Fly.io** | Volume mount で SQLite 永続化可能 |
| **自前サーバー** | オンプレミスも可 |

将来的に PostgreSQL へ移行すれば Vercel 等も選択可能です。

---

## 必須環境変数

`.env.example` をコピーして `.env.local`（または `.env.production`）を作成してください。

```env
# ─── 必須 ───
APP_BASE_URL=https://your-domain.com      # 本番ドメイン（末尾スラッシュなし）
NODE_ENV=production

# ─── 認証 ───
SESSION_SECRET=<32文字以上のランダム文字列>
# 生成: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ─── メール送信（SMTP） ───
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM=スポ活 <noreply@your-domain.com>

# ─── 任意 ───
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX            # Google Analytics 4

# ─── 運営通知（任意） ───
OPS_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
OPS_NOTIFY_CHANNELS=slack
OPS_CRON_SECRET=<ランダム文字列>
```

### 環境変数の役割

`deploy-vps.sh` は環境変数を **必須 / 推奨 / 任意** の3段階で扱います。
必須が未設定ならデプロイ中止、推奨は warning 表示で続行、任意はサイレント続行です。

| 変数名 | 区分 | 用途 | 未設定時の挙動 |
|---|---|---|---|
| `SESSION_SECRET` | **必須** | セッション HMAC 署名（32文字以上） | デプロイ中止 |
| `APP_BASE_URL` | 推奨 | パスワードリセットURL、OGP、サイトマップ | warning + デフォルト `https://taikainavi.jp` |
| `NODE_ENV` | 自動 | セキュリティヘッダー・Secure Cookie | スクリプトが `production` を固定設定 |
| `SMTP_HOST` | 推奨 | メール送信サーバー | warning + Ethereal フォールバック（テスト用） |
| `SMTP_PORT` | 任意 | SMTP ポート番号 | デフォルト `587` |
| `SMTP_USER` | 任意 | SMTP 認証ユーザー | SMTP_HOST 設定時のみ必要 |
| `SMTP_PASS` | 任意 | SMTP 認証パスワード | SMTP_HOST 設定時のみ必要 |
| `MAIL_FROM` | 任意 | 送信元アドレス | デフォルト `大会ナビ <noreply@taikainavi.jp>` |
| `ALLOW_SIGNUP` | 任意 | 新規登録の許可/禁止 | デフォルト `false` |
| `OPS_ADMIN_EMAIL` | 任意 | 運営通知先メール | 未設定時は通知なし |
| `NEXT_PUBLIC_GA_ID` | 任意 | GA4 トラッキング | 未設定時は GA 無効 |
| `OPS_SLACK_WEBHOOK_URL` | 任意 | 運営 Slack 通知 | 未設定時は Slack 通知無効 |
| `OPS_CRON_SECRET` | 任意 | cron API の認証キー | 未設定時は cron API 無認証 |

---

## デプロイ手順

### 1. サーバー準備

```bash
# Node.js 20+ をインストール
# Git でリポジトリを clone
git clone <repo-url>
cd sports-event-app/web
```

### 2. 環境変数を設定

```bash
cp .env.example .env.local
# エディタで .env.local を編集して値を入力
```

### 3. ビルド

```bash
npm install
npm run build
```

### 4. 管理者アカウント作成

初回デプロイ時に管理者アカウントの作成が必要です。

```bash
npm run admin:create -- \
  --email admin@your-domain.com \
  --name "管理者" \
  --password "YourSecurePassword123"
```

- パスワード要件: 8文字以上（bcrypt ハッシュ化保存）
- 既存の管理者がいる場合は `--force` フラグを追加
- 作成後、速やかにログインしてパスワードを変更してください

### 5. リバースプロキシ & SSL

Nginx 設定例:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

SSL 証明書は Let's Encrypt (certbot) を推奨。

### 6. 起動

```bash
# 直接起動
npm start

# PM2 でデーモン化（推奨）
npx pm2 start npm --name "spokatsu" -- start
npx pm2 save
npx pm2 startup
```

### 7. DNS 設定

ドメインの A レコードをサーバー IP に向ける。

### 8. 動作確認

```bash
curl https://your-domain.com/api/health
```

---

## セキュリティ設定（自動適用）

`NODE_ENV=production` 時に以下が自動で有効化されます:

| 機能 | 設定内容 |
|---|---|
| **HSTS** | `max-age=63072000; includeSubDomains; preload` |
| **CSP** | `default-src 'self'`, script/style/img/connect/font 制限 |
| **X-Frame-Options** | `DENY` |
| **X-Content-Type-Options** | `nosniff` |
| **Permissions-Policy** | カメラ・マイク無効、位置情報は self のみ |
| **Secure Cookie** | セッション Cookie に `Secure` フラグ |
| **セッション署名** | SESSION_SECRET による HMAC-SHA256 署名（改ざん防止） |
| **起動時検証** | SESSION_SECRET / APP_BASE_URL 未設定で起動拒否 |
| **ログイン試行制限** | 5回失敗で15分ロックアウト |
| **監査ログ** | ログイン・パスワード変更等を `admin_audit_logs` に記録 |

---

## 公開前チェックリスト

### インフラ
- [ ] VPS / Railway / Fly.io 等のサーバーが稼働中
- [ ] Node.js 20+ がインストール済み
- [ ] SSL 証明書が有効（Let's Encrypt 等）
- [ ] DNS A レコードがサーバー IP を指している

### 環境変数
- [ ] `APP_BASE_URL` が `https://your-domain.com` に設定済み
- [ ] `NODE_ENV=production` が設定済み
- [ ] `SESSION_SECRET` にランダム文字列を設定済み
- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` を設定済み
- [ ] `MAIL_FROM` を設定済み
- [ ] `NEXT_PUBLIC_GA_ID` を設定済み（GA4 使用時）

### 管理者
- [ ] 管理者アカウントを `npm run admin:create` で作成済み
- [ ] 初期パスワードを `/admin/ops/account` で変更済み

### 動作確認
- [ ] `GET /api/health` が `{"status":"ok"}` を返す
- [ ] トップページが正常表示される
- [ ] 大会一覧・詳細ページが表示される
- [ ] 検索機能が動作する
- [ ] ログイン → 管理画面 (`/admin/ops`) にアクセスできる
- [ ] パスワードリセットメールが届く（`/forgot-password` から確認）
- [ ] お気に入り・通知登録が動作する
- [ ] OGP 画像が正常表示（SNS デバッガーで確認）

### SEO / 外部
- [ ] `robots.txt` が `/robots.txt` で正常表示
- [ ] `sitemap.xml` が `/sitemap.xml` で正常表示
- [ ] Google Search Console にサイトマップ送信

---

## 定期メンテナンス

| タスク | 頻度 | 方法 |
|---|---|---|
| SSL 証明書更新 | 90日ごと | certbot renew (cron) |
| DB バックアップ | 毎日 | `cp data/sports-event.db backups/` |
| 期限切れセッション削除 | 自動 | アプリ内で自動クリーンアップ |
| スクレイピング実行 | 毎日 | cron で `node scripts/scrape-*.js` |
| Node.js / npm 更新 | 月次 | セキュリティパッチ適用 |

### DB バックアップ例 (cron)

```bash
# 毎日AM3時にバックアップ
0 3 * * * cp /path/to/web/data/sports-event.db /path/to/backups/sports-event-$(date +\%Y\%m\%d).db
```

---

## スクレイピング巡回設定

### 巡回頻度

| ソース | 頻度 | 時刻 | 備考 |
|---|---|---|---|
| RUNNET | 3日に1回 | 午前5時 | 一覧巡回（終端まで） |
| SPORTS ENTRY | 3日に1回 | 午前6時 | 一覧巡回（終端まで） |
| MOSHICOM | 週1回（日曜） | 午前7時 | 一覧巡回（終端まで） |
| popularity再計算 | 毎日 | 午前8時 | 全イベント対象 |

### cron 設定方法

```bash
ssh ubuntu@<VPS_HOST>
cd /opt/app && bash scripts/setup-cron.sh
```

### 手動再実行

管理画面 → スクレイピング監視 → 各ソースの「手動再実行」ボタンから随時実行可能。
cron 設定とは独立して動作します。

---

## トラブルシューティング

### ビルド時に sitemap.xml でエラー
`sitemap.js` がビルド時に DB アクセスする場合、ビルド環境にも `data/sports-event.db` が必要です。

### メールが届かない
1. `SMTP_*` 環境変数を確認
2. Gmail の場合はアプリパスワードを使用（2段階認証必須）
3. SPF / DKIM / DMARC を DNS に設定

### セッションが維持されない
- `APP_BASE_URL` のプロトコル (`https://`) が正しいか確認
- Nginx で `X-Forwarded-Proto` ヘッダーを付けているか確認
- `NODE_ENV=production` で Secure Cookie が有効 → HTTPS 必須

---

## CI/CD: 自動デプロイ（Docker + GitHub Actions + VPS）

現在の本番環境は Docker + Caddy + VPS 構成です。

### デプロイフロー

```
main に push
  → GitHub Actions: Docker イメージビルド → GHCR push
  → GitHub Actions: SSH で VPS に接続 → deploy-vps.sh 実行
  → VPS: docker pull → コンテナ再起動 → ヘルスチェック
```

### 必要な GitHub Secrets

| Secret 名 | 値 | 設定場所 |
|---|---|---|
| `VPS_HOST` | VPS の IP アドレス | GitHub repo → Settings → Secrets |
| `VPS_USER` | SSH ユーザー名（例: `ubuntu`） | 同上 |
| `VPS_SSH_KEY` | VPS への SSH 秘密鍵（PEM 形式） | 同上 |

`GITHUB_TOKEN` は自動で利用可能（GHCR push 用）。

### VPS 側の環境変数

`/opt/app/.env.production` に配置します（`deploy-vps.sh` が自動で読み込み）。

```env
SESSION_SECRET=<64文字のランダム文字列>

# SMTP（任意: 未設定時は Ethereal フォールバック）
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM=大会ナビ <your-email@example.com>

# 運営通知（任意）
OPS_ADMIN_EMAIL=admin@example.com
```

### 手動デプロイ（緊急時）

```bash
ssh ubuntu@<VPS_HOST>
cd /opt/app && bash scripts/deploy-vps.sh
```

### ロールバック

```bash
ssh ubuntu@<VPS_HOST>
# 1. 直前のイメージ SHA を確認
docker images ghcr.io/zeitalta-design/sports-event-app --format "{{.Tag}} {{.CreatedAt}}" | head -5

# 2. 特定の SHA にロールバック
docker stop navi-app && docker rm navi-app
docker run -d --name navi-app \
  -p 127.0.0.1:3000:3000 \
  --env-file /opt/app/.env.production \
  -e NODE_ENV=production \
  -v /opt/app/web/data:/app/web/data \
  --restart unless-stopped \
  ghcr.io/zeitalta-design/sports-event-app:<SHA>
```

---

## 残課題・将来対応

| 項目 | 優先度 | 備考 |
|---|---|---|
| PostgreSQL 移行 | 中 | Vercel 等のサーバーレスに対応したい場合 |
| MFA（多要素認証） | 低 | 管理画面のセキュリティ強化（構造は準備済み） |
| CDN 導入 | 低 | 静的アセットの配信高速化 |
| ログ集約 | 低 | 監査ログの外部サービス連携 |
