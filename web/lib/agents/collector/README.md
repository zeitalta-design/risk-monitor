# Collector Layer

外部ソースから**生レコード**を取得する役割。

## 契約

各 Collector モジュールは以下を export する：

```js
export default /** @type {import("../types.js").Collector} */ ({
  id: "nyusatsu.kkj",              // ドメイン.ソース
  domain: "nyusatsu",
  sourceLabel: "官公需情報ポータル（中小企業庁）",
  async collect({ dryRun = false, logger = console.log } = {}) {
    // 取得ロジック
    return /** @type {CollectorResult} */ ({
      id: "nyusatsu.kkj",
      domain: "nyusatsu",
      sourceLabel: "官公需情報ポータル（中小企業庁）",
      status: "ok",
      fetched, inserted, updated, skipped,
      elapsedMs,
    });
  },
});
```

## 禁止事項

- Collector 内で**ドメインをまたぐデータを触ってはいけない**（例: nyusatsu の collector が sanpai_items を読まない）
- UI/Presentation の整形ロジックを持ち込まない（それは Formatter の責務）
- Resolver 相当の名寄せをしない（同一企業を単にスキップする等は OK。統合しない）

## 現状の後方互換

当面、Collector は既存の `lib/{domain}-*-fetcher.js` を呼び出すだけの**薄いラッパー**として動く。既存 fetcher が DB 書込みまで行うため、Collector の戻り値には `inserted/updated/skipped` を含めている。

Formatter レイヤー実装時に Collector を「生レコード返却のみ」に切り替える予定（破壊的変更）。

## ディレクトリ構造

```
collector/
├── README.md               # 本ファイル
├── index.js                # 全 Collector の登録・列挙
└── {domain}/
    ├── index.js            # ドメイン内の Collector 一覧
    └── {source}.js         # 個別 Collector
```

## 一覧取得

```js
import { listCollectors } from "@/lib/agents/collector";
const cs = listCollectors({ domain: "nyusatsu" });
// [{ id: "nyusatsu.kkj", ... }, { id: "nyusatsu.central-ministries", ... }, ...]
```
