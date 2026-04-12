# Risk Monitor リリースチェックリスト

公開前に確認・対応が必要な項目をまとめたチェックリストです。

---

## 1. 環境変数・設定

- [ ] `APP_BASE_URL` を本番ドメインに設定（`https://taikainavi.com`）
- [ ] `NEXT_PUBLIC_GA_ID` を GA4 Measurement ID に設定（`G-XXXXXXXXXX`）
- [ ] `MAIL_FROM` を本番メールアドレスに設定
- [ ] `SESSION_SECRET` を安全なランダム値に設定
- [ ] `DATABASE_PATH` を本番DBパスに設定
- [ ] SMTPメール送信設定（`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`）

## 2. プレースホルダーの差し替え

- [ ] `contact@example.com` を実際の問い合わせ先メールに差し替え
  - `app/contact/page.js`
  - `app/about-data/page.js`
  - `app/privacy/page.js`
- [ ] PWA用アイコン画像を作成・設定（192x192, 512x512）
  - `app/manifest.js` の icons 配列に追加
- [ ] ファビコン最終版に差し替え（必要に応じて `app/icon.svg` を更新）

## 3. データベース

- [ ] 本番用DBファイルを準備（最新スクレイピングデータ投入済み）
- [ ] 必要なインデックスが作成されていること確認
- [ ] 管理者ユーザーを作成

## 4. SEO・OGP

- [ ] `APP_BASE_URL` が正しいことを確認（canonical, sitemap, OGPに影響）
- [ ] `robots.js` が本番ドメインの sitemap URL を正しく出力することを確認
- [ ] `sitemap.js` が全公開ページを網羅していることを確認（現在165+ URLs）
- [ ] 各ページの `<title>` が一意で適切であることを確認
- [ ] noindex対象ページ（login, signup, favorites, saved-searches, notifications, notification-settings, admin, contact）が正しく設定されていること
- [ ] OGP画像が各ページで正しく表示されることを確認
  - トップページ: `opengraph-image.js` で自動生成
  - 詳細ページ: `marathon/[id]/opengraph-image.js` で大会名入り画像生成
- [ ] Twitter Card が正しく表示されることを確認
- [ ] JSON-LD構造化データの確認（BreadcrumbList, SportsEvent）
- [ ] Google Search Console にサイト登録・所有権確認
- [ ] Google Search Console でサイトマップ送信

## 5. セキュリティ

- [ ] HTTPS 強制（リダイレクト設定）
- [ ] Cookie の `secure` フラグが本番で有効になること確認
- [ ] CSRF対策の確認
- [ ] レートリミットの設定（認証エンドポイント）
- [ ] 管理画面（`/admin/*`）のアクセス制御確認

## 6. メール

- [ ] SMTP接続テスト（実際にメール送信できることを確認）
- [ ] 締切通知メールの文面・リンク確認
- [ ] メール配信停止リンクの動作確認
- [ ] 送信元アドレスのSPF/DKIM設定

## 7. スクレイピング・バッチ

- [ ] `scripts/run-daily-jobs.js` のcron設定
- [ ] `scripts/generate-email-jobs.js` の定期実行設定
- [ ] `scripts/send-emails.js` の定期実行設定
- [ ] スクレイピング対象サイトの利用規約再確認

## 8. 表示・UI

- [ ] トップページの表示確認（PC / スマホ）
- [ ] マラソン一覧ページの検索・フィルタ動作確認
- [ ] 大会詳細ページの表示・外部リンク確認
- [ ] SEOページ（都道府県別/距離別/月別）の表示確認
- [ ] お気に入り・保存検索・通知の動作確認
- [ ] 新規登録→ログイン→ログアウトのフロー確認
- [ ] 404ページの表示確認
- [ ] フッターの全リンク動作確認

## 9. 計測・解析

- [ ] `NEXT_PUBLIC_GA_ID` が設定され、GA4でページビュー取得を確認
- [ ] 外部リンククリック計測の確認（RUNNET, moshicom, 公式サイト）
- [ ] お気に入り追加/削除の計測確認
- [ ] 人気条件チップクリックの計測確認
- [ ] GA4リアルタイムレポートで動作確認

## 10. パフォーマンス

- [ ] Lighthouse スコア確認（Performance, Accessibility, SEO）
- [ ] 画像最適化（必要に応じて next/image 使用）
- [ ] 初回ロード時間の確認

## 11. 法務

- [ ] 利用規約の内容最終確認
- [ ] プライバシーポリシーの内容最終確認（GA4利用の記載追加）
- [ ] 「データについて」ページの内容最終確認
- [ ] 出典表記が全ページで正しく表示されていること

## 12. 監視・運用

- [ ] エラー監視の設定（Sentry等）
- [ ] GA4でイベント計測ダッシュボード作成
- [ ] バックアップ体制の構築（DB定期バックアップ）
- [ ] 障害時の連絡体制

---

## リリース手順

1. 本番サーバーに最新コードをデプロイ
2. 環境変数を設定（APP_BASE_URL, GA_ID, SMTP等）
3. `npm run build` でビルド
4. `npm start` で起動確認
5. 上記チェックリストの最終確認
6. DNS設定（ドメイン → サーバーIP）
7. SSL証明書設定
8. `/robots.txt` `/sitemap.xml` のレスポンス確認
9. Google Search Console でサイトマップ送信
10. GA4リアルタイムレポートで計測動作確認

---

## 公開日当日の確認

- [ ] トップページが正常に表示される
- [ ] `/sitemap.xml` が正しいURLで出力される
- [ ] OGP画像がSNSプレビューで表示される（Twitter Card Validator等で確認）
- [ ] GA4でページビューが記録されている
- [ ] 外部リンククリックがGA4で記録されている
- [ ] メール送信が正常に動作する
