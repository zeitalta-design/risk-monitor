/**
 * saved_deals — ユーザーが保存（ピン留め）した有望案件の DB アクセス層
 *
 * Phase J-14: 1 user × 1 nyusatsu_items.slug の薄い結合テーブル。
 *
 * 制約:
 *   - user 所有チェックは必ず SQL に入れる（他 user の保存には触れない）
 *   - UNIQUE(user_id, deal_slug) により重複保存は INSERT OR IGNORE で冪等
 *   - fuzzy / LLM は使わない
 *   - deal_slug の存在確認は呼び出し側（API ルート）で行う
 */
import { getDb } from "@/lib/db";
import {
  computeSavedDealPriority,
  sortSavedDealsByPriority,
} from "@/lib/saved-deals-priority";

function assertUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("userId is required");
}
function assertSlug(slug) {
  if (typeof slug !== "string" || !slug) throw new Error("deal_slug is required");
  return slug;
}

// ─── 保存（冪等） ───────────────────────────
// Phase J-16: 初回保存時に現在の status を snapshot する。呼び出し側で事前に
// nyusatsu_items から status を読んで渡す想定（見つからない場合は null 可）。
// 再保存（UNIQUE で INSERT OR IGNORE）の場合は既存行の last_seen_status は
// 保持したまま上書きしない（cron 追跡を維持するため）。
/**
 * @returns {{ action: "added" | "already_saved" }}
 */
export function saveDeal(userId, dealSlug, lastSeenStatus = null) {
  assertUserId(userId);
  const slug = assertSlug(dealSlug);
  const db = getDb();
  const res = db.prepare(`
    INSERT OR IGNORE INTO saved_deals (user_id, deal_slug, last_seen_status)
    VALUES (?, ?, ?)
  `).run(userId, slug, lastSeenStatus);
  return { action: res.changes > 0 ? "added" : "already_saved" };
}

// ─── 保存解除 ───────────────────────────────
/**
 * @returns {{ action: "removed" | "not_found" }}
 */
export function unsaveDeal(userId, dealSlug) {
  assertUserId(userId);
  const slug = assertSlug(dealSlug);
  const db = getDb();
  const res = db.prepare(`
    DELETE FROM saved_deals WHERE user_id = ? AND deal_slug = ?
  `).run(userId, slug);
  return { action: res.changes > 0 ? "removed" : "not_found" };
}

// ─── pin / unpin（Phase J-17） ───────────────
// 保存済み行のみ対象にする。未保存 slug は UPDATE の matched=0 で区別する。
// 冪等: 既に同じ状態でも action を明示して返す。
/**
 * @returns {{ action: "pinned" | "already_pinned" | "not_saved" }}
 */
export function pinDeal(userId, dealSlug) {
  assertUserId(userId);
  const slug = assertSlug(dealSlug);
  const db = getDb();
  // 1) 存在 + 現在値を見る。未保存なら not_saved。
  const row = db.prepare(
    "SELECT is_pinned FROM saved_deals WHERE user_id = ? AND deal_slug = ? LIMIT 1"
  ).get(userId, slug);
  if (!row) return { action: "not_saved" };
  if (row.is_pinned === 1) return { action: "already_pinned" };
  db.prepare(
    "UPDATE saved_deals SET is_pinned = 1 WHERE user_id = ? AND deal_slug = ?"
  ).run(userId, slug);
  return { action: "pinned" };
}

/**
 * @returns {{ action: "unpinned" | "already_unpinned" | "not_saved" }}
 */
export function unpinDeal(userId, dealSlug) {
  assertUserId(userId);
  const slug = assertSlug(dealSlug);
  const db = getDb();
  const row = db.prepare(
    "SELECT is_pinned FROM saved_deals WHERE user_id = ? AND deal_slug = ? LIMIT 1"
  ).get(userId, slug);
  if (!row) return { action: "not_saved" };
  if (row.is_pinned === 0) return { action: "already_unpinned" };
  db.prepare(
    "UPDATE saved_deals SET is_pinned = 0 WHERE user_id = ? AND deal_slug = ?"
  ).run(userId, slug);
  return { action: "unpinned" };
}

// ─── 保存済み判定 ───────────────────────────
export function isDealSaved(userId, dealSlug) {
  assertUserId(userId);
  const slug = assertSlug(dealSlug);
  const db = getDb();
  const row = db.prepare(`
    SELECT 1 FROM saved_deals WHERE user_id = ? AND deal_slug = ? LIMIT 1
  `).get(userId, slug);
  return !!row;
}

// ─── ユーザーの保存 slug 集合（一覧画面のバッジ判定用） ───
export function getSavedDealSlugSet(userId) {
  assertUserId(userId);
  const db = getDb();
  const rows = db.prepare(`
    SELECT deal_slug FROM saved_deals WHERE user_id = ?
  `).all(userId);
  return new Set(rows.map((r) => r.deal_slug));
}

// ─── 保存一覧（案件メタを JOIN） ─────────────
//   nyusatsu_items と JOIN して案件の基本情報を一緒に返す。
//   未公開 / 削除済み item は結果から自動的に外れる（INNER JOIN）。
/**
 * @param {object} opts
 * @param {number} opts.userId
 * @param {number} [opts.limit=30]
 * @param {number} [opts.offset=0]
 */
export function listSavedDeals({ userId, limit = 30, offset = 0 } = {}) {
  assertUserId(userId);
  const lim = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 30));
  const off = Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : 0);
  const db = getDb();

  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM saved_deals WHERE user_id = ?
  `).get(userId)?.n || 0;

  // Phase J-18: 優先度順に並び替えるため、SQL 側はユーザー所有の saved_deals × 公開
  //   nyusatsu_items を全件取得し、アプリ側で priority 算出 → ソート → 切り出す。
  //   saved_deals はユーザーごとに数百件までを想定しているため O(N) で十分。
  //   後方互換: items のフィールドは従来分 + priority_{score,label,reasons} のみ追加。
  //   tie-break は priority_score DESC → is_pinned DESC → saved_at DESC → saved_id DESC。
  const rawItems = db.prepare(`
    SELECT
      sd.id AS saved_id,
      sd.deal_slug,
      sd.created_at AS saved_at,
      sd.is_pinned,
      ni.id AS nyusatsu_id,
      ni.title,
      ni.category,
      ni.issuer_name,
      ni.target_area,
      ni.announcement_date,
      ni.deadline,
      ni.budget_amount,
      ni.status
    FROM saved_deals sd
    INNER JOIN nyusatsu_items ni ON ni.slug = sd.deal_slug AND ni.is_published = 1
    WHERE sd.user_id = ?
  `).all(userId);

  const enriched = rawItems.map((row) => ({
    ...row,
    ...computeSavedDealPriority(row),
  }));
  sortSavedDealsByPriority(enriched);
  const items = enriched.slice(off, off + lim);

  return { items, total };
}
