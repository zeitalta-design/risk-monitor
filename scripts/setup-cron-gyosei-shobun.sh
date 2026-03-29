#!/bin/bash
# ============================================
# gyosei-shobun MLIT定期取得 cron 設定スクリプト
# ============================================
#
# 使い方:
#   ssh ubuntu@<VPS_HOST>
#   cd /opt/app && bash scripts/setup-cron-gyosei-shobun.sh
#
# 巡回頻度:
#   MLIT行政処分: 月1回（毎月1日 午前5時20分）
#
# 安全方針:
#   - --no-detail 固定（詳細ページ取得なし）
#   - flock で二重実行防止
#   - ログは /opt/app/logs/ に追記
#   - --clear-sample は使用しない

CONTAINER="navi-app"
LOG_DIR="/opt/app/logs"
LOCK_FILE="/tmp/gyosei-shobun-cron.lock"
DOCKER_BIN=$(which docker)

mkdir -p "${LOG_DIR}"

# マーカー
CRON_MARKER="# gyosei-shobun-mlit"

# 既存の gyosei-shobun cron を除去して再設定
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" || true)

# 新しい crontab を構成
NEW_CRON="${CURRENT_CRON}

# ============================================ ${CRON_MARKER}
# 行政処分DB MLIT定期取得（月1回）            ${CRON_MARKER}
# ============================================ ${CRON_MARKER}
#                                               ${CRON_MARKER}
# MLIT行政処分: 毎月1日 午前5時20分 JST         ${CRON_MARKER}
20 5 1 * * flock -n ${LOCK_FILE} ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/fetch-gyosei-shobun-mlit.js --no-detail >> ${LOG_DIR}/gyosei-shobun.log 2>&1 ${CRON_MARKER}
"

echo "${NEW_CRON}" | crontab -

echo "✅ gyosei-shobun cron 設定完了:"
echo ""
echo "  MLIT行政処分: 毎月1日 (午前5時20分)"
echo "  モード:       --no-detail (詳細取得なし)"
echo "  二重実行防止: flock ${LOCK_FILE}"
echo "  ログ:         ${LOG_DIR}/gyosei-shobun.log"
echo ""
echo "確認: crontab -l | grep gyosei"
echo "ログ: tail -50 ${LOG_DIR}/gyosei-shobun.log"
echo ""
echo "=== 停止・解除方法 ==="
echo "  一時停止:   crontab -l | grep -v '${CRON_MARKER}' | crontab -"
echo "  手動実行:   ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/fetch-gyosei-shobun-mlit.js --no-detail"
echo "  dry-run:    ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/fetch-gyosei-shobun-mlit.js --dry-run --no-detail"
echo "  件数確認:   ${DOCKER_BIN} exec ${CONTAINER} node -e \"const D=require('better-sqlite3');const d=new D('/app/web/data/sports-event.db',{readonly:true});console.log(d.prepare('SELECT COUNT(*) as c FROM administrative_actions WHERE is_published=1').get().c);d.close()\""
