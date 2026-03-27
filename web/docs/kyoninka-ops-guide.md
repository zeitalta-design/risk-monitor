# kyoninka 日次/週次運用ガイド

## 概要
国交省建設業者検索システムから Playwright で実データを取得し、
kyoninka_entities / kyoninka_registrations に保存する。

## 推奨 cron 設定

```crontab
# 週次（水曜 8:00）— 東京都のみ
0 8 * * 3 cd /path/to/web && node scripts/cron-sync.js --domain kyoninka

# 週次（水曜 8:00）— 6県一括（推奨設定）
0 8 * * 3 cd /path/to/web && KYONINKA_KEN_CODES="13,27,23,01,14,40" node scripts/cron-sync.js --domain kyoninka

# 週次（水曜 8:00）— 東京都 + 大阪府のみ（軽量版）
0 8 * * 3 cd /path/to/web && KYONINKA_KEN_CODES="13,27" node scripts/cron-sync.js --domain kyoninka
```

## 環境変数

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `KYONINKA_KEN_CODES` | `13` | 取得する都道府県コード（カンマ区切り） |
| `KYONINKA_MAX_PAGES` | `5` | 1県あたりの最大取得ページ数 |

## 都道府県コード一覧（主要）

| コード | 都道府県 | 推定事業者数 |
|--------|---------|-----------|
| 01 | 北海道 | ~10,000 |
| 13 | 東京都 | ~49,000 |
| 14 | 神奈川県 | ~15,000 |
| 23 | 愛知県 | ~20,000 |
| 27 | 大阪府 | ~20,000 |
| 40 | 福岡県 | ~12,000 |

## 取得上限設計

### 推奨設定
| 項目 | 値 | 理由 |
|------|-----|------|
| maxPages | 5 | ~250件/県、16秒程度で完了 |
| 頻度 | 週次 | Playwright のリソース負荷を考慮 |
| 対象県 | 1-3県 | 段階的に拡大 |

### 全件取得が必要な場合
```bash
# maxPages を大きく設定（注意: 時間がかかる）
KYONINKA_MAX_PAGES=50 node scripts/cron-sync.js --domain kyoninka
```

## Playwright 安定運用条件

### タイムアウト
- ページアクセス: 30秒
- 検索送信: 30秒
- ページ遷移: 30秒
- 全体: ~30秒/ページ × maxPages

### 失敗時の挙動
1. Playwright 失敗 → fallback（サンプルデータ）に切替
2. sync_runs に `error_summary` を記録
3. admin_notifications に通知
4. 次回実行時に再取得（冪等性あり）

### リソース使用量
- メモリ: ~200MB（Chromium headless）
- CPU: 中程度（検索実行中のみ）
- ディスク: ~500MB（Chromium バイナリ）
- ネットワーク: ~100KB/ページ

## fallback ルール

| 条件 | 動作 |
|------|------|
| Playwright インストール済み + 正常取得 | 実データ使用 |
| Playwright インストール済み + 取得失敗 | fallback + エラー記録 |
| Playwright 未インストール | fallback のみ |
| fallback 使用時 | sync_runs に記録、通知生成 |

## 手動実行

```bash
# ステータス確認
node scripts/cron-sync.js --status

# 手動同期（東京都のみ）
node scripts/cron-sync.js --domain kyoninka

# 手動同期（複数県）
KYONINKA_KEN_CODES="13,27,23" node scripts/cron-sync.js --domain kyoninka

# Playwright PoC（テスト用）
node scripts/kyoninka-playwright-poc.js
node scripts/kyoninka-playwright-poc.js --ken 27
```

## トラブルシューティング

### Playwright が失敗する
```bash
# Chromium 再インストール
npx playwright install chromium

# PoC で個別テスト
node scripts/kyoninka-playwright-poc.js --debug
```

### 取得件数が0
- 国交省サイトのメンテナンスの可能性
- `manage-sources.js check` で到達確認
- `--debug` モードでページ構造を確認

### 重複データ
- slug ベースの重複チェックが動作
- 2回目同期で `unchanged` が正常に判定される
- 手動で確認: `node scripts/apply-ai-extractions.js status`
