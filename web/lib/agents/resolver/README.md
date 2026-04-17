# Resolver Layer — 【未実装・Stub】最重要

**責務**: 同一企業・団体を束ねる名寄せ。**Analyzer の前に必ず通す**。

## 核となる問い

「`株式会社A工業` と `㈱A工業` と `A工業(株)` は同じ会社か？」
「`リバーサイド建設` と `リバーサイド建設株式会社` は？」
「宛名違いの同一許可番号は？」

## 戦略（優先度順）

1. **法人番号（13桁）一致**が最強のキー。有れば最優先で束ねる
   - KKJ データには許可番号があるが法人番号ではない（11桁、都道府県プレフィックス入り）
   - gBizINFO API で企業名 → 法人番号解決が可能。定期バッチで補完
2. **許可番号の prefix 考慮一致**（産廃・建設業）— 同一都道府県発行の同一番号
3. **正規化した名称の完全一致**
   - 会社形態マーク除去: `㈱` `㈲` `㊒` → `株式会社` `有限会社` `合名会社`
   - 全半角統一、スペース除去
4. **編集距離＋属性スコア**（fuzzy）— 上記でマッチしないもの向け
   - LLM を限定的に使ってよい領域（Resolver 層での LLM 利用は許可済み）

## 出力形式（予定）

```js
/** @type {ResolvedEntity} */
{
  canonicalId: "ent_abc123",        // 名寄せ後の統合ID
  primaryName: "A工業株式会社",
  corporateNumber: "1234567890123" | null,
  aliases: ["㈱A工業", "A工業(株)", ...],
  sources: ["nyusatsu_items#42", "sanpai_items#108", ...],
}
```

## やること（次セッション以降）

1. スキーマ設計（`resolved_entities` テーブル候補）
2. 名称正規化関数（`normalizeCompanyName`）を共通ライブラリへ
3. gBizINFO 名前→法人番号解決バッチ
4. 既存 `company-name-validator.js` の取込み
5. 同一性判定ルール整備（編集距離閾値、属性重み、最後の砦として LLM 判定）
6. Analyzer/UI 用の参照 API（`resolveCompany(name, prefecture?)` → canonicalId）

## 禁止事項

- Formatter の統一 JSON を経由せずに直接生レコードを触らない
- Analyzer レイヤーに Resolver を迂回させない（Resolver 前の集計は禁止）
