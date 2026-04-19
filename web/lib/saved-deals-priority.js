/**
 * Saved Deals 優先度算出（Phase J-18）
 *
 * `/saved-deals` 一覧の「今見るべき順」を決める軽量ルール。DB スキーマは足さず、
 * saved_deals.is_pinned + nyusatsu_items の status / deadline / budget_amount だけで
 * 内部 priority_score と表示用 label / reasons を決める。
 *
 * 設計方針:
 *   - 事実ベースのみ。LLM や機械学習は使わない。
 *   - pin は絶対優先（PIN_BONUS = 10000）。pin した案件が priority で下に落ちない。
 *   - reasons は 2 個まで（情報過多防止）。無ければ空配列。
 *   - analyzer の deal_score は entity 依存で一覧ページには相性が悪いので今回は使わない。
 *     将来 entity context が確定したら加点項目として追加可能。
 *
 * 公開関数:
 *   - computeSavedDealPriority(row, { todayYmd })
 *   - sortSavedDealsByPriority(rows)  （破壊的ソート）
 *   - jstToday()
 */

const PIN_BONUS = 10000;

/** JST 今日の YYYY-MM-DD */
export function jstToday(now = new Date()) {
  const JST_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const jstDayStart = Math.floor((now.getTime() + JST_MS) / DAY_MS) * DAY_MS;
  const d = new Date(jstDayStart);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function daysBetweenYmd(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return null;
  const parse = (s) => {
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  };
  const a = parse(fromYmd), b = parse(toYmd);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * 1 件分の priority を計算して付与用フィールドを返す。
 *
 * 入力 row が持っているべきフィールド:
 *   - is_pinned (0/1)
 *   - status ('open' | 'closed' | 'upcoming' | null)
 *   - deadline (YYYY-MM-DD | null)
 *   - budget_amount (number | null)
 *
 * @param {object} row
 * @param {{ todayYmd?: string }} [opts]
 * @returns {{ priority_score: number, priority_label: "高"|"中"|"低", priority_reasons: string[] }}
 */
export function computeSavedDealPriority(row, { todayYmd = jstToday() } = {}) {
  const pinned = (row?.is_pinned || 0) === 1;
  const status = row?.status || null;
  const deadline = row?.deadline || null;
  const daysLeft = daysBetweenYmd(todayYmd, deadline); // null なら「期限不明」扱い
  const amount = Number(row?.budget_amount);
  const hasAmount = Number.isFinite(amount);

  // ── 基本スコア ─────────────────────────────
  let base = 0;
  if (status === "closed") base -= 20;
  else if (status === "open") base += 10;
  else if (status === "upcoming") base += 3;

  if (daysLeft != null) {
    if (daysLeft < 0) base -= 10;
    else if (daysLeft <= 3) base += 30;
    else if (daysLeft <= 7) base += 15;
    else if (daysLeft <= 14) base += 5;
    else if (daysLeft <= 30) base += 0;
    else base -= 2;
  }
  if (hasAmount) {
    if (amount >= 100_000_000) base += 5;       // 1 億以上
    else if (amount >= 10_000_000) base += 2;   // 1000 万以上
  }

  // ── 最終スコア（pin 加点は順序だけに効かせ、label は base で判定）─
  const priority_score = base + (pinned ? PIN_BONUS : 0);

  // ── label ─────────────────────────────────
  let priority_label;
  if (pinned) {
    priority_label = "高";
  } else if (status === "closed" || (daysLeft != null && daysLeft < 0)) {
    // 終了済み / 期限切れ は基本「低」（pin 除く）
    priority_label = "低";
  } else if (base >= 25) {
    priority_label = "高";
  } else if (base >= 5) {
    priority_label = "中";
  } else {
    priority_label = "低";
  }

  // ── reasons（2 個まで、優先度順）──────────
  const reasons = [];
  if (pinned) reasons.push("ピン留め");
  if (daysLeft != null && daysLeft < 0) reasons.push("期限切れ");
  else if (daysLeft != null && daysLeft <= 3) reasons.push("締切が近い");
  else if (status === "closed") reasons.push("終了済み");
  else if (status === "upcoming") reasons.push("公告予定");
  else if (hasAmount && amount >= 100_000_000) reasons.push("大型案件");

  return {
    priority_score,
    priority_label,
    priority_reasons: reasons.slice(0, 2),
  };
}

/**
 * saved_deals の配列を優先度順に並び替える（破壊的）。
 *   ORDER BY priority_score DESC, is_pinned DESC, saved_at DESC, saved_id DESC
 *   priority_score に PIN_BONUS が入っているので pin は必ず上位。
 *   tie-break の is_pinned は念のため（priority_score が同値になった場合の保険）。
 */
export function sortSavedDealsByPriority(rows) {
  rows.sort((a, b) => {
    const ap = a.priority_score ?? 0, bp = b.priority_score ?? 0;
    if (bp !== ap) return bp - ap;
    const apin = a.is_pinned || 0, bpin = b.is_pinned || 0;
    if (bpin !== apin) return bpin - apin;
    const asa = String(a.saved_at || ""), bsa = String(b.saved_at || "");
    if (asa !== bsa) return bsa.localeCompare(asa);
    return (b.saved_id || 0) - (a.saved_id || 0);
  });
  return rows;
}
