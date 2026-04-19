/**
 * 入札 issuer 解決の補助ユーティリティ。
 *
 * 方針:
 *   - 元CSVの「発注機関コード」を正として `issuer_code` に保持
 *   - title 先頭の 【...】 から deterministic に「発注機関ヒント」を抽出
 *   - fuzzy / LIKE / LLM による推定は一切行わない
 *   - code → name の 1:1 マッピング（例: "8002010" → "○○省"）も禁止
 *     （上位コードは複数省庁混在のため意味論的に誤記載になる）
 *
 * 抽出できない行には hint を入れない（NULL のまま）。hint は「正式機関名」では
 * なく「ヒント」であることを UI 側でも明示する。
 */

// 先頭 【...】 に出るが明らかに発注機関名ではないプロセス/カテゴリマーカー。
// 実データ（nyusatsu_results / nyusatsu_items）の上位で確認したもののみ登録。
// LIKE や類義語展開はしない — 完全一致（set lookup）のみ。
// 新しいマーカーが見つかったら追加する運用。
const NON_AGENCY_PREFIX_MARKERS = new Set([
  // procurement 方式 / 形態
  "電子可", "電子入札", "郵送入札", "税込入札",
  "電子入札システム対応", "入札公告（電子入札）",
  // 告示系 / 公告ライフサイクル
  "公告", "公告文", "告示", "入札公告", "入札公告の取消", "再度公告",
  "入札関係", "政府調達", "企業局入札公告",
  // 業種/種別ラベル
  "建設工事", "公募型プロポーザル", "公募型プロポーザル情報",
  // 状態 / 結果
  "終了しました", "選定結果",
  // 粒度不足（機関として曖昧）
  "本省", "新規", "全国団体向け", "一般",
]);

/**
 * title 先頭の 【...】 から機関ヒントを抽出する。
 *
 * ルール:
 *   - 先頭が 【 で始まり 】 で閉じる場合のみ対象
 *   - 途中の 【...】 は対象外
 *   - 中身が 、or , で区切られていれば先頭要素のみ
 *   - trim する
 *   - 100 文字超は異常値として NULL
 *   - NON_AGENCY_PREFIX_MARKERS に含まれる値は NULL（誤表示防止）
 *
 * @param {string|null|undefined} title
 * @returns {string|null}
 */
export function extractIssuerDeptHint(title) {
  if (!title || typeof title !== "string") return null;
  if (!title.startsWith("【")) return null;
  const end = title.indexOf("】");
  if (end <= 1) return null;

  const raw = title.slice(1, end).trim();
  if (!raw) return null;

  const first = raw.split(/[、,]/)[0]?.trim();
  if (!first) return null;
  if (first.length > 100) return null;
  if (NON_AGENCY_PREFIX_MARKERS.has(first)) return null;

  return first;
}

// hint の生成元。source 列に保存しておくと、将来のソース拡張・再計算の判断材料になる。
export const ISSUER_HINT_SOURCE_TITLE_BRACKET = "title_bracket_prefix";

/**
 * Phase H Step 5: 案件 1 行から issuer_key と issuer_key_type を決める。
 *
 * 優先順位:
 *   1. issuer_dept_hint（title の 【...】 から deterministic 抽出済、信頼度高）
 *   2. issuer_code（元CSV のコード、意味は粗いが完全一致は可能）
 *   3. どちらも無効 → null（呼び出し側で中立扱い）
 *
 * fuzzy / LIKE / LLM は一切使わない。識別不能な案件に無理に issuer を当てない。
 *
 * @param {{ issuer_dept_hint?: string|null, issuer_code?: string|null }} row
 * @returns {{ key: string, type: "dept_hint"|"code" } | null}
 */
export function resolveIssuerKey(row) {
  if (!row) return null;
  const hint = row.issuer_dept_hint != null ? String(row.issuer_dept_hint).trim() : "";
  if (hint) return { key: hint, type: "dept_hint" };
  const code = row.issuer_code != null ? String(row.issuer_code).trim() : "";
  if (code) return { key: code, type: "code" };
  return null;
}

export const ISSUER_KEY_TYPE_DEPT_HINT = "dept_hint";
export const ISSUER_KEY_TYPE_CODE      = "code";
