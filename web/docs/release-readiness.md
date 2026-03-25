# リリース準備 — 比較サイト OS

> 本番デプロイ前にまずこのファイルを読み、完了状況を確認してから各手順に進む。

---

## 1. 完了事項

### 共通基盤

- [x] domain registry（6ドメイン登録済み）
- [x] DomainListPage / DomainDetailPage
- [x] DomainCompareButton / DomainCompareBar / compare-store
- [x] DomainFavoriteButton
- [x] AdminListPage / AdminFormPage
- [x] scaffold（admin guard + audit 標準組み込み済み、12ファイル生成）

### 6ドメイン

| ドメイン | 公開 | DB | compare | favorite | admin | importer | source | sitemap |
|---------|------|---|---------|----------|-------|---------|--------|---------|
| sports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| saas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| yutai | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| hojokin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| nyusatsu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| minpaku | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 認証・認可・監査

- [x] admin ページ保護（AdminGuard — 全ドメイン）
- [x] admin API 保護（requireAdminApi — 全 admin route 統一済み）
- [x] admin CRUD の audit log（POST: ADMIN_ITEM_CREATED / PUT: ADMIN_ITEM_UPDATED）
- [x] 監査ログ閲覧 UI（`/admin/audit-logs`）
- [x] 監査ログ API（requireAdminApi 保護済み）

### 運用基盤

- [x] importer（local / remote / source adapter — 4ドメイン）
- [x] run-imports.js（`--all --source primary` / `--fail-fast` / `--continue-on-error`）
- [x] cron 向け npm scripts（`imports:source` / `imports:source:dry`）
- [x] dotenv 対応（全 import スクリプト）
- [x] .env.example（全 env 網羅）

### ドキュメント

- [x] [domain-platform-guide.md](./domain-platform-guide.md) — 基盤設計・API・scaffold・チェックリスト
- [x] [deploy-checklist.md](./deploy-checklist.md) — 本番 env 設定チェック
- [x] [source-rollout-guide.md](./source-rollout-guide.md) — source URL 投入手順
- [x] [import-operations.md](./import-operations.md) — importer 運用手順

---

## 2. 未対応事項（Phase 2 以降）

| 項目 | 優先度 | 備考 |
|------|--------|------|
| RBAC（editor / viewer 権限分離） | 中 | 現在は admin only |
| 2FA | 低 | SESSION_SECRET + HMAC で基本保護済み |
| 監査ログ CSV export | 低 | 閲覧 UI は対応済み |
| admin からの手動 import 実行ボタン | 中 | CLI / cron で運用可能 |
| Slack / メール通知（import 結果） | 中 | exit code + ログで代替可 |
| 実行履歴 DB 保存 | 低 | ログファイルで代替可 |
| CSV 入力対応 | 低 | JSON で運用可能 |
| 画像アップロード | 低 | URL 参照で代替可 |
| SEO 本格強化（JSON-LD 全ドメイン統一） | 中 | saas で部分対応済み |
| sports / saas の DomainListPage 適用 | 低 | 独自実装で安定稼働中 |
| `ops/patrol/check-notify` の guard 統一 | 低 | cron secret で保護済み |

---

## 3. デプロイ前確認（推奨順）

以下の順番で確認し、各ドキュメントの手順に沿う。

### Step 1: env 設定

→ **[deploy-checklist.md](./deploy-checklist.md)** のセクション 1〜8

- [ ] `.env` に全必須項目を設定
- [ ] `SESSION_SECRET` にランダム文字列を設定（開発用フォールバック禁止）
- [ ] `APP_BASE_URL` を本番ドメインに設定
- [ ] メール送信が必要なら SMTP 設定

### Step 2: ビルド

```bash
npx next build
```

- [ ] ビルド成功
- [ ] エラーなし

### Step 3: admin 確認

- [ ] `/admin` にアクセス → ログイン画面が出る
- [ ] admin ユーザーでログイン → CRUD 操作可能
- [ ] 未認証で `/api/admin/yutai` → 401
- [ ] `/admin/audit-logs` で操作履歴が見える

### Step 4: source URL 投入（必要な場合）

→ **[source-rollout-guide.md](./source-rollout-guide.md)** の手順 1〜7

- [ ] 対象ドメインの source URL を `.env` に設定
- [ ] 疎通確認（curl）
- [ ] dry-run 成功（`npm run imports:source:dry`）
- [ ] 本番実行（`npm run imports:source`）
- [ ] 反映後確認

### Step 5: 公開側スモーク確認

- [ ] `/marathon` — 一覧表示
- [ ] `/saas` — 一覧表示
- [ ] `/yutai` — 一覧 + 詳細 + 比較
- [ ] `/hojokin` — 一覧 + 詳細 + 比較
- [ ] `/nyusatsu` — 一覧 + 詳細 + 比較
- [ ] `/minpaku` — 一覧 + 詳細 + 比較
- [ ] `/sitemap.xml` — 全ドメインの URL が含まれる

### Step 6: cron 設定（必要な場合）

→ **[import-operations.md](./import-operations.md)** のセクション 3

- [ ] cron コマンド設定
- [ ] ログ出力先確認（`mkdir -p logs`）
- [ ] cron 実行ユーザーが `.env` を読める

---

## 4. 反映後確認

- [ ] 公開ページが正常表示（6ドメイン）
- [ ] admin ログイン・CRUD が動作
- [ ] compare / favorite が動作
- [ ] sitemap が正常
- [ ] importer dry-run が成功
- [ ] コンソール / サーバーエラーなし

---

## 5. ロールバック観点

| 問題 | 対処 |
|------|------|
| source URL が不正だった | `.env` の URL を空にし、cron を停止 |
| import データに問題がある | admin で `is_published = 0` にする。旧 source で再 import |
| admin 認証が効かない | `SESSION_SECRET` / DB sessions を確認 |
| 公開ページが壊れた | `next build` を再実行。DB データは upsert のため残る |
| sitemap がおかしい | `APP_BASE_URL` を確認。`next build` で再生成 |

詳細は [source-rollout-guide.md](./source-rollout-guide.md) のセクション 7 を参照。

---

## ドキュメント索引

| ドキュメント | 目的 | いつ見るか |
|------------|------|----------|
| **release-readiness.md**（このファイル） | 完了状況・残課題・デプロイ順序 | 最初に |
| [deploy-checklist.md](./deploy-checklist.md) | env 設定の詳細チェック | Step 1 |
| [source-rollout-guide.md](./source-rollout-guide.md) | source URL 投入手順 | Step 4 |
| [import-operations.md](./import-operations.md) | importer 日常運用 | Step 6 / 運用時 |
| [domain-platform-guide.md](./domain-platform-guide.md) | 基盤設計・API・scaffold | 新ドメイン追加時 |
| [hosting-decision.md](./hosting-decision.md) | ホスティング方式比較・推奨案 | デプロイ先決定時 |
| [deploy-guide.md](./deploy-guide.md) | Docker + VPS デプロイ手順 | 本番デプロイ時 |
