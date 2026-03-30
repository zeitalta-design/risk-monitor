#!/usr/bin/env bash
# run-task.sh — GitHub Actions / 手動運用の統一ディスパッチャ
#
# 使い方:
#   bash scripts/ops/run-task.sh <action> [extra_args...]
#
# 例:
#   bash scripts/ops/run-task.sh status
#   bash scripts/ops/run-task.sh fetch_construction_dry_run
#   bash scripts/ops/run-task.sh fetch_takuti_prod --since=2021-01
#   bash scripts/ops/run-task.sh enrich_construction_prod --limit=10
#
set -euo pipefail

# ==============================
# 設定
# ==============================
APP_DIR="${APP_DIR:-/opt/app}"
CONTAINER="${CONTAINER:-navi-app}"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

ACTION="${1:-}"
shift || true
EXTRA_ARGS="$*"

# 終了時に完了メッセージを表示する trap
cleanup() {
  local exit_code=$?
  echo ""
  echo "============================================================"
  echo "  完了 | Exit code: $exit_code"
  echo "  Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "============================================================"
}
trap cleanup EXIT

if [ -z "$ACTION" ]; then
  echo "ERROR: action が指定されていません"
  echo ""
  echo "Usage: bash scripts/ops/run-task.sh <action> [extra_args...]"
  echo ""
  echo "Available actions:"
  echo "  status                       - 状態確認 (git, docker, cron, DB)"
  echo "  db_counts                    - DB件数の詳細確認"
  echo "  logs                         - ログ tail"
  echo "  fetch_construction_dry_run   - 建設業 fetch (dry-run)"
  echo "  fetch_construction_prod      - 建設業 fetch (本実行)"
  echo "  enrich_construction_dry_run  - 建設業 enrich (dry-run)"
  echo "  enrich_construction_prod     - 建設業 enrich (本実行)"
  echo "  fetch_takuti_dry_run         - 宅建業 fetch (dry-run)"
  echo "  fetch_takuti_prod            - 宅建業 fetch (本実行)"
  echo "  enrich_takuti_dry_run        - 宅建業 enrich (dry-run)"
  echo "  enrich_takuti_prod           - 宅建業 enrich (本実行)"
  echo "  watchlist_notify_dry_run     - ウォッチ通知 (dry-run)"
  echo "  watchlist_notify             - ウォッチ通知 (本送信)"
  exit 1
fi

# ==============================
# ヘルパー関数
# ==============================

# コンテナ動作チェック
check_container() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: Container '$CONTAINER' is not running"
    docker ps -a --format 'table {{.Names}}\t{{.Status}}' --filter "name=$CONTAINER" 2>/dev/null || true
    exit 1
  fi
}

