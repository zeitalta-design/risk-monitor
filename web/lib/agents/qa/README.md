# QA Layer — 最小実装（Phase 3）

入札ラインの異常を**早期検知**するための監査層。
同じ構造は補助金など他ドメインへコピーして再利用する前提で設計。

## データ

| テーブル | 役割 |
|---------|------|
| `qa_snapshots` | 日次メトリクス値（件数系）の履歴。UNIQUE(captured_on, metric) |
| `qa_findings`  | 検知された問題（severity × category × message + optional detail） |

## チェック一覧

| ID | 関数 | 対象 |
|----|------|------|
| count snapshots | `captureCountSnapshots` | nyusatsu_items / nyusatsu_results / resolved_entities / entity_clusters / resolution_aliases の件数 |
| freshness       | `checkFreshness`        | sync_runs の最終実行時刻が古すぎないか（既定 30h） |
| delta           | `checkDelta`            | 前日比 ±30% 警告 / ±50% critical（かつ絶対差が 10 以上） |
| resolver-growth | `checkResolverGrowth`   | resolved_entities / entity_clusters / resolution_aliases の増分（delta のより厳しい版） |
| api-health      | `checkApiHealth`        | `getAwardRanking` / `getAwardTimeline` が空を返していないか |
| capacity        | `checkCapacity`         | テーブル行数。50万 warn / 200万 critical |

## 重要度ラベル

- `info`     : 参考情報
- `warn`     : 注意。運用ログで追えばよい
- `critical` : 検知即日の対応が望ましい

## 使い方

### 単発チェック
```js
import { createQaStore, captureCountSnapshots, checkDelta, todayJst }
  from "@/lib/agents/qa";

const store = createQaStore(db);
const day = todayJst();
captureCountSnapshots({ db, store, day });
checkDelta({ store, day });
```

### 一括実行
```js
import { runAllChecks } from "@/lib/agents/qa";
import * as analyzer from "@/lib/agents/analyzer/nyusatsu";

const result = await runAllChecks({ db, analyzer });
// result.findings に当日分の finding 一覧
```

CLI: `node scripts/qa-snapshot.mjs [--local]`

## 他ドメインへの展開（補助金等）

1. `NYUSATSU_COUNT_METRICS` と同形式で `HOJOKIN_COUNT_METRICS` を定義
2. `runAllChecks` に `metrics` パラメータを渡すか、domain 専用の runner を追加
3. `checkFreshness` の domains に `hojokin` を追加

`checks.js` 内はドメインをハードコードせず配列駆動にしてあるので、コピー＆切り替えで動く。

## 禁止事項

- 自動修正しない（検知のみ）
- 検知結果を他層にフィードバックしない（Resolver や pipeline の動作を QA が変えない）
- Tool 外部通信（Slack/Webhook 等）は未実装。cron の alert に任せる
