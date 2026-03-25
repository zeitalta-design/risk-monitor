# Docker + VPS デプロイガイド

> 比較サイト OS を Docker コンテナとして VPS 上にデプロイするための手順。
> VPS プロバイダ・ドメイン・SSL は環境に応じて設定する。

---

## 前提

- VPS: Ubuntu 22.04+ / 1GB+ RAM / 20GB+ SSD
- Docker Engine がインストール済み
- 本番ドメインの DNS が VPS の IP を向いている
- SSL 終端は reverse proxy（Caddy / nginx / Cloudflare 等）で行う

---

## 1. 初回セットアップ

### リポジトリ取得

```bash
cd /opt
git clone https://github.com/zeitalta-design/sports-event-app.git
cd sports-event-app
```

### .env 設定

```bash
cp web/.env.example web/.env
nano web/.env
```

必須設定:
- `APP_BASE_URL=https://<YOUR_DOMAIN>`
- `SESSION_SECRET=<ランダムな長い文字列>`
- source URL（必要に応じて）

詳細は [deploy-checklist.md](./deploy-checklist.md) を参照。

### Docker ビルド

```bash
docker build -t sports-event-app .
```

初回ビルドは `better-sqlite3` のコンパイルを含むため 3〜5 分かかる。

### 起動

```bash
docker run -d \
  --name sports-event-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file web/.env \
  -v $(pwd)/web/data:/app/web/data \
  sports-event-app
```

**重要:** `-v $(pwd)/web/data:/app/web/data` で SQLite DB ファイルをホスト側に永続化する。
このマウントを忘れると、コンテナ再作成時にデータが消失する。

### 疎通確認

```bash
curl http://localhost:3000
```

---

## 2. Reverse Proxy + SSL

Docker コンテナは `:3000` で HTTP を公開する。
HTTPS 終端は外部の reverse proxy で行う。

### Caddy（推奨・最小構成）

```
# /etc/caddy/Caddyfile
<YOUR_DOMAIN> {
    reverse_proxy localhost:3000
}
```

Caddy は自動で Let's Encrypt 証明書を取得・更新する。

### nginx + Let's Encrypt

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name <YOUR_DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/<YOUR_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<YOUR_DOMAIN>/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. DB 初期化 / Seed

初回起動時に DB テーブルは自動作成される。
seed データが必要な場合:

```bash
docker exec sports-event-app node scripts/seed-yutai.js
docker exec sports-event-app node scripts/seed-hojokin.js
docker exec sports-event-app node scripts/seed-nyusatsu.js
docker exec sports-event-app node scripts/seed-minpaku.js
```

---

## 4. Importer / Cron

### 手動実行

```bash
docker exec sports-event-app npm run imports:source:dry
docker exec sports-event-app npm run imports:source
```

### cron 設定

```bash
crontab -e
```

```cron
# 毎日午前5時に全ドメイン source import
0 5 * * * docker exec sports-event-app npm run imports:source >> /var/log/sports-imports.log 2>&1
```

---

## 5. 更新（再デプロイ）

```bash
cd /opt/sports-event-app
git pull origin main
docker build -t sports-event-app .
docker stop sports-event-app
docker rm sports-event-app
docker run -d \
  --name sports-event-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file web/.env \
  -v $(pwd)/web/data:/app/web/data \
  sports-event-app
```

**注意:** `data/` ディレクトリは Volume マウントなので、コンテナ再作成でもデータは保持される。

---

## 6. ロールバック

```bash
# 前のコミットに戻す
git log --oneline -n 5
git revert HEAD

# 再ビルド・再起動
docker build -t sports-event-app .
docker stop sports-event-app && docker rm sports-event-app
docker run -d --name sports-event-app --restart unless-stopped \
  -p 3000:3000 --env-file web/.env -v $(pwd)/web/data:/app/web/data \
  sports-event-app
```

---

## 7. バックアップ

SQLite は単一ファイルなので、ファイルコピーでバックアップ可能。

```bash
# 日次バックアップ例
cp web/data/sports-event.db web/data/sports-event.db.bak-$(date +%Y%m%d)
```

cron で自動化:

```cron
# 毎日午前4時にバックアップ
0 4 * * * cp /opt/sports-event-app/web/data/sports-event.db /opt/backups/sports-event-$(date +\%Y\%m\%d).db
```

---

## 8. トラブルシューティング

### コンテナが起動しない

```bash
docker logs sports-event-app
```

よくある原因:
- `.env` 未設定 or パスが違う
- ポート 3000 が既に使われている
- `data/` ディレクトリの権限不足

### DB がロックされる

SQLite は同時書き込みに制限がある。importer と admin が同時に大量書き込みすると競合する可能性がある。
対処: importer の実行時間を admin 操作と重ならない深夜に設定する。

### better-sqlite3 のビルドが失敗する

Docker 内で `python3 make g++` が必要。Dockerfile ですでに対応済み。
ホストで直接動かす場合は `sudo apt install python3 make g++` が必要。

---

## 9. Standalone ローカル確認（Docker 不要）

Docker なしで standalone build の動作を検証する手順。
Docker コンテナ内で実行される `node server.js` と実質同じ確認ができる。

### 9.1 ビルド

```bash
cd web
npx next build
```

### 9.2 static / public のコピー

standalone 出力にはデフォルトで `public` と `.next/static` が含まれない。手動コピーが必要:

```bash
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

> **注意:** Docker 運用時はこのコピーを Dockerfile 内で行っている。

### 9.3 SQLite DB の配置

build 時に `data/` がコピーされるが、**build 時点の古い DB が入る可能性がある**。
最新データで確認するには、手動で最新 DB をコピーする:

```bash
cp data/sports-event.db .next/standalone/data/sports-event.db
```

> **本番 Docker 運用では `-v $(pwd)/web/data:/app/web/data` で volume mount するため、この問題は発生しない。**

### 9.4 起動

```bash
cd .next/standalone
PORT=3002 \
SESSION_SECRET=abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop \
APP_BASE_URL=https://test.example.com \
node server.js
```

**必須 env:**

| env | 必須 | 説明 |
|-----|------|------|
| `SESSION_SECRET` | **必須** | 32文字以上。未設定だと instrumentation hook で起動失敗 |
| `APP_BASE_URL` | **必須** | `http://localhost` は本番モードで拒否される。検証時は `https://test.example.com` 等を使う |
| `PORT` | 任意 | default: 3000。dev server と競合する場合は変更 |

### 9.5 確認 URL

```bash
# ルート
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/

# 公開ページ（6ドメイン）
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/yutai
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/hojokin
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/minpaku
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/marathon

# 公開 API
curl -s http://localhost:3002/api/yutai | head -c 100
curl -s "http://localhost:3002/api/events?sport_type=marathon&page=1" | head -c 100

# admin API 保護（401 が正常）
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/admin/yutai
```

全ページが **200**、admin API が **401** なら正常。

### 9.6 よくある失敗

| 症状 | 原因 | 対処 |
|------|------|------|
| 起動時 500 + `SESSION_SECRET` エラー | env 未設定 | `SESSION_SECRET` を 32 文字以上で設定 |
| 起動時 500 + `APP_BASE_URL localhost` | localhost URL | `https://test.example.com` 等に変更 |
| CSS / 画像が 404 | static 未コピー | `.next/static` と `public` をコピー |
| 公開 API が 0 件 | 古い DB | 最新 `sports-event.db` を `data/` にコピー |
| `EADDRINUSE` | ポート競合 | `npx kill-port 3002` で解放 |
