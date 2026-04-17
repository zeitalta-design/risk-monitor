# Formatter Layer — 【未実装・Stub】

**責務**: Collector が返した生レコードを**統一スキーマ JSON** に変換する。

## 入力
```js
/** @type {CollectorResult} */
{ id, domain, records: [/* raw source-specific shape */], ... }
```

## 出力（予定）
```js
/** @type {FormattedRecord[]} */
[
  {
    domain: "nyusatsu",
    sourceId: "kkj",
    externalId: "kkj-09100064104-20260414",
    title: "...",
    issuer: { name: "福島県田村市", prefecture: "福島県", city: "田村市" },
    company: { nameRaw: "有限会社三上工務店", corporateNumber: null },
    amount: null,
    dates: { announcement: "2026-04-20", deadline: null, contract: null },
    category: "service",
    biddingMethod: null,
    source: { name: "官公需情報ポータル（中小企業庁）", url: "https://www.kkj.go.jp/..." },
    raw: { /* source-specific fields, preserved for debugging */ },
  },
  ...
]
```

## やること（次セッション以降）

1. 統一スキーマの JSDoc 型定義（`FormattedNyusatsuRecord` etc）
2. 各 Collector に対応する Formatter モジュール
   - `nyusatsu/kkj.formatter.js` - KKJ の CSV 形式 → 統一形
   - `nyusatsu/central-ministries.formatter.js`
   - `nyusatsu/p-portal-results.formatter.js`（こちらは `nyusatsu_results` 用）
3. 日付正規化（令和X年Y月Z日 / YYYY年MM月DD日 / ISO8601 すべて ISO8601へ）
4. 都道府県正規化（都道府県市 → 都道府県 + 市区町村 分離、ルックアップ統一）
5. カテゴリ推定（construction / service / goods など統一コード）

## 禁止事項

- Collector の責務を侵食しない（HTTP fetch は Collector に任せる）
- Resolver の責務を侵食しない（会社名正規化は最小限、同一企業判定は Resolver の仕事）
- DB書込みをしない
