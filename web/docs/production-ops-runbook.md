# 本運用ランブック（全4ドメイン）

## 4ドメイン概要

| ドメイン | 公開件数 | 実データ率 | 頻度 | 方式 |
|---------|--------|----------|------|------|
| food-recall | 33件 | 100% | 日次 | Quill JSON + AI |
| shitei | 164件 | 95%+ | 平日 | HTML fetch |
| sanpai | 511件 | 98% | 週次 | HTML全件取得 |
| kyoninka | 478件 | 97.5% | 週次 | Playwright 6県 |
| **合計** | **1,186件** | | | |

## cron 設定（確定版）

```crontab
# food-recall: 日次（毎朝 7:00）— 同期 + AI抽出 + P1反映
0 7 * * * cd /path/to/web && node scripts/cron-sync-with-ai.js --domain food-recall --ai-limit 20
5 7 * * * cd /path/to/web && node scripts/apply-ai-extractions.js bulk-approve --domain food-recall

# shitei: 平日朝（月-金 8:00）
0 8 * * 1-5 cd /path/to/web && node scripts/cron-sync.js --domain shitei

# sanpai: 週次（月曜 7:00）
0 7 * * 1 cd /path/to/web && SANPAI_MAX_ITEMS=500 node scripts/cron-sync.js --domain sanpai

# kyoninka: 週次（水曜 8:00）
0 8 * * 3 cd /path/to/web && KYONINKA_KEN_CODES="13,27,23,01,14,40" node scripts/cron-sync.js --domain kyoninka
```

## 必須環境変数

| 変数 | 必須 | デフォルト | 説明 |
|------|------|----------|------|
| `SANPAI_MAX_ITEMS` | ○ | 100 | sanpai 最大取得件数（推奨: 500） |
| `KYONINKA_KEN_CODES` | ○ | 13 | kyoninka 都道府県コード（推奨: 13,27,23,01,14,40） |
| `KYONINKA_MAX_PAGES` | △ | 5 | kyoninka 県あたり最大ページ数 |
| `LLM_ENABLED` | △ | false | AI抽出のLLM有効化 |
| `LLM_API_KEY` | △ | — | LLM APIキー |
| `SLACK_WEBHOOK_URL` | △ | — | Slack通知 |

## ドメイン別 review / auto-apply ルール

### food-recall
| 条件 | 判定 |
|------|------|
| Quill JSON 抽出成功 (conf=1.0) | **P1: auto-apply** |
| 空項目のみ補完 | auto-apply |
| 既存値あり項目 | スキップ |
| Quill 抽出失敗 | P4: hold |
| サンプルデータ由来 | P4: hold |

### shitei
| 条件 | 判定 |
|------|------|
| タイトルに公募関連語あり + 自治体名あり | 公開 |
| 施設名のみ（大阪市等） | facility_name 設定して公開 |
| タイトル短い / 関連性低い | 非公開(is_published=0) |
| 新規取得 | review_required |

### sanpai
| 条件 | 判定 |
|------|------|
| さんぱいくん実データ | review_required（行政処分は保守的） |
| 処分種別: 許可取消 | risk_level=critical, status=revoked |
| 同一事業者の追加penalty | 既存entityに紐づけ |
| fallback | 保留（seed データとして保持） |

### kyoninka
| 条件 | 判定 |
|------|------|
| Playwright 取得成功 | 実データ優先 |
| Playwright 取得失敗 | fallback + エラー記録 |
| 2回目同期で既存データ | unchanged |
| 新規事業者 | review_required |

## 日次確認チェックリスト

### 毎朝（7:15頃）
- [ ] `node scripts/cron-sync-with-ai.js --status` でステータス確認
- [ ] food-recall の sync_runs が「completed」
- [ ] food-recall のP1件数が増えていれば反映確認
- [ ] admin_notifications に異常通知がないこと

### 週次（月曜 7:30 / 水曜 8:30）
- [ ] sanpai / kyoninka の sync_runs が「completed」
- [ ] 取得件数が前週と大きく変わらないこと
- [ ] fallback 発生がないこと
- [ ] review_required 件数の確認

## 障害時対応

### 同期が失敗する
```bash
# 1. source到達確認
node scripts/manage-sources.js check

# 2. 単一ドメイン手動再実行
node scripts/cron-sync.js --domain food-recall

# 3. ステータス確認
node scripts/cron-sync-with-ai.js --status
```

### Playwright が失敗する（kyoninka）
```bash
# 1. Chromium 再インストール
npx playwright install chromium

# 2. PoC テスト
node scripts/kyoninka-playwright-poc.js --check

# 3. 手動同期
node scripts/cron-sync.js --domain kyoninka
```

### source が 404
```bash
# 1. 到達確認
node scripts/manage-sources.js check

# 2. URL更新が必要なら
node scripts/manage-sources.js update-url <id> <new-url>

# 3. 一時停止
node scripts/manage-sources.js deactivate <id>
```

### 大量 review 発生
```bash
# 1. 件数確認
node scripts/apply-ai-extractions.js status

# 2. 分類確認
node scripts/apply-ai-extractions.js classify

# 3. P1一括反映
node scripts/apply-ai-extractions.js bulk-approve
```

## source 停止/再開

```bash
# 一覧
node scripts/manage-sources.js list

# 停止
node scripts/manage-sources.js deactivate <id>

# 再開
node scripts/manage-sources.js activate <id>
```

## 新しいソース/県の追加手順

### kyoninka に県を追加
1. `KYONINKA_KEN_CODES` に県コードを追加
2. 手動実行で確認
3. cron に反映

### sanpai に件数上限変更
1. `SANPAI_MAX_ITEMS` を変更
2. 手動実行で確認

### shitei に自治体追加
1. `sources/shitei-municipalities.js` の `MUNICIPALITY_SOURCES` に追加
2. 手動実行で確認

## review 効率化運用

### bulk-review コマンド
```bash
# review 状況確認
node scripts/bulk-review.js status

# 信頼ソースの新規データを一括承認（推奨: 週次で実行）
node scripts/bulk-review.js approve-trusted

# ドメイン別一括承認
node scripts/bulk-review.js approve-domain sanpai
node scripts/bulk-review.js approve-domain kyoninka

# 古い通知を既読化（7日以上前）
node scripts/bulk-review.js clear-old-notifications 7

# 圧縮後サマリー
node scripts/bulk-review.js summary
```

### review 判断基準
| 対象 | 判断 |
|------|------|
| 公的ソースからの新規 created | 一括承認可 |
| 実データの updated | 内容確認後に承認 |
| fallback 由来 | 保留 |
| source エラー | 調査後に対応 |

### 通知チューニング
- `warning` / `error` タイプの通知のみ注意
- `info` 通知は同期成功記録なので、週次で確認すれば十分
- 大量通知が溜まったら `clear-old-notifications` で圧縮

### 週次 review フロー
```bash
# 1. ステータス確認
node scripts/bulk-review.js status

# 2. 信頼ソース一括承認
node scripts/bulk-review.js approve-trusted

# 3. 古い通知クリア
node scripts/bulk-review.js clear-old-notifications 7

# 4. サマリー確認
node scripts/bulk-review.js summary
```
