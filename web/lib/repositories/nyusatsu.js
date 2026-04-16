/**
 * 入札ナビ — DB アクセス層
 * yutai / hojokin repository と同じパターン。
 */

import { getDb } from "@/lib/db";

export function listNyusatsuItems({
  keyword = "",
  category = "",
  area = "",
  bidding_method = "",
  budget_range = "",
  deadline_within = "",
  status = "",
  issuer = "",
  year = "",
  deadline_from = "",
  deadline_to = "",
  sort = "popular",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(title LIKE @kw OR summary LIKE @kw OR issuer_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }
  if (area) {
    where.push("target_area LIKE @area");
    params.area = `%${area}%`;
  }
  if (bidding_method) {
    where.push("bidding_method = @bidding_method");
    params.bidding_method = bidding_method;
  }
  if (budget_range) {
    switch (budget_range) {
      case "under1m": where.push("budget_amount > 0 AND budget_amount <= 1000000"); break;
      case "under10m": where.push("budget_amount > 0 AND budget_amount <= 10000000"); break;
      case "under100m": where.push("budget_amount > 0 AND budget_amount <= 100000000"); break;
      case "over100m": where.push("budget_amount > 100000000"); break;
    }
  }
  if (deadline_within) {
    const now = new Date().toISOString().slice(0, 10);
    let days = 0;
    switch (deadline_within) {
      case "this_week": days = 7; break;
      case "this_month": days = 30; break;
      case "3months": days = 90; break;
    }
    if (days > 0) {
      const future = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      where.push("deadline >= @now AND deadline <= @future");
      params.now = now;
      params.future = future;
    }
  }
  if (status) {
    where.push("status = @status");
    params.status = status;
  }
  if (issuer) {
    where.push("issuer_name = @issuer");
    params.issuer = issuer;
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

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "deadline":
      orderBy = "CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC";
      break;
    case "budget_desc":
      orderBy = "COALESCE(budget_amount, 0) DESC";
      break;
    case "budget_asc":
      orderBy = "CASE WHEN budget_amount IS NULL OR budget_amount = 0 THEN 1 ELSE 0 END, budget_amount ASC";
      break;
    case "newest":
      orderBy = "created_at DESC";
      break;
    default:
      orderBy = "id ASC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM nyusatsu_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM nyusatsu_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

/** 統計ダッシュボード用の集計データ */
export function getNyusatsuStats({
  keyword = "", category = "", area = "", bidding_method = "",
  budget_range = "", deadline_within = "", status = "",
  issuer = "", year = "", deadline_from = "", deadline_to = "",
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR summary LIKE @kw OR issuer_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  if (category) { where.push("category = @category"); params.category = category; }
  if (area) { where.push("target_area LIKE @area"); params.area = `%${area}%`; }
  if (bidding_method) { where.push("bidding_method = @bidding_method"); params.bidding_method = bidding_method; }
  if (status) { where.push("status = @status"); params.status = status; }
  if (issuer) { where.push("issuer_name = @issuer"); params.issuer = issuer; }
  if (year) { where.push("SUBSTR(deadline, 1, 4) = @year"); params.year = year; }
  if (deadline_from) { where.push("deadline >= @deadline_from"); params.deadline_from = deadline_from; }
  if (deadline_to) { where.push("deadline <= @deadline_to"); params.deadline_to = deadline_to; }
  const whereClause = `WHERE ${where.join(" AND ")}`;

  const totalCount = db.prepare(`SELECT COUNT(*) c FROM nyusatsu_items ${whereClause}`).get(params).c;

  const countsByYear = db.prepare(`
    SELECT SUBSTR(COALESCE(announcement_date, deadline), 1, 4) AS year, COUNT(*) AS count
    FROM nyusatsu_items ${whereClause}
      AND COALESCE(announcement_date, deadline) IS NOT NULL
      AND SUBSTR(COALESCE(announcement_date, deadline), 1, 4) != ''
    GROUP BY year ORDER BY year DESC
  `).all(params);

  const countsByIssuer = db.prepare(`
    SELECT issuer_name AS name, COUNT(*) AS count
    FROM nyusatsu_items ${whereClause}
      AND issuer_name IS NOT NULL AND issuer_name != ''
    GROUP BY issuer_name ORDER BY count DESC, issuer_name ASC LIMIT 10
  `).all(params);

  const countsByCategory = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(category), ''), 'other') AS category, COUNT(*) AS count
    FROM nyusatsu_items ${whereClause}
    GROUP BY category ORDER BY count DESC
  `).all(params);

  const countsByStatus = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(status), ''), 'unknown') AS status, COUNT(*) AS count
    FROM nyusatsu_items ${whereClause}
    GROUP BY status ORDER BY count DESC
  `).all(params);

  return { totalCount, countsByYear, countsByIssuer, countsByCategory, countsByStatus };
}

export function getNyusatsuBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getNyusatsuById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getNyusatsuByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM nyusatsu_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

/**
 * slug をキーに upsert（import 用）
 */
export function upsertNyusatsuItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE nyusatsu_items SET
        title = @title, category = @category, issuer_name = @issuer_name,
        target_area = @target_area, deadline = @deadline,
        budget_amount = @budget_amount, bidding_method = @bidding_method,
        summary = @summary, status = @status, is_published = @is_published,
        qualification = @qualification, announcement_url = @announcement_url,
        contact_info = @contact_info, delivery_location = @delivery_location,
        has_attachment = @has_attachment, announcement_date = @announcement_date,
        contract_period = @contract_period, updated_at = datetime('now')
      WHERE id = @id
    `).run({ qualification: null, announcement_url: null, contact_info: null, delivery_location: null, has_attachment: 0, announcement_date: null, contract_period: null, ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO nyusatsu_items
      (slug, title, category, issuer_name, target_area, deadline,
       budget_amount, bidding_method, summary, status, is_published,
       qualification, announcement_url, contact_info, delivery_location,
       has_attachment, announcement_date, contract_period,
       created_at, updated_at)
    VALUES
      (@slug, @title, @category, @issuer_name, @target_area, @deadline,
       @budget_amount, @bidding_method, @summary, @status, @is_published,
       @qualification, @announcement_url, @contact_info, @delivery_location,
       @has_attachment, @announcement_date, @contract_period,
       datetime('now'), datetime('now'))
  `).run({ qualification: null, announcement_url: null, contact_info: null, delivery_location: null, has_attachment: 0, announcement_date: null, contract_period: null, ...item });
  return { action: "insert", id: result.lastInsertRowid };
}

