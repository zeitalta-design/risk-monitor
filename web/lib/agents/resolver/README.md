# Resolver Layer — 最小実装（Phase 1 Step 3）

Formatter で統一された生データから、**同一企業を 1 つの canonical entity に束ねる**層。

## 4 層判定（Layer 1-3 実装済、Layer 4 は未実装）

| 層 | 方式 | 実装 |
|----|------|------|
| 1 | 法人番号一致（入力側 or gBizINFO 経由） | ✅ resolve.js + gbizinfo.js（stub） |
| 2 | normalized_key 完全一致 | ✅ normalize.js |
| 3 | normalized_key の fuzzy 一致（Levenshtein） | ✅ resolve.js（既定閾値 0.90） |
| 4 | LLM 判定（キャッシュ前提） | ⏳ 未実装。Layer 3 で拾えない曖昧ケース用 |

## データ構造

3 テーブル（`scripts/migrate-resolved-entities.mjs` で作成）:

| テーブル | 役割 |
|---------|------|
| `resolved_entities`   | canonical entity 本体（id, corporate_number, canonical_name, normalized_key, prefecture, source） |
| `resolution_aliases`  | 表記ゆれ蓄積（raw_name → entity_id、seen_count 付き） |
| `resolution_scores`   | 判定ログ（監査・再実行安定性の確認） |

## 使い方

```js
import { resolveEntity, createDataStore } from "@/lib/agents/resolver";

const store = createDataStore();      // 同一プロセスで共有するとキャッシュが効く
const r = await resolveEntity(
  { name: "株式会社アサオ", prefecture: "兵庫県", corporateNumber: "02805143475" },
  { store, fuzzyThreshold: 0.90 }
);
// → { entityId: 42, canonicalName: "(株)アサオ", layer: "corp_number", score: 1.0, created: false }
```

## 正規化ポリシー（normalize.js）

```
株式会社アサオ   ─┐
㈱アサオ         ├─ normalizeCompanyKey() → "アサオ"
(株)アサオ       │
アサオ㈱         ─┘

canonicalizeCompanyName() → "(株)アサオ" （表示用）
```

具体的には:
- NFKC で全半角統一
- 会社形態語（株式会社/有限会社/合同会社/合資会社/合名会社/一般社団法人等）を除去
- 英字小文字化
- 空白・装飾記号・ハイフン類を全削除

## 実装ルール

- Resolver 本体は「純関数＋DataStore 抽象」で構成。判定ロジックは純粋
- gBizINFO 呼び出しは `useGbizinfo: true` 明示時のみ（デフォルトは叩かない）
- in-memory cache は `createDataStore()` 内で管理（prefix 単位）
- 全ての判定は `resolution_scores` にログ保存（再実行の安定性検証）

## 再実行時の挙動（成功条件「再実行で結果が安定する」）

1. 初回: 新規 entity 作成（layer=new）
2. 2 回目以降の同一 raw name: layer=normalized（既存 entity へマージ）
3. 類似度 >= 閾値の変種: layer=fuzzy（既存 entity にマージ、alias 蓄積）
4. 法人番号が渡された場合: layer=corp_number で確定（以降のすべての変種を束ねる）

## クラスタリング（Step 3.5 / 3.6）

entity よりさらに上位の概念として **cluster_id**（グループ／類似企業の束）を
付与する。entity_id は「同一法人」、cluster_id は「同一グループや名称類似企業群」。

```
例: トヨタレンタリース 大分/熊本/兵庫/福岡 → 同一 cluster（prefix シグナル）
```

### Step 3.6 精度改善 — ストップワード＋安全弁

#### ストップワード（判定前に除去）

```
HARD_STOPS: 日本 / ジャパン / japan   （全位置から削除）
SOFT_STOPS: サービス / 建設 / 工業    （末尾でのみ削除）
```

これにより「日本〇〇系」「〇〇サービス系」の汎用語起因の偽陽性を抑える。
トヨタ・ニッポン（固有ブランド）・ニチダン等は stoplist に含めないので保持される。

#### 判定条件（OR ではなく AND 強化）

- **(a) prefix 主体**: stripped key で `prefixLen`(既定 4) 文字以上共通 → 許可
- **(b) similarity 安全弁**: stripped key の similarity ≥ `simThreshold`(既定 0.8) **かつ** 共通 prefix ≥ 1 文字 → 許可
- **prefix 0 の場合は禁止**（類似度がいくら高くても不可）

precision 最優先、recall は多少犠牲にする方針。

### 実装

| | 中身 |
|---|---|
| データ | `entity_clusters` テーブル、`resolved_entities.cluster_id` 列 |
| 判定 | `stripForCluster(normalized_key)` → prefix ≥ 4 or (similarity ≥ 0.8 & prefix ≥ 1) |
| アルゴリズム | stripped key 先頭2文字バケット + union-find |
| 冪等性 | 再実行で `entity_clusters` を作り直す（同じ結果を保証） |
| 単独 entity | cluster_id = NULL（2 件以上のグループのみ cluster 作成） |

### 使い方

```js
import { assignClusters, stripForCluster } from "@/lib/agents/resolver";
const r = assignClusters({ db, prefixLen: 4, simThreshold: 0.8 });
// → { entities, clusters, assigned, singletons, largestCluster }
```

CLI: `node scripts/cluster-entities.mjs [--local] [--prefix 4] [--sim 0.8]`

### 実測（local 965 entities）

| 指標 | Step 3.5 | **Step 3.6** |
|------|---------|---|
| clusters | 16 | **13** |
| assigned | 38 | **31** |
| singletons | 927 | **934** |
| largestCluster | 4 | **4** |
| 日本〇〇サービス 偽陽性 | あり | **消滅** |
| トヨタ/ニッポン レンタリース | 保持 | **保持** |

### LLM（Layer 4）

- 曖昧ケースのみ / entity 判定ではなく **cluster 判定に使用**
- 現状 stub。Layer 3 で類似度 0.6-0.7 の曖昧ゾーンに入った候補を
  LLM でリクエスト → 結果をキャッシュ、という設計を予定

## 禁止事項

- Analyzer で Resolver を経由しないクエリを書かない
- Formatter や Collector のスキーマを壊さない
- LLM を fallback 層以外で使用しない
- cluster 判定で entity 判定を壊さない（entity_id は cluster より優先）
