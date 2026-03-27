# food-recall 完全自動運用ガイド

## 概要
消費者庁リコール情報サイトから食品リコール情報を日次自動取得し、
Quill JSON 構造化抽出により **LLM不要・confidence 1.0** で全項目を補完する。

## 抽出方式
消費者庁 detail.php は Quill エディタでJSレンダリングされるが、
HTML内の `contentsText = '{"ops":[...]}'` 変数に全データが埋め込まれている。
これを直接JSON parseすることで、ブラウザ自動操作・LLM不要で全項目を抽出。

### 抽出優先順位
1. **Quill JSON** (`contentsText` 変数) — 主力、conf 1.0
2. テーブル行 (`<tr><td>`) — 補助
3. プレーンテキスト正規表現 — fallback
4. LLM — 例外ケースのみ（通常不要）

### 抽出される項目（7項目）
| 項目 | Quill Block | 説明 |
|------|-----------|------|
| contact_info | Block 1 | 連絡先（社名・電話番号・受付時間） |
| consumer_action | Block 2 | 対応方法（回収方法・返金等） |
| lot_number | Block 3 | 対象特定情報（JANコード・ロット番号・賞味期限等） |
| reason_detail | Block 4 | 回収理由の詳細 |
| health_impact | Block 4 | 健康影響（= reason_detail） |
| product_name | `<li>` / Quill | 商品名 |
| summary | 自動生成 | 「事業者名「商品名」— 回収理由」 |

## 日次運用フロー

### 完全自動（cron 推奨）
```bash
# 毎朝 7:00 に実行
0 7 * * * cd /path/to/web && node scripts/cron-sync-with-ai.js --domain food-recall --ai-limit 20

# 続けて P1 一括反映
5 7 * * * cd /path/to/web && node scripts/apply-ai-extractions.js bulk-approve --domain food-recall
```

### 手動確認（必要時）
```bash
# ステータス確認
node scripts/cron-sync-with-ai.js --status

# 分類確認
node scripts/apply-ai-extractions.js classify

# プレビュー
node scripts/apply-ai-extractions.js preview food-recall

# 個別反映
node scripts/apply-ai-extractions.js apply food-recall
```

## P1 自動反映条件

### P1 (自動反映可)
- confidence ≥ 0.8
- quality = "good"
- missing_fields = 0
- Quill JSON 抽出成功
- 反映先が空欄のみ

### P2 (review 必要)
- confidence ≥ 0.5
- データあり
- 一部欠損またはサンプルデータ由来

### P4 (対象外)
- サンプルデータ（消費者庁に詳細ページが存在しない）
- 抽出失敗

## Bulk Apply 安全条件
1. **P1 のみ** が対象
2. **empty field のみ** 補完（上書き禁止）
3. **applied_at** タイムスタンプを記録
4. **preview 確認推奨**（省略可能だが推奨）
5. スキップ理由: 既に値がある項目は補完しない

## 実績
- 実データ取得: 消費者庁から15-18件/回
- Quill JSON 抽出成功率: 100%（実データに対して）
- P1 判定率: 100%（実データ）
- 反映成功率: 100%
- 1件あたり処理時間: ~0.3秒

## トラブルシューティング

### 新着が0件
- 消費者庁サイトの構造変更の可能性
- `manage-sources.js check` で到達確認

### Quill ブロックが0件
- `contentsText` の埋め込みパターンが変更された可能性
- `scripts/test-caa-extract.js` で生データを確認

### P1が出ない
- サンプルデータのみの場合（実データがない）
- `cron-sync-with-ai.js --status` でAI未実行件数を確認