export function listNyusatsuSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM nyusatsu_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listNyusatsuAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw OR issuer_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM nyusatsu_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM nyusatsu_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getNyusatsuAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE id = ?").get(id) || null;
}

export function createNyusatsuItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO nyusatsu_items (slug, title, category, issuer_name, target_area, deadline,
      budget_amount, bidding_method, summary, status, is_published,
      qualification, announcement_url, contact_info, delivery_location,
      has_attachment, announcement_date, contract_period, created_at, updated_at)
    VALUES (@slug, @title, @category, @issuer_name, @target_area, @deadline,
      @budget_amount, @bidding_method, @summary, @status, @is_published,
      @qualification, @announcement_url, @contact_info, @delivery_location,
      @has_attachment, @announcement_date, @contract_period, datetime('now'), datetime('now'))
  `).run({ qualification: null, announcement_url: null, contact_info: null, delivery_location: null, has_attachment: 0, announcement_date: null, contract_period: null, ...item });
  return { id: result.lastInsertRowid };
}

export function updateNyusatsuItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE nyusatsu_items SET slug = @slug, title = @title, category = @category,
      issuer_name = @issuer_name, target_area = @target_area, deadline = @deadline,
      budget_amount = @budget_amount, bidding_method = @bidding_method,
      summary = @summary, status = @status, is_published = @is_published,
      qualification = @qualification, announcement_url = @announcement_url,
      contact_info = @contact_info, delivery_location = @delivery_location,
      has_attachment = @has_attachment, announcement_date = @announcement_date,
      contract_period = @contract_period, updated_at = datetime('now')
    WHERE id = @id
  `).run({ qualification: null, announcement_url: null, contact_info: null, delivery_location: null, has_attachment: 0, announcement_date: null, contract_period: null, ...item, id });
  return { id };
}

// ─── 落札結果 (nyusatsu_results) ─────────────────────

/**
 * 落札結果の一覧取得（フィルタ + ページネーション）
 */
