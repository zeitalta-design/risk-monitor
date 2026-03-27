#!/bin/bash
# ============================================
# VPS デプロイスクリプト
# GHCR からイメージを pull → コンテナ再起動
# ============================================
#
# 使い方:
#   ssh ubuntu@<VPS_HOST>
#   cd /opt/app && bash scripts/deploy-vps.sh
#
# GitHub Actions からの自動実行にも対応。
#
# 前提:
#   - Docker がインストール済み
#   - GHCR package は Public のため認証不要
#   - /opt/app/web/data にDBファイルがマウントされる
#   - swap 2GB 設定済み (/swapfile)
#
# 環境変数:
#   必須: なし（全てデフォルト値あり）
#   推奨: SESSION_SECRET（未設定時は起動ごとにランダム生成）
#   任意: SMTP_HOST, SMTP_USER, SMTP_PASS（未設定時はメール送信が Ethereal フォールバック）

set -eo pipefail

# --- .env ファイルがあれば読み込む ---
ENV_FILE="/opt/app/.env.production"
if [ -f "${ENV_FILE}" ]; then
  echo "[env] Loading ${ENV_FILE}"
  set -a
  source "${ENV_FILE}"
  set +a
fi

CONTAINER_NAME="navi-app"
IMAGE="ghcr.io/zeitalta-design/sports-event-app:latest"
DATA_VOLUME="/opt/app/web/data:/app/web/data"

echo "=== VPS Deploy: pull → stop → start ==="

# 1. Pull latest image
echo "[1/4] Pulling image: ${IMAGE}"
docker pull "${IMAGE}"

# 2. Stop existing container (if running)
echo "[2/4] Stopping existing container..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# 3. Build env args — SMTP 系は設定されている場合のみ渡す
ENV_ARGS=(
  -e APP_BASE_URL="${APP_BASE_URL:-https://taikainavi.jp}"
  -e SESSION_SECRET="${SESSION_SECRET:-$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)}"
  -e ALLOW_SIGNUP="${ALLOW_SIGNUP:-false}"
  -e OPS_ADMIN_EMAIL="${OPS_ADMIN_EMAIL:-}"
  -e NODE_ENV=production
)

# SMTP 関連: 設定されている場合のみコンテナに渡す
if [ -n "${SMTP_HOST:-}" ]; then
  ENV_ARGS+=(-e SMTP_HOST="${SMTP_HOST}")
  ENV_ARGS+=(-e SMTP_PORT="${SMTP_PORT:-587}")
  [ -n "${SMTP_USER:-}" ]  && ENV_ARGS+=(-e SMTP_USER="${SMTP_USER}")
  [ -n "${SMTP_PASS:-}" ]  && ENV_ARGS+=(-e SMTP_PASS="${SMTP_PASS}")
  [ -n "${SMTP_SECURE:-}" ] && ENV_ARGS+=(-e SMTP_SECURE="${SMTP_SECURE}")
  ENV_ARGS+=(-e MAIL_FROM="${MAIL_FROM:-大会ナビ <noreply@taikainavi.jp>}")
  echo "[smtp] SMTP configured: ${SMTP_HOST}"
else
  echo "[smtp] SMTP not configured — email will use Ethereal fallback"
fi

# 3. Start new container
echo "[3/4] Starting new container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 127.0.0.1:3000:3000 \
  "${ENV_ARGS[@]}" \
  -v "${DATA_VOLUME}" \
  --restart unless-stopped \
  "${IMAGE}"

# 4. Verify
echo "[4/4] Verifying..."
sleep 3
if docker ps | grep -q "${CONTAINER_NAME}"; then
  echo "✅ Container is running."
  docker logs "${CONTAINER_NAME}" --tail 5
else
  echo "❌ ERROR: Container failed to start!"
  docker logs "${CONTAINER_NAME}" --tail 20
  exit 1
fi

# 5. Health check
echo ""
echo "[5/5] Health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
if [ "${HTTP_STATUS}" = "200" ]; then
  echo "✅ Health check passed (HTTP ${HTTP_STATUS})"
else
  echo "⚠️  Health check returned HTTP ${HTTP_STATUS} (may still be starting)"
fi

echo ""
echo "=== Deploy complete ==="
