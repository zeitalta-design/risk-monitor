/**
 * Agents 共通型定義（JSDoc）
 *
 * このファイルは型宣言専用。ランタイム import されたときも副作用なし。
 */

/**
 * Collector が返す実行結果。
 *
 * @typedef {Object} CollectorResult
 * @property {string}                  id         - Collector 識別子（例: "nyusatsu.kkj"）
 * @property {string}                  domain     - ドメイン（例: "nyusatsu"）
 * @property {string}                  sourceLabel - 人間向けラベル
 * @property {"ok"|"error"}            status
 * @property {number}                  fetched    - 取得した生レコード数
 * @property {number}                  inserted   - 新規登録件数（旧 fetcher 委譲時の参考値）
 * @property {number}                  updated    - 既存更新件数
 * @property {number}                  skipped    - スキップ件数
 * @property {number}                  elapsedMs  - 所要ミリ秒
 * @property {string}                 [error]     - status=error 時のメッセージ
 * @property {Object}                 [extra]     - 各 Collector 固有のメタ情報
 */

/**
 * Collector 本体。モジュールが default または名前付きで export する。
 *
 * @typedef {Object} Collector
 * @property {string}                                   id
 * @property {string}                                   domain
 * @property {string}                                   sourceLabel
 * @property {function(CollectorOptions): Promise<CollectorResult>} collect
 */

/**
 * Collector 呼出しオプション（共通）。各 Collector は独自オプションを
 * 追加してよいが、以下は常に尊重すること。
 *
 * @typedef {Object} CollectorOptions
 * @property {boolean}  [dryRun]  - DB 書込みをスキップ
 * @property {Function} [logger]  - console.log 互換。既定は console.log
 */

export {};
