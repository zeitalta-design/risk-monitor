/**
 * 企業ウォッチ — DB アクセス層
 *
 * 一致キー: organization_name_raw + industry（完全一致）
 * 将来の拡張: prefecture を追加して同名他地域企業を区別可能
 */

import { getDb } from "@/lib/db";

// ─── ウォッチ登録 / 解除 ─────────────────────

export function addWatch(userId, organizationName, industry = "") {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO watched_organizations (user_id, organization_name, industry, last_seen_action_date, last_notified_action_date)
      VALUES (@user_id, @organization_name, @industry,
        (SELECT MAX(action_date) FROM administrative_actions
         WHERE organization_name_raw = @organization_name AND industry = @industry),
        (SELECT MAX(action_date) FROM administrative_actions
         WHERE organization_name_raw = @organization_name AND industry = @industry)
      )
    `).run({
      user_id: userId,
      organization_name: organizationName,
      industry: industry || "",
    });
    return { action: "added" };
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { action: "already_exists" };
    }
    throw err;
  }
}

export function removeWatch(userId, organizationName, industry = "") {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM watched_organizations
    WHERE user_id = @user_id AND organization_name = @organization_name AND industry = @industry
  `).run({
    user_id: userId,
    organization_name: organizationName,
    industry: industry || "",
  });
  return { action: result.changes > 0 ? "removed" : "not_found" };
}

export function removeWatchById(userId, watchId) {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM watched_organizations WHERE id = ? AND user_id = ?"
  ).run(watchId, userId);
  return { action: result.changes > 0 ? "removed" : "not_found" };
}

// ─── ウォッチ判定 ─────────────────────

export function isWatched(userId, organizationName, industry = "") {
  const db = getDb();
  const row = db.prepare(`
    SELECT id FROM watched_organizations
    WHERE user_id = @user_id AND organization_name = @organization_name AND industry = @industry
  `).get({
    user_id: userId,
    organization_name: organizationName,
    industry: industry || "",
  });
  return !!row;
}

// ─── ウォッチ一覧（集約クエリ付き） ─────────────────────

export function listWatches(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      w.id,
      w.organization_name,
      w.industry,
      w.note,
      w.last_seen_action_date,
      w.last_notified_action_date,
      w.created_at,
      w.updated_at,
      COUNT(a.id) AS action_count,
      MAX(a.action_date) AS latest_action_date,
      (SELECT a2.action_type FROM administrative_actions a2
       WHERE a2.organization_name_raw = w.organization_name AND a2.industry = w.industry
       ORDER BY a2.action_date DESC NULLS LAST, a2.id DESC LIMIT 1
      ) AS latest_action_type,
      (SELECT a3.prefecture FROM administrative_actions a3
       WHERE a3.organization_name_raw = w.organization_name AND a3.industry = w.industry
       ORDER BY a3.action_date DESC NULLS LAST, a3.id DESC LIMIT 1
      ) AS prefecture,
      (SELECT a4.slug FROM administrative_actions a4
       WHERE a4.organization_name_raw = w.organization_name AND a4.industry = w.industry
       ORDER BY a4.action_date DESC NULLS LAST, a4.id DESC LIMIT 1
      ) AS latest_slug,
      CASE
        WHEN MAX(a.action_date) > w.last_seen_action_date THEN 1
        WHEN w.last_seen_action_date IS NULL AND COUNT(a.id) > 0 THEN 1
        ELSE 0
      END AS has_new,
      CASE
        WHEN MAX(a.action_date) > w.last_notified_action_date THEN 1
        WHEN w.last_notified_action_date IS NULL AND COUNT(a.id) > 0 THEN 1
        ELSE 0
      END AS has_pending_notification
    FROM watched_organizations w
    LEFT JOIN administrative_actions a
      ON a.organization_name_raw = w.organization_name AND a.industry = w.industry
    WHERE w.user_id = @user_id
    GROUP BY w.id
    ORDER BY has_new DESC, latest_action_date DESC NULLS LAST, w.created_at DESC
  `).all({ user_id: userId });
}

// ─── 新着確認済みにする ─────────────────────

export function markAsSeen(userId, watchId) {
  const db = getDb();
  // 現時点の最新 action_date で last_seen_action_date を更新
  // 該当処分がない場合は既存値を保持（COALESCE）
  db.prepare(`
    UPDATE watched_organizations
    SET last_seen_action_date = COALESCE(
      (SELECT MAX(a.action_date) FROM administrative_actions a
       WHERE a.organization_name_raw = watched_organizations.organization_name
         AND a.industry = watched_organizations.industry),
      last_seen_action_date
    ),
    updated_at = datetime('now')
    WHERE id = @id AND user_id = @user_id
  `).run({ id: watchId, user_id: userId });
  return { action: "seen" };
}

// ─── バッチ: 全件確認済みにする ─────────────────────

export function markAllAsSeen(userId) {
  const db = getDb();
  db.prepare(`
    UPDATE watched_organizations
    SET last_seen_action_date = COALESCE(
      (SELECT MAX(a.action_date) FROM administrative_actions a
       WHERE a.organization_name_raw = watched_organizations.organization_name
         AND a.industry = watched_organizations.industry),
      last_seen_action_date
    ),
    updated_at = datetime('now')
    WHERE user_id = @user_id
  `).run({ user_id: userId });
  return { action: "all_seen" };
}

// ─── ユーザーのウォッチ済み企業名セットを取得 ─────────────────────

export function getWatchedOrgSet(userId) {
  const db = getDb();
  const rows = db.prepare(
    "SELECT organization_name, industry FROM watched_organizations WHERE user_id = ?"
  ).all(userId);
  return new Set(rows.map((r) => `${r.organization_name}::${r.industry}`));
}
