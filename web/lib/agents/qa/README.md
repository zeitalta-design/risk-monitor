# QA Layer — 【未実装・Stub】Phase 3 で着手

**責務**: 横断的監査。すべてのレイヤーを監視する。

## 監査項目（予定）

### データ矛盾検知
- `latest_penalty_date > today` のような未来日付混入（実測：2402-01-01 事件相当）
- `prefecture` が 47都道府県リストに含まれない値
- 法人番号の 13桁チェックディジット検証
- 同一 slug の論理重複（これは本来発生しないはずだがサニティチェック）

### 運用監査
- **DB容量モニタ**（Turso の用量、テーブルごとの件数推移）
- **Secrets ローテ推奨時期**（Turso トークン 6ヶ月、GitHub Secrets の lifespan）
- **sync_runs 履歴**（各 Collector の成功率・失敗連続回数）

### 情報源監査（既存）
- `scripts/audit-sources.mjs` をこの層に統合
- 週次で URL 生存確認・リンク切れ検知

## インターフェイス案

```js
export async function runQaCheck({ categories }) {
  // categories: ["data_consistency", "ops", "source_audit"]
  return {
    issues: [
      { severity: "high", layer: "collector", detail: "...", count: 3 },
      ...
    ]
  };
}
```

## 禁止事項

- 自動修正をしない（検知のみ。修正は人間または他レイヤーの責務）
- 他レイヤーの実装に依存せず、DB レベル・ファイルレベルで検証
- エラーを握り潰さず、必ず issue / Slack 等に通知