# 本番実行前の共通手順
pre_production() {
  local label="$1"
  echo ">>> 本番実行前チェック <<<"
  check_container

  # DBバックアップ
  echo ""
  echo ">>> DB バックアップ実行 <<<"
  bash "$SCRIPTS_DIR/backup-db.sh" "$label"
  echo ""

  # 実行前の件数表示
  echo ">>> 実行前 DB 件数 <<<"
  docker exec "$CONTAINER" node -e "
    const D = require('better-sqlite3');
    const db = new D('/app/web/data/sports-event.db', { readonly: true });
    const rows = db.prepare(\"SELECT industry, COUNT(*) as c FROM administrative_actions GROUP BY industry\").all();
    rows.forEach(r => console.log('  ' + (r.industry || '?') + ': ' + r.c));
    const all = db.prepare('SELECT COUNT(*) as c FROM administrative_actions').get();
    console.log('  TOTAL: ' + all.c);
    db.close();
  " 2>/dev/null || echo "  (件数取得失敗)"
  echo ""
}

# 本番実行後の件数確認
post_production() {
  echo ""
  echo ">>> 実行後 DB 件数 <<<"
  docker exec "$CONTAINER" node -e "
    const D = require('better-sqlite3');
    const db = new D('/app/web/data/sports-event.db', { readonly: true });
    const rows = db.prepare(\"SELECT industry, COUNT(*) as c FROM administrative_actions GROUP BY industry\").all();
    rows.forEach(r => console.log('  ' + (r.industry || '?') + ': ' + r.c));
    const all = db.prepare('SELECT COUNT(*) as c FROM administrative_actions').get();
    console.log('  TOTAL: ' + all.c);
    db.close();
  " 2>/dev/null || echo "  (件数取得失敗)"
}

# ==============================
# flock による同時実行防止
# ==============================
LOCK_FILE="/tmp/ops-run-task.lock"

acquire_lock() {
  exec 200>"$LOCK_FILE"
  if ! flock -n 200; then
    echo "ERROR: 別のタスクが実行中です (lock: $LOCK_FILE)"
    exit 1
  fi
}

# ==============================
# メインルーティング
# ==============================

echo "============================================================"
echo "  run-task.sh | Action: $ACTION"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
[ -n "$EXTRA_ARGS" ] && echo "  Extra args: $EXTRA_ARGS"
echo "============================================================"

case "$ACTION" in

  # ----------------------------------------------------------
  # 読み取り系（ロック不要）
  # ----------------------------------------------------------
  status)
    bash "$SCRIPTS_DIR/status.sh"
    ;;

  db_counts)
    check_container
    bash "$SCRIPTS_DIR/db-counts.sh"
    ;;

  logs)
    bash "$SCRIPTS_DIR/logs.sh"
    ;;

  # ----------------------------------------------------------
  # 建設業 fetch
  # ----------------------------------------------------------
  fetch_construction_dry_run)
    check_container
    acquire_lock
    echo ">>> 建設業 fetch (dry-run) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/fetch-gyosei-shobun-mlit.js \
      --dry-run --no-detail --sector=kensetugyousya $EXTRA_ARGS
    ;;

  fetch_construction_prod)
    acquire_lock
    pre_production "fetch_construction"
    echo ">>> 建設業 fetch (本実行) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/fetch-gyosei-shobun-mlit.js \
      --no-detail --sector=kensetugyousya $EXTRA_ARGS
    post_production
    ;;

  # ----------------------------------------------------------
  # 建設業 enrich
  # ----------------------------------------------------------
  enrich_construction_dry_run)
    check_container
    acquire_lock
    echo ">>> 建設業 enrich (dry-run) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/enrich-gyosei-shobun-details.js \
      --dry-run --only-thin --industry=construction $EXTRA_ARGS
    ;;

  enrich_construction_prod)
    acquire_lock
    pre_production "enrich_construction"
    echo ">>> 建設業 enrich (本実行) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/enrich-gyosei-shobun-details.js \
      --only-thin --industry=construction $EXTRA_ARGS
    post_production
    ;;

  # ----------------------------------------------------------
  # 宅建業 fetch
  # ----------------------------------------------------------
  fetch_takuti_dry_run)
    check_container
    acquire_lock
    echo ">>> 宅建業 fetch (dry-run) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/fetch-gyosei-shobun-mlit.js \
      --dry-run --no-detail --sector=takuti $EXTRA_ARGS
    ;;

  fetch_takuti_prod)
    acquire_lock
    pre_production "fetch_takuti"
    echo ">>> 宅建業 fetch (本実行) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/fetch-gyosei-shobun-mlit.js \
      --no-detail --sector=takuti $EXTRA_ARGS
    post_production
    ;;

  # ----------------------------------------------------------
  # 宅建業 enrich
  # ----------------------------------------------------------
  enrich_takuti_dry_run)
    check_container
    acquire_lock
    echo ">>> 宅建業 enrich (dry-run) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/enrich-gyosei-shobun-details.js \
      --dry-run --only-thin --industry=real_estate $EXTRA_ARGS
    ;;

  enrich_takuti_prod)
    acquire_lock
    pre_production "enrich_takuti"
    echo ">>> 宅建業 enrich (本実行) <<<"
    docker exec "$CONTAINER" node /app/web/scripts/enrich-gyosei-shobun-details.js \
      --only-thin --industry=real_estate $EXTRA_ARGS
    post_production
    ;;

  # ----------------------------------------------------------
  # ウォッチリスト通知
  # ----------------------------------------------------------
  watchlist_notify_dry_run)
    check_container
    echo ">>> ウォッチリスト通知 (dry-run) <<<"
    docker exec "$CONTAINER" node /app/scripts/run-watchlist-notify.js --dry-run
    ;;

  watchlist_notify)
    check_container
    acquire_lock
    echo ">>> ウォッチリスト通知 (本送信) <<<"
    docker exec "$CONTAINER" node /app/scripts/run-watchlist-notify.js
    ;;

  # ----------------------------------------------------------
  # 不明なアクション
  # ----------------------------------------------------------
  *)
    echo "ERROR: Unknown action '$ACTION'"
    echo "Run without arguments to see available actions."
    exit 1
    ;;
esac
