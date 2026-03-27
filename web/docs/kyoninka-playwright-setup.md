# kyoninka Playwright 導入手順

## 前提
- Node.js v20+
- npm / npx が利用可能
- ディスク空き: ~500MB（Chromium バイナリ）

## インストール手順

```bash
cd D:\ClaudeProjects\data-platform\sports-event-app\web

# 1. Playwright パッケージをインストール
npm install playwright

# 2. Chromium ブラウザをインストール
npx playwright install chromium

# 3. 動作確認
node scripts/kyoninka-playwright-poc.js --check
```

## PoC 実行

```bash
# 東京都(13)で建設業者検索
node scripts/kyoninka-playwright-poc.js

# 大阪府(27)で検索
node scripts/kyoninka-playwright-poc.js --ken 27
```

## 期待される動作
1. ヘッドレスChromium起動
2. etsuran2.mlit.go.jp にアクセス
3. 都道府県コードを選択
4. 検索送信
5. 結果HTML取得
6. テーブルから事業者情報をパース
7. kyoninka_entities に最小登録

## Blocker（現在）
- `npm install playwright` が未実行
- Chromium バイナリが未ダウンロード
- CI/CD環境では headless Chrome の追加設定が必要な場合がある

## 次回着手条件
- Playwright インストール完了
- `--check` が成功
- PoC で1件以上の事業者データ取得

## 代替運用（Playwright 未導入時）
1. fallback（サンプルデータ）で運用継続
2. 手動CSV/JSON取り込み（`run-sync.js kyoninka` 経由）
3. 都道府県の建設業許可者名簿（HTMLベース）を代替ソースに
