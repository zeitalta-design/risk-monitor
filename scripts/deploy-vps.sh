#!/bin/bash
# ============================================
# VPS デプロイスクリプト
# GHCR からイメージを pull → コンテナ再起動
# ============================================
#
# 使い方:
#   ssh ubuntu@133.125.38.92
#   cd /opt/app && bash scripts/deploy-vps.sh
#
# 前提:
#   - Docker がインストール済み
#   - GHCR package は Public のため認証不要
#   - /opt/app/web/data にDBファイルがマウントされる
#   - swap 2GB 設定済み (/swapfile)
#
# 環境変数（必要に応じて .env ファイルで管理）:
#   APP_BASE_URL, SESSION_SECRET, NODE_ENV

set -euo pipefail

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

# 3. Start new container
echo "[3/4] Starting new container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 127.0.0.1:3000:3000 \
  -e APP_BASE_URL="${APP_BASE_URL:-https://taikainavi.jp}" \
  -e SESSION_SECRET="${SESSION_SECRET:-$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)}" \
  -e ALLOW_SIGNUP="${ALLOW_SIGNUP:-false}" \
  -e NODE_ENV=production \
  -v "${DATA_VOLUME}" \
  --restart unless-stopped \
  "${IMAGE}"

# 4. Verify
echo "[4/4] Verifying..."
sleep 3
if docker ps | grep -q "${CONTAINER_NAME}"; then
  echo "Container is running."
  docker logs "${CONTAINER_NAME}" --tail 5
else
  echo "ERROR: Container failed to start!"
  docker logs "${CONTAINER_NAME}" --tail 20
  exit 1
fi

echo ""
echo "=== Deploy complete ==="
echo "Check: curl http://localhost:3000/"
