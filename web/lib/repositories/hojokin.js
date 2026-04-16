/**
 * 補助金ナビ — DB アクセス層
 *
 * hojokin_items テーブルへの CRUD を提供する。
 * yutai repository と同じパターン。
 */

import { getDb } from "@/lib/db";

/**
 * 一覧取得（フィルタ + ページネーション）
 */
export function listHojokinItems({
  keyword = "",
  category = "",
  target_type = "",
  status = "",
  provider = "",
  year = "",
  deadline_from = "",
  deadline_to = "",
  amount_min = "",
  amount_max = "",
  sort = "popular",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(title LIKE @kw OR summary LIKE @kw OR provider_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }
  if (target_type) {
    where.push("target_type = @target_type");
    params.target_type = target_type;
  }
  if (status) {
    where.push("status = @status");
    params.status = status;
  }
  if (provider) {
    where.push("provider_name = @provider");
    params.provider = provider;
  }
  if (year) {
    where.push("SUBSTR(deadline, 1, 4) = @year");
    params.year = year;
  }
  if (deadline_from) {
    where.push("deadline >= @deadline_from");
    params.deadline_from = deadline_from;
  }
  if (deadline_to) {
    where.push("deadline <= @deadline_to");
    params.deadline_to = deadline_to;
  }
  if (amount_min) {
    where.push("max_amount >= @amount_min");
    params.amount_min = parseInt(amount_min, 10);
  }
  if (amount_max) {
    where.push("max_amount <= @amount_max");
    params.amount_max = parseInt(amount_max, 10);
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "deadline":
      orderBy = "CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC";
      break;
    case "amount_desc":
      orderBy = "max_amount DESC";
      break;
    case "newest":
      orderBy = "created_at DESC";
      break;
    default:
      orderBy = "id ASC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM hojokin_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM hojokin_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

/** 統計ダッシュボード用の集計データ */
export function getHojokinStats({
  keyword = "", category = "", target_type = "", status = "", provider = "",
  year = "", deadline_from = "", deadline_to = "", amount_min = "", amount_max = "",
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR summary LIKE @kw OR provider_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  if (category) { where.push("category = @category"); params.category = category; }
  if (target_type) { where.push("target_type = @target_type"); params.target_type = target_type; }
  if (status) { where.push("status = @status"); params.status = status; }
  if (provider) { where.push("provider_name = @provider"); params.provider = provider; }
  if (year) { where.push("SUBSTR(deadline, 1, 4) = @year"); params.year = year; }
  if (deadline_from) { where.push("deadline >= @deadline_from"); params.deadline_from = deadline_from; }
  if (deadline_to) { where.push("deadline <= @deadline_to"); params.deadline_to = deadline_to; }
  if (amount_min) { where.push("max_amount >= @amount_min"); params.amount_min = parseInt(amount_min, 10); }
  if (amount_max) { where.push("max_amount <= @amount_max"); params.amount_max = parseInt(amount_max, 10); }
  const whereClause = `WHERE ${where.join(" AND ")}`;

  const totalCount = db.prepare(`SELECT COUNT(*) c FROM hojokin_items ${whereClause}`).get(params).c;

  const countsByYear = db.prepare(`
    SELECT SUBSTR(deadline, 1, 4) AS year, COUNT(*) AS count
    FROM hojokin_items ${whereClause}
      AND deadline IS NOT NULL AND SUBSTR(deadline, 1, 4) != ''
    GROUP BY year ORDER BY year DESC
  `).all(params);

  const countsByProvider = db.prepare(`
    SELECT provider_name AS name, COUNT(*) AS count
    FROM hojokin_items ${whereClause}
      AND provider_name IS NOT NULL AND provider_name != ''
    GROUP BY provider_name ORDER BY count DESC, provider_name ASC LIMIT 10
  `).all(params);

  const countsByCategory = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(category), ''), 'other') AS category, COUNT(*) AS count
    FROM hojokin_items ${whereClause}
    GROUP BY category ORDER BY count DESC
  `).all(params);

  const countsByStatus = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(status), ''), 'unknown') AS status, COUNT(*) AS count
    FROM hojokin_items ${whereClause}
    GROUP BY status ORDER BY count DESC
  `).all(params);

  return { totalCount, countsByYear, countsByProvider, countsByCategory, countsByStatus };
}

/**
 * slug で1件取得
 */
export function getHojokinBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM hojokin_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

/**
 * ID で1件取得
 */
export function getHojokinById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM hojokin_items WHERE id = ? AND is_published = 1").get(id) || null;
}

/**
 * 複数 ID で取得（compare 用）
 */
export function getHojokinByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM hojokin_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

/**
 * slug をキーに upsert（import 用）
 * @param {object} item - 正規化済みアイテム
 * @returns {{ action: "insert" | "update", id: number|null }}
 */
export function upsertHojokinItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM hojokin_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE hojokin_items SET
        title = @title, category = @category, target_type = @target_type,
        max_amount = @max_amount, subsidy_rate = @subsidy_rate,
        deadline = @deadline, status = @status, provider_name = @provider_name,
        summary = @summary, is_published = @is_published,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO hojokin_items
      (slug, title, category, target_type, max_amount, subsidy_rate,
       deadline, status, provider_name, summary, is_published,
       created_at, updated_at)
    VALUES
      (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
       @deadline, @status, @provider_name, @summary, @is_published,
       datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

/**
 * sitemap 用: slug + updated_at を軽量取得
 */
export function listHojokinSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM hojokin_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listHojokinAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw OR provider_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM hojokin_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM hojokin_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getHojokinAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM hojokin_items WHERE id = ?").get(id) || null;
}

export function createHojokinItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO hojokin_items (slug, title, category, target_type, max_amount, subsidy_rate,
      deadline, status, provider_name, summary, is_published, created_at, updated_at)
    VALUES (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
      @deadline, @status, @provider_name, @summary, @is_published, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateHojokinItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE hojokin_items SET slug = @slug, title = @title, category = @category,
      target_type = @target_type, max_amount = @max_amount, subsidy_rate = @subsidy_rate,
      deadline = @deadline, status = @status, provider_name = @provider_name,
      summary = @summary, is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
