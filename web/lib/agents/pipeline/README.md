# Pipeline Layer

Collector が取得した生レコードを Formatter で統一スキーマに変換し、DB に保存する配線層。

## 状態（Step 2.5 完了時点）

| Collector | Formatter | Pipeline 配線 | 状態 |
|-----------|-----------|--------------|------|
| `nyusatsu.kkj`                | ✅ | ✅ `runKkjPipeline` / `processKkjRecords` | 完了 |
| `nyusatsu.central-ministries` | ✅ | ✅ `processCentralMinistries`              | 完了 |
| `nyusatsu.p-portal-results`   | ✅ | ✅ `processPPortalResults`                 | 完了 |

**入札ドメインの全 fetcher は pipeline 経由に統一**。各 fetcher モジュール
（`lib/nyusatsu-*-fetcher.js`）は fetch + parse のみを担い、DB 書込みは
この pipeline 層が一元管理する。

## エクスポート

```js
import {
  // KKJ
  runKkjPipeline,               // 日付×LG反復 + DB upsert（cron/CLI 推奨）
  processKkjRecords,            // 生レコード配列 → DB upsert（小バッチ用）

  // 中央省庁6省庁
  processCentralMinistries,     // collectCentralMinistriesRaw の結果を受けて format+DB

  // 調達ポータル落札結果
  processPPortalResults,        // collectPPortalRaw の結果を受けて format+DB
} from "@/lib/agents/pipeline/nyusatsu";
```

## 標準呼び出しパターン（2段）

### KKJ
```js
// CLI: scripts/fetch-kkj.mjs
await runKkjPipeline({ mode: "daily", dryRun: false });
```
`runKkjPipeline` が内部で `fetchKkjSlice` (nyusatsu-kkj-fetcher.js) を
日付 × LG の2重ループで呼び、スライスごとに `processKkjRecords` を実行。

### 中央省庁
```js
// CLI: scripts/fetch-nyusatsu.mjs
const collected = await collectCentralMinistriesRaw();
const stats = processCentralMinistries(collected.perSource, { dryRun });
```

### 調達ポータル 落札結果
```js
// CLI: scripts/fetch-pportal-results.mjs
const collected = await collectPPortalRaw({ mode: "diff" });
const stats = processPPortalResults(collected.rawRecords, {
  sourceUrl: collected.url, dryRun,
});
```

## cron との関係

| cron workflow | 呼び出す CLI | 経路 |
|---------------|-------------|------|
| `fetch-kkj.yml`              | `scripts/fetch-kkj.mjs`              | → runKkjPipeline |
| `fetch-nyusatsu.yml`         | `scripts/fetch-nyusatsu.mjs`         | → processCentralMinistries |
| `fetch-pportal-results.yml`  | `scripts/fetch-pportal-results.mjs`  | → processPPortalResults |

workflow 側は無改変（CLI の引数互換性を保っているため）。

## 禁止事項

- fetcher モジュール（`lib/nyusatsu-*-fetcher.js`）で DB 書込みをしない
- pipeline を経由せずに nyusatsu_items / nyusatsu_results に upsert するコードを書かない
- Resolver 相当の名寄せはこの層でやらない
- ドメインをまたぐ処理はしない

## 次の段階（Step 3 Resolver）

- pipeline は現在 raw → DB upsert を直結しているが、Resolver 導入時は
  raw → Formatter → **Resolver（名寄せ）** → DB の順に挟まる
- 法人番号解決・表記ゆれ統合の canonical_id を付与してから保存
- その際、pipeline の `unified*ToItemRow` はほぼそのまま流用可能