export function listNyusatsuResults({
  keyword = "",
  category = "",
  area = "",
  winner = "",
  issuer = "",
  year = "",
  award_date_from = "",
  award_date_to = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(title LIKE @kw OR winner_name LIKE @kw OR issuer_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) { where.push("category = @category"); params.category = category; }
  if (area) { where.push("target_area LIKE @area"); params.area = `%${area}%`; }
  if (winner) { where.push("winner_name = @winner"); params.winner = winner; }
  if (issuer) { where.push("issuer_name = @issuer"); params.issuer = issuer; }
  if (year) { where.push("SUBSTR(award_date, 1, 4) = @year"); params.year = year; }
  if (award_date_from) { where.push("award_date >= @award_date_from"); params.award_date_from = award_date_from; }
  if (award_date_to) { where.push("award_date <= @award_date_to"); params.award_date_to = award_date_to; }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "newest": orderBy = "award_date DESC, id DESC"; break;
    case "amount_desc": orderBy = "COALESCE(award_amount, 0) DESC"; break;
    case "amount_asc": orderBy = "CASE WHEN award_amount IS NULL OR award_amount = 0 THEN 1 ELSE 0 END, award_amount ASC"; break;
    default: orderBy = "id DESC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM nyusatsu_results ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM nyusatsu_results ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

/**
 * 落札結果の統計ダッシュボード
 */
export function getNyusatsuResultStats({
  keyword = "", category = "", area = "", winner = "", issuer = "", year = "",
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR winner_name LIKE @kw OR issuer_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  if (category) { where.push("category = @category"); params.category = category; }
  if (winner) { where.push("winner_name = @winner"); params.winner = winner; }
  if (issuer) { where.push("issuer_name = @issuer"); params.issuer = issuer; }
  if (year) { where.push("SUBSTR(award_date, 1, 4) = @year"); params.year = year; }
  const whereClause = `WHERE ${where.join(" AND ")}`;

  const totalCount = db.prepare(`SELECT COUNT(*) c FROM nyusatsu_results ${whereClause}`).get(params).c;

  const countsByYear = db.prepare(`
    SELECT SUBSTR(award_date, 1, 4) AS year, COUNT(*) AS count
    FROM nyusatsu_results ${whereClause}
      AND award_date IS NOT NULL AND SUBSTR(award_date, 1, 4) != ''
    GROUP BY year ORDER BY year DESC
  `).all(params);

  const countsByWinner = db.prepare(`
    SELECT winner_name AS name, COUNT(*) AS count, SUM(award_amount) AS total_amount
    FROM nyusatsu_results ${whereClause}
      AND winner_name IS NOT NULL AND winner_name != ''
    GROUP BY winner_name ORDER BY count DESC, winner_name ASC LIMIT 10
  `).all(params);

  const countsByIssuer = db.prepare(`
    SELECT issuer_name AS name, COUNT(*) AS count
    FROM nyusatsu_results ${whereClause}
      AND issuer_name IS NOT NULL AND issuer_name != ''
    GROUP BY issuer_name ORDER BY count DESC, issuer_name ASC LIMIT 10
  `).all(params);

  const avgAwardRate = db.prepare(`
    SELECT AVG(award_rate) AS avg_rate, COUNT(*) AS count
    FROM nyusatsu_results ${whereClause}
      AND award_rate IS NOT NULL AND award_rate > 0
  `).get(params);

  return { totalCount, countsByYear, countsByWinner, countsByIssuer, avgAwardRate };
}

/**
 * 落札結果の upsert（slug ベース）
 */
export function upsertNyusatsuResult(result) {
  const db = getDb();
  const existing = result.slug
    ? db.prepare("SELECT id FROM nyusatsu_results WHERE slug = ?").get(result.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE nyusatsu_results SET
        nyusatsu_item_id = @nyusatsu_item_id, title = @title,
        issuer_name = @issuer_name, winner_name = @winner_name,
        winner_corporate_number = @winner_corporate_number,
        award_amount = @award_amount, award_date = @award_date,
        num_bidders = @num_bidders, award_rate = @award_rate,
        budget_amount = @budget_amount, category = @category,
        target_area = @target_area, bidding_method = @bidding_method,
        result_url = @result_url, source_name = @source_name,
        source_url = @source_url, summary = @summary,
        is_published = @is_published, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...result, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const r = db.prepare(`
    INSERT INTO nyusatsu_results
      (slug, nyusatsu_item_id, title, issuer_name, winner_name,
       winner_corporate_number, award_amount, award_date,
       num_bidders, award_rate, budget_amount, category,
       target_area, bidding_method, result_url, source_name,
       source_url, summary, is_published, created_at, updated_at)
    VALUES
      (@slug, @nyusatsu_item_id, @title, @issuer_name, @winner_name,
       @winner_corporate_number, @award_amount, @award_date,
       @num_bidders, @award_rate, @budget_amount, @category,
       @target_area, @bidding_method, @result_url, @source_name,
       @source_url, @summary, @is_published, datetime('now'), datetime('now'))
  `).run(result);
  return { action: "insert", id: r.lastInsertRowid };
}

/**
 * 入札公告と落札結果を紐付け + ライフサイクル更新
 */
export function linkResultToItem(itemId, resultId) {
  const db = getDb();
  db.prepare(`
    UPDATE nyusatsu_items SET
      result_id = @resultId,
      lifecycle_status = 'awarded',
      updated_at = datetime('now')
    WHERE id = @itemId
  `).run({ itemId, resultId });
}

/**
 * 期限切れの公告を自動 closed に更新
 */
export function closeExpiredItems() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const r = db.prepare(`
    UPDATE nyusatsu_items SET
      lifecycle_status = 'closed',
      updated_at = datetime('now')
    WHERE lifecycle_status = 'active'
      AND deadline IS NOT NULL
      AND deadline < @today
  `).run({ today });
  return r.changes;
}
