/**
 * 食品リコール監視 — DB アクセス層
 */

import { getDb } from "@/lib/db";

export function listFoodRecallItems({
  keyword = "",
  category = "",
  risk_level = "",
  reason = "",
  status = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(product_name LIKE @kw OR manufacturer LIKE @kw OR summary LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }
  if (risk_level) {
    where.push("risk_level = @risk_level");
    params.risk_level = risk_level;
  }
  if (reason) {
    where.push("reason = @reason");
    params.reason = reason;
  }
  if (status) {
    where.push("status = @status");
    params.status = status;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = "COALESCE(recall_date, created_at) DESC";
      break;
    case "risk_high":
      orderBy = "CASE risk_level WHEN 'class1' THEN 1 WHEN 'class2' THEN 2 WHEN 'class3' THEN 3 ELSE 4 END, COALESCE(recall_date, created_at) DESC";
      break;
    default:
      orderBy = "id DESC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM food_recall_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM food_recall_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getFoodRecallBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM food_recall_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getFoodRecallById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM food_recall_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getFoodRecallByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM food_recall_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

/**
 * slug をキーに upsert（import 用）
 */
export function upsertFoodRecallItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM food_recall_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE food_recall_items SET
        product_name = @product_name, manufacturer = @manufacturer,
        category = @category, recall_type = @recall_type,
        reason = @reason, risk_level = @risk_level,
        affected_area = @affected_area, lot_number = @lot_number,
        recall_date = @recall_date, status = @status,
        consumer_action = @consumer_action, source_url = @source_url,
        manufacturer_url = @manufacturer_url, summary = @summary,
        is_published = @is_published, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO food_recall_items
      (slug, product_name, manufacturer, category, recall_type,
       reason, risk_level, affected_area, lot_number,
       recall_date, status, consumer_action, source_url,
       manufacturer_url, summary, is_published,
       created_at, updated_at)
    VALUES
      (@slug, @product_name, @manufacturer, @category, @recall_type,
       @reason, @risk_level, @affected_area, @lot_number,
       @recall_date, @status, @consumer_action, @source_url,
       @manufacturer_url, @summary, @is_published,
       datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

export function listFoodRecallSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM food_recall_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listFoodRecallAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(product_name LIKE @kw OR slug LIKE @kw OR manufacturer LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM food_recall_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM food_recall_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getFoodRecallAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM food_recall_items WHERE id = ?").get(id) || null;
}

export function createFoodRecallItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO food_recall_items (slug, product_name, manufacturer, category, recall_type,
      reason, risk_level, affected_area, lot_number,
      recall_date, status, consumer_action, source_url,
      manufacturer_url, summary, is_published, created_at, updated_at)
    VALUES (@slug, @product_name, @manufacturer, @category, @recall_type,
      @reason, @risk_level, @affected_area, @lot_number,
      @recall_date, @status, @consumer_action, @source_url,
      @manufacturer_url, @summary, @is_published, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateFoodRecallItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE food_recall_items SET slug = @slug, product_name = @product_name,
      manufacturer = @manufacturer, category = @category, recall_type = @recall_type,
      reason = @reason, risk_level = @risk_level,
      affected_area = @affected_area, lot_number = @lot_number,
      recall_date = @recall_date, status = @status,
      consumer_action = @consumer_action, source_url = @source_url,
      manufacturer_url = @manufacturer_url, summary = @summary,
      is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
