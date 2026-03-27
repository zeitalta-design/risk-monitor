# Caddy HTTPS 設定手順（DNS 反映後に実行）

## 前提
- VPS: 133.125.38.92（さくらVPS）
- ドメイン: sportlog.jp
- Caddy v2.11.2 がインストール済み（systemd で稼働中）
- アプリは Docker コンテナ `navi-app` で localhost:3000 に応答

## 手順

### 1. DNS 反映確認
```bash
dig sportlog.jp A +short
# → 133.125.38.92 が返ること
```

### 2. Caddyfile 更新
```bash
ssh ubuntu@133.125.38.92
sudo tee /etc/caddy/Caddyfile << 'EOF'
sportlog.jp {
    reverse_proxy 127.0.0.1:3000

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

www.sportlog.jp {
    redir https://sportlog.jp{uri} permanent
}
EOF

sudo systemctl reload caddy
```

Caddy はドメイン名を書くだけで Let's Encrypt 証明書を自動取得・更新する。

### 3. HTTPS 確認
```bash
curl -s -o /dev/null -w "%{http_code}" https://sportlog.jp/
# → 200
```

### 4. APP_BASE_URL 更新
```bash
docker stop navi-app && docker rm navi-app
docker run -d --name navi-app -p 3000:3000 \
  -e APP_BASE_URL=https://sportlog.jp \
  -e SESSION_SECRET=<既存値> \
  -e NODE_ENV=production \
  -v /opt/app/web/data:/app/web/data \
  --restart unless-stopped \
  ghcr.io/zeitalta-design/sports-event-app:latest
```

### 5. deploy-vps.sh の APP_BASE_URL デフォルト更新
```bash
# scripts/deploy-vps.sh の APP_BASE_URL デフォルトを更新
-e APP_BASE_URL="${APP_BASE_URL:-https://sportlog.jp}"
```

### 6. 証明書更新
Caddy は自動更新。手動確認：
```bash
sudo caddy version
sudo systemctl status caddy
```
