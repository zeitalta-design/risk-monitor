# ホスティング方式決定ガイド

> 比較サイト OS のデプロイ先を選定するための判断材料。
> 現行 repo 構成に即した比較と推奨案を示す。

---

## 現行 repo の技術制約

| 項目 | 現状 |
|------|------|
| フレームワーク | Next.js (App Router) |
| DB | **SQLite** (better-sqlite3) — ファイルベース、`data/sports-event.db` (約4MB) |
| セッション | cookie + DB (sessions テーブル) |
| API | Next.js Route Handlers (サーバーサイド) |
| cron / importer | Node.js CLI スクリプト（`scripts/run-imports.js`） |
| ネイティブモジュール | `better-sqlite3`（C++ アドオン、ビルド環境に依存） |
| env | `.env` (dotenv) |
| 出力 | デフォルト（`output: "standalone"` 未設定） |

### 最大の制約: SQLite

SQLite はファイルベース DB であり、以下の影響がある:

- **サーバーレス不適合** — Vercel Functions / Netlify Functions は一時ファイルシステム。DB 永続化不可
- **read-only ファイルシステム不可** — DB への書き込み（session / favorites / admin CRUD / importer）が必須
- **永続ディスクが必要** — DB ファイルが消えるとデータ消失
- **ネイティブモジュール** — `better-sqlite3` はプラットフォーム依存のバイナリビルドが必要

---

## 方式比較

| 観点 | Vercel | Render | Railway | Docker + VPS |
|------|--------|--------|---------|-------------|
| **SQLite 互換性** | ❌ 不可（サーバーレス、read-only FS） | ⚠️ 制限あり（ディスク消失リスク） | ⚠️ 制限あり（Volume 必要） | ✅ 完全対応 |
| **永続ディスク** | ❌ なし | ⚠️ Persistent Disk（有料プラン） | ⚠️ Volume（有料プラン） | ✅ あり |
| **ネイティブモジュール** | ❌ Lambda 非対応 | ✅ Docker ベース | ✅ Docker / Nixpacks | ✅ 完全制御 |
| **cron 対応** | ⚠️ Vercel Cron（制限あり） | ✅ Cron Jobs | ✅ Cron | ✅ crontab / systemd |
| **env 管理** | ✅ Dashboard | ✅ Dashboard | ✅ Dashboard | ✅ .env / systemd env |
| **導入差分** | 大（DB 移行必須） | 中（Dockerfile 追加） | 中（Dockerfile 追加） | 小（Dockerfile or 直接） |
| **初回構築コスト** | 高（DB 設計変更） | 低〜中 | 低〜中 | 中（サーバー調達） |
| **月額目安** | $0〜20 + 外部 DB | $7〜25 | $5〜20 | $5〜20（VPS） |
| **ロールバック** | Git revert + redeploy | Git revert + redeploy | Git revert + redeploy | git pull + restart |
| **運用難易度** | 低（だが DB 移行が壁） | 中 | 中 | 中〜高 |

---

## 各方式の詳細評価

### ❌ Vercel — 不推奨

**除外理由:** SQLite (better-sqlite3) と根本的に非互換。

- Vercel Functions はサーバーレスで、ファイルシステムは一時的
- `better-sqlite3` の C++ ネイティブモジュールが Lambda 環境でビルド不可
- 採用するには **Postgres / Turso / PlanetScale 等への DB 移行が必須**
- DB 移行は全 repository / importer / admin / session に影響する大規模変更
- 「最小差分」の方針に反する

### ⚠️ Render — 条件付き可

**利点:** Docker ベースで SQLite 動作可能。Persistent Disk オプションあり。
**懸念:** 無料プランはディスク揮発。有料プラン（$7〜/月）で Persistent Disk を使えば安定。
**必要差分:** Dockerfile + render.yaml
**cron:** Render Cron Jobs で `run-imports.js` 実行可能

### ⚠️ Railway — 条件付き可

**利点:** Docker 対応、Volume マウント可能。
**懸念:** Volume は有料プランのみ。SQLite + Volume の運用実績は少ない。
**必要差分:** Dockerfile + railway.json (任意)
**cron:** Railway Cron で実行可能

### ✅ Docker + VPS — 推奨

