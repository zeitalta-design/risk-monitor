#!/bin/bash
# ============================================
# スクレイピング定期実行 cron 設定スクリプト
# ============================================
#
# 使い方:
#   ssh ubuntu@<VPS_HOST>
#   cd /opt/app && bash scripts/setup-cron.sh
#
# 巡回頻度:
#   RUNNET:       3日に1回（午前5時）
#   SPORTS ENTRY: 3日に1回（午前6時）
#   MOSHICOM:     週1回（日曜 午前7時）
#   popularity:   毎日（午前8時）
#
# 手動再実行: 管理画面から随時可能（この設定に影響なし）

CONTAINER="navi-app"
LOG_DIR="/opt/app/logs"

mkdir -p "${LOG_DIR}"

# 既存のスクレイピング cron を削除して再設定
CRON_MARKER="# taikai-navi-scraping"

# 現在の crontab を取得（存在しない場合は空）
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" | grep -v "scrape-runnet\|scrape-sportsentry\|scrape-moshicom\|calc-initial-popularity" || true)

# 新しい crontab を構成
NEW_CRON="${CURRENT_CRON}

# ============================================ ${CRON_MARKER}
# Risk Monitor スクレイピング定期巡回               ${CRON_MARKER}
# ============================================ ${CRON_MARKER}
#                                               ${CRON_MARKER}
# RUNNET: 3日に1回 (1,4,7,10,13,16,19,22,25,28日 午前5時) ${CRON_MARKER}
0 5 1,4,7,10,13,16,19,22,25,28 * * docker exec ${CONTAINER} node /app/scripts/scrape-runnet-list.js --pages all >> ${LOG_DIR}/runnet.log 2>&1 ${CRON_MARKER}
#                                               ${CRON_MARKER}
# SPORTS ENTRY: 3日に1回 (2,5,8,11,14,17,20,23,26,29日 午前6時) ${CRON_MARKER}
0 6 2,5,8,11,14,17,20,23,26,29 * * docker exec ${CONTAINER} node /app/scripts/scrape-sportsentry-list.js --pages all >> ${LOG_DIR}/sportsentry.log 2>&1 ${CRON_MARKER}
#                                               ${CRON_MARKER}
# MOSHICOM: 週1回 (日曜 午前7時)                ${CRON_MARKER}
0 7 * * 0 docker exec ${CONTAINER} node /app/scripts/scrape-moshicom-list.js --pages all >> ${LOG_DIR}/moshicom.log 2>&1 ${CRON_MARKER}
#                                               ${CRON_MARKER}
# 失敗再試行: 毎日 午前4時                      ${CRON_MARKER}
0 4 * * * docker exec ${CONTAINER} node /app/scripts/retry-failed-scrapes.js >> ${LOG_DIR}/retry.log 2>&1 ${CRON_MARKER}
#                                               ${CRON_MARKER}
# popularity再計算: 毎日 午前8時                ${CRON_MARKER}
0 8 * * * docker exec ${CONTAINER} node /app/scripts/calc-initial-popularity.js >> ${LOG_DIR}/popularity.log 2>&1 ${CRON_MARKER}
"

echo "${NEW_CRON}" | crontab -

echo "✅ cron 設定完了:"
echo ""
echo "  失敗再試行:   毎日 (午前4時) ← 失敗ソースのみ"
echo "  RUNNET:       3日に1回 (午前5時)"
echo "  SPORTS ENTRY: 3日に1回 (午前6時)"
echo "  MOSHICOM:     週1回 (日曜 午前7時)"
echo "  popularity:   毎日 (午前8時)"
echo ""
echo "確認: crontab -l"
echo "ログ: ${LOG_DIR}/"
