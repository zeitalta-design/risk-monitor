/**
 * Analyzer: 2年間のランキング比較（モメンタム / rank diff）
 *
 * 目的: 「去年→今年で誰が伸びたか / 落ちたか」を可視化する。
 *
 * ポリシー:
 *   - entity 軸のみ（issuer / cluster は将来）
 *   - fuzzy / LIKE / LLM 不使用
 *   - rank_diff = rank_prev - rank_current（正 = 上昇、負 = 下降）
 *   - 前年未出現（= new_entry）は rank_prev=null / rank_diff=null
 *     ソート時は末尾へ押しやる（明示的に扱いたい場合は client 側で new_entry=true でフィルタ）
 *   - 当年未出現（= dropout）は今回対象外（客観的には prev → current のつながりが無いため、
 *     「現在ランキング入りしている中での変動」に絞る）
 *
 * Phase H Step 1.5:
 *   - precomputed table (nyusatsu_entity_yearly_rank) が両年で利用可能なら、
 *     そちらから読むことで全表集計 2 本分（12〜20s）を回避する。
 *   - metric="count" のみ precomputed 経路を使い、それ以外（amount 等）と
 *     テーブル未整備時は従来 getAwardRanking ベースに fallback する。
 *   - 結果の並び順 / new_entry 判定 / sort ルールは両経路で同一。
 */

import { getAwardRanking } from "./ranking.js";
import { hasYearlyRankForYears, fetchYearlyEntityRanking } from "./yearly-rank.js";

// 内部 fetch サイズ。prev 側が外に外れて誤 new_entry 扱いになるのを減らすため、
// 出力 limit より大きめに取っておく。
const INTERNAL_MIN_LIMIT = 200;

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {number|string} opts.yearCurrent  YYYY
 * @param {number|string} opts.yearPrev     YYYY
 * @param {"count"|"amount"} [opts.metric="count"]
 * @param {number} [opts.limit=50]          出力件数（current 側に出ている上位を対象）
 * @returns {Array<{
 *   entity_id: number|null,
 *   name: string|null,
 *   rank_current: number,
 *   rank_prev: number|null,
 *   rank_diff: number|null,
 *   count_current: number,
 *   count_prev: number,
 *   amount_current: number,
 *   amount_prev: number,
 *   new_entry: boolean,
 * }>}
 */
export function fetchRankingDiff({ db, yearCurrent, yearPrev, metric = "count", limit = 50 } = {}) {
  if (!db) throw new TypeError("fetchRankingDiff: db is required");
  if (!yearCurrent || !yearPrev) throw new TypeError("fetchRankingDiff: yearCurrent / yearPrev required");
  const yc = String(yearCurrent), yp = String(yearPrev);
  if (!/^\d{4}$/.test(yc) || !/^\d{4}$/.test(yp)) {
    throw new TypeError("fetchRankingDiff: year must be YYYY");
  }

  const prevInternalLimit = Math.max(INTERNAL_MIN_LIMIT, limit * 4);

  // Phase H Step 1.5: precomputed table が使えるなら最優先で使う
  if (metric === "count" && hasYearlyRankForYears({ db, years: [yc, yp] })) {
    return _fromPrecomputed({ db, yc, yp, limit, prevInternalLimit });
  }

  return _fromLegacyAggregation({ db, yc, yp, metric, limit, prevInternalLimit });
}

// 従来経路: 2 年分を都度集計（冷 cache 時 12〜20s）
function _fromLegacyAggregation({ db, yc, yp, metric, limit, prevInternalLimit }) {
  const current = getAwardRanking({
    db, by: "entity", metric, limit,
    dateFrom: `${yc}-01-01`, dateTo: `${yc}-12-31`,
  });
  const prev = getAwardRanking({
    db, by: "entity", metric, limit: prevInternalLimit,
    dateFrom: `${yp}-01-01`, dateTo: `${yp}-12-31`,
  });

  const prevMap = new Map();
  prev.forEach((r, i) => {
    if (r.group_id != null) prevMap.set(r.group_id, { rank: i + 1, row: r });
  });

  const rows = current.map((r, i) => {
    const p = prevMap.get(r.group_id);
    const rank_current = i + 1;
    const rank_prev = p ? p.rank : null;
    const rank_diff = rank_prev != null ? rank_prev - rank_current : null;
    return {
      entity_id: r.group_id,
      name: r.group_name,
      rank_current,
      rank_prev,
      rank_diff,
      count_current: r.total_awards || 0,
      count_prev: p?.row?.total_awards || 0,
      amount_current: r.total_amount || 0,
      amount_prev: p?.row?.total_amount || 0,
      new_entry: rank_prev == null,
    };
  });

  return _sortRankDiff(rows);
}

// 高速経路: precomputed テーブルから読み取って diff 計算するだけ
function _fromPrecomputed({ db, yc, yp, limit, prevInternalLimit }) {
  const current = fetchYearlyEntityRanking({ db, year: yc, limit });
  const prev    = fetchYearlyEntityRanking({ db, year: yp, limit: prevInternalLimit });

  const prevMap = new Map();
  for (const r of prev) prevMap.set(r.entity_id, r);

  const rows = current.map((r) => {
    const p = prevMap.get(r.entity_id);
    const rank_current = r.rank;
    const rank_prev = p?.rank ?? null;
    const rank_diff = rank_prev != null ? rank_prev - rank_current : null;
    return {
      entity_id: r.entity_id,
      name: r.name,
      rank_current,
      rank_prev,
      rank_diff,
      count_current: r.count || 0,
      count_prev: p?.count || 0,
      amount_current: r.total_amount || 0,
      amount_prev: p?.total_amount || 0,
      new_entry: rank_prev == null,
    };
  });

  return _sortRankDiff(rows);
}

// ソート: rank_diff DESC（上昇を先）。null（new_entry）は末尾。同率なら rank_current ASC。
function _sortRankDiff(rows) {
  rows.sort((a, b) => {
    const aNull = a.rank_diff == null;
    const bNull = b.rank_diff == null;
    if (aNull && bNull) return a.rank_current - b.rank_current;
    if (aNull) return 1;
    if (bNull) return -1;
    if (a.rank_diff !== b.rank_diff) return b.rank_diff - a.rank_diff;
    return a.rank_current - b.rank_current;
  });
  return rows;
}
