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
#
# 環境変数の分類:
#   必須: SESSION_SECRET（未設定時はデプロイ中止）
#   推奨: APP_BASE_URL, SMTP_HOST/USER/PASS（未設定時は warning）
#   任意: ALLOW_SIGNUP, OPS_ADMIN_EMAIL 等（未設定でもサイレント続行）
#
# 環境変数の読み込み順:
#   1. シェル環境（export 済みの変数）
#   2. /opt/app/.env.production（ファイルがあれば上書き読み込み）

set -euo pipefail

# ============================================
# ユーティリティ関数
# ============================================

# 必須env: 未設定ならエラーメッセージを出して終了
require_env() {
  local var_name="$1"
  local hint="${2:-}"
  if [ -z "${!var_name:-}" ]; then
    echo "❌ ERROR: ${var_name} is required but not set."
    [ -n "${hint}" ] && echo "   Hint: ${hint}"
    echo "   Set it in /opt/app/.env.production or export before running."
    exit 1
  fi
}

# 推奨env: 未設定なら warning を出す（続行する）
recommend_env() {
  local var_name="$1"
  local consequence="${2:-some features may not work}"
  if [ -z "${!var_name:-}" ]; then
    echo "⚠️  WARNING: ${var_name} is not set — ${consequence}"
  fi
}

# env値をマスクしてログ出力（秘密情報を隠す）
log_env() {
  local var_name="$1"
  local value="${!var_name:-}"
  if [ -z "${value}" ]; then
    echo "   ${var_name}: (not set)"
  elif [ ${#value} -le 4 ]; then
    echo "   ${var_name}: ****"
  else
    echo "   ${var_name}: ${value:0:4}****"
  fi
}

# ============================================
# 0. .env ファイルの読み込み
# ============================================
ENV_FILE="/opt/app/.env.production"
if [ -f "${ENV_FILE}" ]; then
  echo "[0/5] Loading ${ENV_FILE}"
  set -a
  # コメント行と空行を除外して読み込み
  source "${ENV_FILE}"
  set +a
else
  echo "[0/5] ${ENV_FILE} not found — using shell environment only"
fi

# ============================================
# 1. 環境変数のバリデーション
# ============================================
echo ""
echo "=== Environment Check ==="

# --- 必須 ---
require_env "SESSION_SECRET" "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""

if [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "❌ ERROR: SESSION_SECRET must be at least 32 characters (current: ${#SESSION_SECRET})"
  exit 1
fi

# --- 推奨 ---
recommend_env "APP_BASE_URL" "password reset URLs and OGP will not work correctly"
recommend_env "SMTP_HOST"    "email notifications will fall back to Ethereal (test-only)"

# --- 情報表示（値はマスク） ---
echo ""
echo "--- Config Summary ---"
echo " [required]"
log_env "SESSION_SECRET"
echo " [recommended]"
log_env "APP_BASE_URL"
log_env "SMTP_HOST"
log_env "SMTP_USER"
log_env "SMTP_PASS"
echo " [optional]"
log_env "ALLOW_SIGNUP"
log_env "OPS_ADMIN_EMAIL"
echo "----------------------"
echo ""

# ============================================
# 2. コンテナ定数
# ============================================
CONTAINER_NAME="navi-app"
IMAGE="ghcr.io/zeitalta-design/sports-event-app:latest"
DATA_VOLUME="/opt/app/web/data:/app/web/data"

echo "=== VPS Deploy: pull → stop → start ==="

# ============================================
# 3. Pull latest image
# ============================================
echo "[1/5] Pulling image: ${IMAGE}"
docker pull "${IMAGE}"

# ============================================
# 4. Stop existing container
# ============================================
echo "[2/5] Stopping existing container..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# ============================================
# 5. Build docker run arguments
# ============================================
echo "[3/5] Starting new container..."

# --- 必須env（バリデーション済み） ---
ENV_ARGS=(
  -e NODE_ENV=production
  -e SESSION_SECRET="${SESSION_SECRET}"
)

# --- 推奨env（デフォルト値付き） ---
ENV_ARGS+=(-e APP_BASE_URL="${APP_BASE_URL:-https://taikainavi.jp}")

# --- 任意env ---
ENV_ARGS+=(-e ALLOW_SIGNUP="${ALLOW_SIGNUP:-false}")
[ -n "${OPS_ADMIN_EMAIL:-}" ] && ENV_ARGS+=(-e OPS_ADMIN_EMAIL="${OPS_ADMIN_EMAIL}")

# --- SMTP（推奨: 設定時のみコンテナに渡す） ---
if [ -n "${SMTP_HOST:-}" ]; then
  ENV_ARGS+=(-e SMTP_HOST="${SMTP_HOST}")
  ENV_ARGS+=(-e SMTP_PORT="${SMTP_PORT:-587}")
  [ -n "${SMTP_USER:-}" ]   && ENV_ARGS+=(-e SMTP_USER="${SMTP_USER}")
  [ -n "${SMTP_PASS:-}" ]   && ENV_ARGS+=(-e SMTP_PASS="${SMTP_PASS}")
  [ -n "${SMTP_SECURE:-}" ] && ENV_ARGS+=(-e SMTP_SECURE="${SMTP_SECURE}")
  ENV_ARGS+=(-e MAIL_FROM="${MAIL_FROM:-Risk Monitor <noreply@taikainavi.jp>}")
  echo "  [smtp] configured: ${SMTP_HOST}"
else
  echo "  [smtp] not configured — Ethereal fallback"
fi

# --- Start ---
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 127.0.0.1:3000:3000 \
  "${ENV_ARGS[@]}" \
  -v "${DATA_VOLUME}" \
  -v /opt/app/scraper:/app/scraper:ro \
  -v /opt/app/scripts:/app/scripts:ro \
  -v /opt/app/sql:/app/sql:ro \
  --restart unless-stopped \
  "${IMAGE}"

# ============================================
# 6. Verify container is running
# ============================================
echo "[4/5] Verifying..."
sleep 3
if docker ps | grep -q "${CONTAINER_NAME}"; then
  echo "✅ Container is running."
  docker logs "${CONTAINER_NAME}" --tail 5
else
  echo "❌ ERROR: Container failed to start!"
  docker logs "${CONTAINER_NAME}" --tail 20
  exit 1
fi

# ============================================
# 7. Health check
# ============================================
echo ""
echo "[5/5] Health check..."
RETRIES=3
for i in $(seq 1 ${RETRIES}); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "${HTTP_STATUS}" = "200" ]; then
    echo "✅ Health check passed (HTTP ${HTTP_STATUS})"
    break
  fi
  if [ "${i}" -lt "${RETRIES}" ]; then
    echo "  Attempt ${i}/${RETRIES}: HTTP ${HTTP_STATUS} — retrying in 3s..."
    sleep 3
  else
    echo "⚠️  Health check failed after ${RETRIES} attempts (HTTP ${HTTP_STATUS})"
    echo "  Container is running but may still be starting. Check manually:"
    echo "  curl http://localhost:3000/"
  fi
done

echo ""
echo "=== Deploy complete ==="
