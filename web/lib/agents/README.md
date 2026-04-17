# Agents — パイプライン型 AI 組織

リスクモニターのデータ処理を責務ごとに分離したパイプライン。

## レイヤー

```
Collector → Formatter → Resolver → Analyzer → UI
                                       ↑
                                      QA（横断監査）
```

| 層 | ディレクトリ | 責務 | 例 |
|----|-------------|------|-----|
| **Collector** | `collector/` | 外部ソースから**生レコード**を取得する。パース最低限、DB操作なし（当面は後方互換で fetcher 内の upsert に依存） | KKJ CSV DL / 省庁HTML scrape |
| **Formatter** | `formatter/` | 生レコードを**統一スキーマ JSON** に変換。日付／都道府県／カテゴリ正規化 | `2026(令和8)年4月1日` → `2026-04-01` |
| **Resolver** | `resolver/` | **同一企業を束ねる**。法人番号ベース名寄せ、表記ゆれ統合、DB横断 dedup | `㈱A工業` と `株式会社A工業` を同一視 |
| **Analyzer** | `analyzer/` | Resolve 済みデータに対する集計・分析。Resolver を通らないデータで Analyzer を動かすのは禁止 | 落札者ランキング／落札率分布 |
| **UI** | `app/`, `components/` | Analyzer 出力を人間向けに表示。データ層が確定するまで UI 先行開発は禁止 | `/nyusatsu/results` |
| **QA** | `qa/` | 横断的監査。データ矛盾検知・DB容量モニタ・Secretsローテ等 | 不整合件数のアラート |

## 原則（2026-04-17 確定）

1. **1エージェント1責務**。複数工程を1モジュールに混在させない
2. **パイプライン順序を逆流させない**（Resolver 前の Analyzer 禁止）
3. **並列実行前提**。Collector は互いに独立。Formatter も同じく並列可
4. **ログ必須**。各レイヤーは `{id, elapsed, counts, errors}` を返す
5. **リトライ前提設計**。外部取得失敗は catch してスキップ、pipeline 全体を止めない
6. **他カテゴリへコピー可能な構造**。入札ラインが固まったら `collector/hojokin/` 等をテンプレから複製する

## 現状（2026-04-17 Step 2.5 完了時点）

- **Collector**: 入札ライン（KKJ / 6省庁 / 調達ポータル落札結果）完全登録。各 Collector は pipeline 経由で動作
- **Formatter**: 3ソース分の統一スキーマ変換実装済
- **Pipeline**: 3ソースすべて配線完了。cron 経路も pipeline に統一済
- **fetcher モジュール**: fetch+parse のみに特化。DB 書込みコードは完全削除
- **Resolver / Analyzer / QA**: stub README のみ。次ステップで段階実装

## 参照

- [`project_ai_organization_vision.md`](../../../../.claude/... ) (auto-memory) に全体方針の由来あり
- 既存 fetcher は `lib/{domain}-fetcher.js`。Collector はこれを wrap しているだけ（現時点）
