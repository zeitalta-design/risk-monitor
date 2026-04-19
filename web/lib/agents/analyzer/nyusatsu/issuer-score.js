/**
 * Analyzer: Issuer Affinity Score（Phase H Step 5）
 *
 * 目的: 「この entity が特定 issuer key に対して過去どれだけ受注実績を持つか」を
 *       0〜100 で表現する。Deal Score の 4 本目の component として使う。
 *
 * ポリシー:
 *   - issuer 正規化は未完のため、issuer_key の決定は
 *     issuer_dept_hint（deterministic 抽出値）→ issuer_code（元CSV コード）の順で、
 *     完全一致のみ。fuzzy / LIKE / LLM は使わない。
 *   - 識別不能な issuer（両方 NULL）は本関数の対象外。呼び出し側で中立 50 扱いにする。
 *   - 参照テーブルは nyusatsu_entity_issuer_counts（rebuild script で precomputed）。
 *     テーブル未作成・読み取り失敗は「データなし」扱いで score 0 を返す
 *     （Deal Score 側が全体中立か個別低評価かを判断）。
 *
 * 合成式:
 *   score = 0.5 * issuer_count_strength + 0.3 * issuer_recency + 0.2 * issuer_share
 */

const WEIGHTS = {
  issuer_count_strength: 0.5,
  issuer_recency:        0.3,
  issuer_share:          0.2,
};

function clamp100(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

// 件数段階
function scoreCountStrength(count) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count >= 10) return 100;
  if (count >=  5) return 70;
  if (count >=  3) return 55;
  if (count >=  1) return 40;
  return 0;
}

// 最終受注年からの距離。yearCurrent との差で判定。
function scoreRecency(lastYear, yearCurrent) {
  if (!lastYear) return 0;
  const cur = Number(yearCurrent);
  const last = Number(lastYear);
  if (!Number.isFinite(cur) || !Number.isFinite(last)) return 0;
  const gap = cur - last;
  if (gap <= 1) return 100; // 今年 or 前年
  if (gap <= 3) return 70;
  if (gap <= 5) return 40;
  return 20;
}

// entity の全受注に占めるこの issuer の割合（0..1）
function scoreShare(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 0.20) return 100;
  if (ratio >= 0.10) return 70;
  if (ratio >= 0.05) return 50;
  if (ratio >= 0.01) return 30;
  return 20; // 0 < ratio < 0.01（形式上ゼロではない）
}

function labelFor(score) {
  if (score >= 80) return "強い相性";
  if (score >= 60) return "相性あり";
  if (score >= 40) return "弱い相性";
  return "実績薄い";
}

function defaultYear() {
  // issuer_recency の基準。deal-score 側から yearCurrent を渡される想定だが、
  // 単体利用時は当年（現実の今）を使う。
  return String(new Date().getFullYear());
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.entityId
 * @param {string} opts.issuerKey
 * @param {"dept_hint"|"code"} [opts.issuerKeyType]  未指定なら dept_hint を優先して探索
 * @param {string|number} [opts.yearCurrent]         未指定なら当年
 * @returns {null | {
 *   score: number, label: string,
 *   components: { issuer_count_strength:number, issuer_recency:number, issuer_share:number },
 *   inputs: { count:number, last_awarded_year:string|null, share_ratio:number },
 *   issuer: { key:string, type:"dept_hint"|"code"|"unknown" },
 *   weights: typeof WEIGHTS,
 * }}
 */
export function computeIssuerAffinityScore({ db, entityId, issuerKey, issuerKeyType, yearCurrent } = {}) {
  if (!db) throw new TypeError("computeIssuerAffinityScore: db is required");
  if (!entityId) throw new TypeError("computeIssuerAffinityScore: entityId is required");
  if (!issuerKey) return null; // issuer 識別不能 → 呼び出し側で中立扱い

  const yc = String(yearCurrent ?? defaultYear());

  let row = null;
  try {
    if (issuerKeyType) {
      row = db.prepare(`
        SELECT count, last_awarded_year, share_ratio, issuer_key_type AS type
        FROM nyusatsu_entity_issuer_counts
        WHERE entity_id = @e AND issuer_key = @k AND issuer_key_type = @t
        LIMIT 1
      `).get({ e: entityId, k: String(issuerKey), t: issuerKeyType });
    } else {
      // type 未指定: dept_hint を優先、なければ code
      row = db.prepare(`
        SELECT count, last_awarded_year, share_ratio, issuer_key_type AS type
        FROM nyusatsu_entity_issuer_counts
        WHERE entity_id = @e AND issuer_key = @k
        ORDER BY CASE issuer_key_type WHEN 'dept_hint' THEN 0 ELSE 1 END
        LIMIT 1
      `).get({ e: entityId, k: String(issuerKey) });
    }
  } catch {
    // テーブル未作成 / 読み取り失敗 → 実績なし扱いで 0
    row = null;
  }

  if (!row) {
    return {
      score: 0,
      label: labelFor(0),
      components: { issuer_count_strength: 0, issuer_recency: 0, issuer_share: 0 },
      inputs: { count: 0, last_awarded_year: null, share_ratio: 0 },
      issuer: { key: String(issuerKey), type: issuerKeyType || "unknown" },
      weights: { ...WEIGHTS },
    };
  }

  const issuer_count_strength = scoreCountStrength(row.count);
  const issuer_recency        = scoreRecency(row.last_awarded_year, yc);
  const issuer_share          = scoreShare(row.share_ratio);

  const score = clamp100(
    issuer_count_strength * WEIGHTS.issuer_count_strength +
    issuer_recency        * WEIGHTS.issuer_recency +
    issuer_share          * WEIGHTS.issuer_share
  );

  return {
    score,
    label: labelFor(score),
    components: { issuer_count_strength, issuer_recency, issuer_share },
    inputs: {
      count:             row.count || 0,
      last_awarded_year: row.last_awarded_year || null,
      share_ratio:       Number.isFinite(row.share_ratio) ? row.share_ratio : 0,
    },
    issuer: { key: String(issuerKey), type: row.type || issuerKeyType || "unknown" },
    weights: { ...WEIGHTS },
  };
}

export { WEIGHTS as ISSUER_SCORE_WEIGHTS };
