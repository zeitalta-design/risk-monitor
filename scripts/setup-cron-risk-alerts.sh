#!/bin/bash
# ============================================
# risk-alerts-sync cron 設定スクリプト
# ============================================
#
# 用途:
#   ウォッチ対象の新着行政処分を risk_alerts に同期し、
#   ユーザーへメール通知を送信する定期ジョブ。
#
# 使い方:
#   ssh ubuntu@<VPS_HOST>
#   cd /opt/app && bash scripts/setup-cron-risk-alerts.sh
#
# 実行頻度:
#   毎日 午前7時00分 JST
#   ※ gyosei-shobun-mlit fetch (05:20) → enrich (06:00) の後に実行
#
# 安全方針:
#   - flock で二重実行防止
#   - CRON_SECRET 環境変数で認証
#   - dry-run オプション付き（--dry-run で送信しない）
#   - ログは /opt/app/logs/ に追記
#
# 前提:
#   - アプリが http://localhost:3001 で稼働していること
#   - CRON_SECRET 環境変数がアプリで設定されていること（任意）

CONTAINER="navi-app"
APP_URL="http://localhost:3001"
LOG_DIR="/opt/app/logs"
LOCK_FILE="/tmp/risk-alerts-sync.lock"
CRON_SECRET="${CRON_SECRET:-}"  # 環境変数から取得

mkdir -p "${LOG_DIR}"

# マーカー
CRON_MARKER="# risk-alerts-sync"

# 既存の risk-alerts-sync cron を除去して再設定
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" || true)

# curl コマンド構成
if [ -n "${CRON_SECRET}" ]; then
  CURL_AUTH="-H \"Authorization: Bearer ${CRON_SECRET}\""
else
  CURL_AUTH=""
fi

NEW_CRON="${CURRENT_CRON}

# ============================================ ${CRON_MARKER}
# リスク監視 アラート同期 + メール通知（毎日） ${CRON_MARKER}
# ============================================ ${CRON_MARKER}
#                                               ${CRON_MARKER}
# 毎日 午前7時00分 JST                          ${CRON_MARKER}
0 7 * * * flock -n ${LOCK_FILE} curl -s -X POST ${CURL_AUTH} '${APP_URL}/api/cron/risk-alerts-sync' >> ${LOG_DIR}/risk-alerts-sync.log 2>&1 ${CRON_MARKER}
"

echo "${NEW_CRON}" | crontab -

echo "✅ risk-alerts-sync cron 設定完了:"
echo ""
echo "  実行頻度: 毎日 午前7時00分 JST"
echo "  エンドポイント: ${APP_URL}/api/cron/risk-alerts-sync"
echo "  二重実行防止: flock ${LOCK_FILE}"
echo "  ログ: ${LOG_DIR}/risk-alerts-sync.log"
echo ""
echo "=== 手動実行 ==="
echo "  通常:   curl -s -X POST '${APP_URL}/api/cron/risk-alerts-sync'"
echo "  dry-run: curl -s -X POST '${APP_URL}/api/cron/risk-alerts-sync?dry_run=1'"
echo "  sync only: curl -s -X POST '${APP_URL}/api/cron/risk-alerts-sync?sync_only=1'"
echo ""
echo "=== 停止・解除方法 ==="
echo "  crontab -l | grep -v '${CRON_MARKER}' | crontab -"
echo ""
echo "=== 3段構成の全体像 ==="
echo "  05:20  fetch    → 新規処分データを MLIT から取得・投入"
echo "  06:00  enrich   → summary/detail を詳細ページから補完"
echo "  07:00  risk-alerts-sync → ウォッチ対象の新着処分をアラート同期 + メール通知"
