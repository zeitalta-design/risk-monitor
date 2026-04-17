# Analyzer Layer — 【未実装・Stub】

**責務**: **Resolver 済みデータ**に対する集計・分析。UI への供給元。

## 前提

- 入力は Resolver 層で canonicalId が付与されたデータ
- Resolver 前の生レコードに対して集計を走らせてはいけない（禁止事項）
- 集計結果はキャッシュして良い（重い query の繰り返し回避）

## 予定される分析メニュー（入札ライン）

### A1 落札者分析ダッシュボード
- 落札者ランキング（件数順・金額順）
- 落札率の分布（価格帯別・業種別）
- 特定落札者の受注履歴タイムライン
- 発注機関 × 業種 の落札率マトリクス
- 法人番号ベースの名寄せ前提（Resolver 依存）

### 横展開用のメトリクス
- 行政処分の年次推移・都道府県別分布
- 補助金の採択率・業種別受給企業
- 産廃処理業者の処分頻度

## インターフェイス案

```js
/** Analyzer は "Query" クラス相当。純粋に読み取り専用 */
export async function getWinnerRanking({ period, limit = 50, sortBy = "count" }) { /* ... */ }
export async function getAwardRateDistribution({ category, period }) { /* ... */ }
```

## やること（次セッション以降）

1. 現 `repositories/nyusatsu.js` の集計系関数から抽出して移設
2. Resolver 依存の canonicalId 対応
3. ダッシュボード用 API エンドポイント新設（`/api/nyusatsu/analytics/...`）
4. キャッシュ戦略（Turso への集計テーブル or メモリキャッシュ）

## 禁止事項

- Resolver を通っていないデータで集計しない
- DB 書込みをしない（純粋 read-only）
- UI コンポーネント依存を持たない（Analyzer は UI を知らない）
