# リスク監視SaaS MVP — 残課題バックログ

最終更新: 2026-04-01
対象リポジトリ: /home/work/sports-event-app (branch: main)

---

## 完了済み（MVP）

| # | 内容 | commit |
|---|---|---|
| B1 | risk_alerts テーブル + /api/watchlist + /api/risk-alerts | e5ada51 |
| B2 | 危険度スコアロジック + RiskBadge + /api/entities/risk-summary | 3be59ef |
| B3 | 一覧ページ ウォッチ追加ボタン + 危険度バッジ | 086e1ce |
| B4 | 詳細ページ リスクサマリー + 監視登録セクション | 3bdc0d5 |
| B5 | /risk-watch ページ | 9db5b26 |
| B6 | ヘッダー 未読バッジ + リスク監視導線 | c7e38e8 |
| B7 | /risk-alerts 通知一覧ページ | 75414d7 |
| B8 | alert挿入ロジック（冪等）+ UNIQUE INDEX | 4e25ba4 |
| B10 | 未ログイン時 401 → /login リダイレクト | 42e4c21 |
| B11a | /gyosei-shobun にリスク監視バナー追加 | 0726d3d |
| B13 | /api/cron/risk-alerts-sync + setup-cron-risk-alerts.sh | 26c4890 |
| B12 | 無料/有料境界CTA（/risk-watch + 詳細ページ） | 70b5997 |

---

## 次期開発バックログ

### 優先度: 高（運用に直結）

- [ ] **cron実際の登録確認**
  - `bash scripts/setup-cron-risk-alerts.sh` を本番VPSで実行
  - 3段構成（fetch 05:20 → enrich 06:00 → risk-alerts-sync 07:00）を確認
  - `CRON_SECRET` 環境変数の設定

- [ ] **シードデータ投入（デモ環境）**
  - `npm install` → `next dev` → `node web/scripts/seed-gyosei-shobun.js`
  - デモ用ユーザー作成（`node web/scripts/seed-saas.js` 相当）

- [ ] **syncRiskAlerts の初回全件同期**
  - 既存ウォッチが既にある場合、POST /api/cron/risk-alerts-sync?sync_only=1 を一度実行

### 優先度: 中（品質向上）

- [ ] **/api/entities/risk-summary への認証ガード**（方針保留中）
  - 現在: 認証なし（公開データのみ参照）
  - 将来: レート制限 or ユーザー認証を追加

- [ ] **危険度スコアのキャッシュ化（entity_risk_scores テーブル）**
  - 現在: 毎回リアルタイム計算
  - 処分件数が増えた場合、一覧ページのパフォーマンス劣化リスクあり
  - 対策: daily cronでスコアをキャッシュ or リクエスト時にメモ化

- [ ] **risk_alerts の action_id なしケースの詳細リンク改善**
  - 現在: action_id がある場合のみ詳細リンクを表示
  - action_slug での検索リンクへのフォールバック実装

- [ ] **risk-alerts ページのページネーション**
  - 現在: 最新100件のみ取得
  - 長期運用で件数が増えた場合のページネーション対応

### 優先度: 低（将来機能）

- [ ] **有料プラン実装**
  - Stripe連携
  - ウォッチ件数上限解除（plan_type = 'pro'）
  - watched_organizations テーブルへ plan_type カラム追加

- [ ] **通知チャンネル拡張**
  - Slack Webhook
  - LINE通知
  - 現在: メールのみ（watchlist-notification-service.js）

- [ ] **週次レポート機能**
  - watched_organizations のサマリーをWeekly digestで送信

- [ ] **業種・地域フィルタ監視**
  - 特定業種 × 特定都道府県の新着処分をウォッチ（企業名指定なし）
  - 新テーブル: watch_filters（filter_type: industry/prefecture, filter_value）

- [ ] **CSV出力**
  - /risk-watch から監視中事業者の処分履歴をCSV出力

- [ ] **mobile対応強化**
  - /risk-watch・/risk-alerts のモバイルUI最適化

---

## 運用メモ

### cronジョブ全体像（設定後）
```
05:20  fetch    → MLIT新規処分取得（月1回: setup-cron-gyosei-shobun.sh）
06:00  enrich   → summary/detail補完（月1回: setup-cron-gyosei-shobun-enrich.sh）
07:00  sync     → ウォッチアラート同期+通知（毎日: setup-cron-risk-alerts.sh）
```

### 認証モデル
- 一般ユーザー: getCurrentUser() (cookie/session)
- Admin: requireAdminApi()
- Cron: CRON_SECRET環境変数 (Bearer token)

### 無料/有料境界
- 無料: ウォッチ3件まで（FREE_WATCH_LIMIT = 3 in /api/watchlist/route.js）
- 上限変更: 上記定数を編集するだけで即反映
- 有料: 将来的に user.plan_type で分岐

### デモシナリオ（想定）
1. /gyosei-shobun で「株式会社大林組」を検索
2. 処分カードの「＋ウォッチ」をクリック（要ログイン → /login）
3. /risk-watch でウォッチ一覧確認・危険度表示
4. 詳細ページでリスクサマリー・監視登録セクション確認
5. 3件登録後にアップグレードCTAを表示
6. /risk-alerts で通知一覧・既読管理確認
