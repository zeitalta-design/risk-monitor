/**
 * 指定管理・委託公募まとめ — DB アクセス層
 */

import { getDb } from "@/lib/db";

// ─── 公開用関数 ─────────────────────

export function listShiteiItems({
  keyword = "",
  prefecture = "",
  facility_category = "",
  recruitment_status = "",
  municipality = "",
  sort = "deadline",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(title LIKE @kw OR municipality_name LIKE @kw OR facility_name LIKE @kw OR summary LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (prefecture) {
    where.push("prefecture = @prefecture");
    params.prefecture = prefecture;
  }
  if (facility_category) {
    where.push("facility_category = @facility_category");
    params.facility_category = facility_category;
  }
  if (recruitment_status) {
    where.push("recruitment_status = @recruitment_status");
    params.recruitment_status = recruitment_status;
  }
  if (municipality) {
    where.push("municipality_name = @municipality");
    params.municipality = municipality;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "deadline":
      orderBy = "CASE WHEN application_deadline IS NULL THEN 1 ELSE 0 END, application_deadline ASC, updated_at DESC";
      break;
    case "newest":
      orderBy = "updated_at DESC";
      break;
    case "municipality":
      orderBy = "municipality_name ASC, application_deadline ASC";
      break;
    default:
      orderBy = "id DESC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM shitei_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM shitei_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getShiteiBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM shitei_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getShiteiById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM shitei_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getShiteiByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM shitei_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

// ─── Upsert（import 用） ─────────────────────

export function upsertShiteiItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM shitei_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE shitei_items SET
        title = @title, municipality_name = @municipality_name, prefecture = @prefecture,
        facility_category = @facility_category, facility_name = @facility_name,
        recruitment_status = @recruitment_status,
        application_start_date = @application_start_date, application_deadline = @application_deadline,
        opening_date = @opening_date, contract_start_date = @contract_start_date,
        contract_end_date = @contract_end_date, summary = @summary,
        eligibility = @eligibility, application_method = @application_method,
        detail_url = @detail_url, source_name = @source_name, source_url = @source_url,
        attachment_count = @attachment_count, notes = @notes,
        is_published = @is_published, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO shitei_items
      (slug, title, municipality_name, prefecture, facility_category, facility_name,
       recruitment_status, application_start_date, application_deadline,
       opening_date, contract_start_date, contract_end_date, summary,
       eligibility, application_method, detail_url, source_name, source_url,
       attachment_count, notes, is_published, published_at, created_at, updated_at)
    VALUES
      (@slug, @title, @municipality_name, @prefecture, @facility_category, @facility_name,
       @recruitment_status, @application_start_date, @application_deadline,
       @opening_date, @contract_start_date, @contract_end_date, @summary,
       @eligibility, @application_method, @detail_url, @source_name, @source_url,
       @attachment_count, @notes, @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

export function listShiteiSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM shitei_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listShiteiAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw OR municipality_name LIKE @kw OR facility_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM shitei_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM shitei_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getShiteiAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM shitei_items WHERE id = ?").get(id) || null;
}

export function createShiteiItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO shitei_items
      (slug, title, municipality_name, prefecture, facility_category, facility_name,
       recruitment_status, application_start_date, application_deadline,
       opening_date, contract_start_date, contract_end_date, summary,
       eligibility, application_method, detail_url, source_name, source_url,
       attachment_count, notes, is_published, published_at, created_at, updated_at)
    VALUES
      (@slug, @title, @municipality_name, @prefecture, @facility_category, @facility_name,
       @recruitment_status, @application_start_date, @application_deadline,
       @opening_date, @contract_start_date, @contract_end_date, @summary,
       @eligibility, @application_method, @detail_url, @source_name, @source_url,
       @attachment_count, @notes, @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateShiteiItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE shitei_items SET
      slug = @slug, title = @title, municipality_name = @municipality_name,
      prefecture = @prefecture, facility_category = @facility_category,
      facility_name = @facility_name, recruitment_status = @recruitment_status,
      application_start_date = @application_start_date, application_deadline = @application_deadline,
      opening_date = @opening_date, contract_start_date = @contract_start_date,
      contract_end_date = @contract_end_date, summary = @summary,
      eligibility = @eligibility, application_method = @application_method,
      detail_url = @detail_url, source_name = @source_name, source_url = @source_url,
      attachment_count = @attachment_count, notes = @notes,
      is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