**理由:** SQLite ファイルベース DB との相性が最も良い。

- 永続ディスク上で SQLite が自然に動作
- `better-sqlite3` のネイティブビルドも完全制御可能
- cron は OS の crontab でそのまま運用
- env は `.env` ファイルをサーバー上に配置するだけ
- ロールバックは `git pull` + `next build` + restart
- 月額 $5〜20 程度の VPS で十分（Hetzner / DigitalOcean / Vultr / Conoha 等）

---

## 推奨案: Docker + VPS

### なぜこの方式か

1. **SQLite 完全互換** — DB 移行不要、現行コードそのまま
2. **最小 repo 差分** — Dockerfile 1ファイル + α
3. **cron そのまま** — OS crontab で `run-imports.js` を直接実行
4. **env そのまま** — サーバー上の `.env` を dotenv で読み込み
5. **ネイティブモジュール対応** — Docker 内で `npm install` すればビルド可能
6. **運用実績が安定** — Node.js + SQLite + VPS は広く使われている構成

### 必要な repo 変更（次タスク）

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `Dockerfile` | Node.js + better-sqlite3 ビルド + Next.js standalone |
| 2 | `.dockerignore` | node_modules / .git / data/*.db 除外 |
| 3 | `docker-compose.yml`（任意） | ローカル検証用 |
| 4 | `web/next.config.mjs` | `output: "standalone"` 追加 |
| 5 | `docs/deploy-guide.md` | VPS デプロイ手順 |

### PaaS / サーバ側で必要な設定

| 設定 | 内容 |
|------|------|
| VPS 調達 | Ubuntu 22.04+ / 1GB+ RAM / 20GB+ Disk |
| Node.js | v20+ |
| Docker | Docker Engine |
| ドメイン | DNS 設定 + SSL (Let's Encrypt / Caddy) |
| `.env` | サーバー上に配置 |
| cron | `crontab -e` で `run-imports.js` 登録 |
| プロセス管理 | systemd / pm2 / Docker restart policy |

### デプロイフロー想定

```
1. git pull origin main
2. docker build -t sports-event-app .
3. docker stop sports-event-app
4. docker run -d --name sports-event-app \
     -v ./data:/app/web/data \
     -p 3000:3000 \
     --env-file .env \
     sports-event-app
5. curl http://localhost:3000 で疎通確認
```

Docker 不使用の場合:
```
1. git pull origin main
2. cd web && npm install && npx next build
3. pm2 restart sports-event-app
```

### source importer / cron の運用

```cron
# 毎日午前5時に全ドメイン source import
0 5 * * * cd /opt/sports-event-app/web && npm run imports:source >> /var/log/imports.log 2>&1
```

### ロールバック

```bash
git log --oneline -n 5          # 戻し先を確認
git revert HEAD                  # コミット取り消し
docker build && docker restart   # 再ビルド・再起動
```

---

## ユーザー確認事項

以下は開発者側では決められない、オーナー / 運用担当が確認すべき事項です。

| # | 確認事項 | 回答が必要な理由 |
|---|---------|---------------|
| 1 | VPS プロバイダ | Hetzner / DigitalOcean / Vultr / Conoha 等の選択 |
| 2 | 予算 | 月額 $5〜20 の VPS を確保可能か |
| 3 | ドメイン | 本番ドメイン名（`APP_BASE_URL` に設定する値） |
| 4 | SSL 方式 | Let's Encrypt / Caddy / Cloudflare 等 |
| 5 | Docker 利用有無 | Docker ベース or 直接 Node.js 実行か |
| 6 | バックアップ方針 | SQLite DB ファイルのバックアップ頻度・方法 |
| 7 | 監視 | ヘルスチェック / アラートの要否 |

---

## 次に必要な repo 変更（推奨案採用時）

1. **Dockerfile 作成** — Node.js 20 + better-sqlite3 ビルド + standalone output
2. **next.config.mjs に `output: "standalone"` 追加**
3. **.dockerignore 作成**
4. **docs/deploy-guide.md 作成** — VPS 向けデプロイ手順
5. **本番 `.env` テンプレート整備**（`.env.example` は済み）
6. **docker-compose.yml 作成**（任意、ローカル検証用）
7. **release-readiness.md にデプロイ方式の結論を追記**
