/**
 * 行政処分DB — DB アクセス層
 */

import { getDb } from "@/lib/db";

// ─── 公開用関数 ─────────────────────

export function listAdministrativeActions({
  keyword = "",
  action_type = "",
  prefecture = "",
  industry = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(organization_name_raw LIKE @kw OR summary LIKE @kw OR detail LIKE @kw OR authority_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (action_type) {
    where.push("action_type = @action_type");
    params.action_type = action_type;
  }
  if (prefecture) {
    where.push("prefecture = @prefecture");
    params.prefecture = prefecture;
  }
  if (industry) {
    where.push("industry = @industry");
    params.industry = industry;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "action_date":
      orderBy = "action_date DESC NULLS LAST, updated_at DESC";
      break;
    case "severity":
      orderBy = "CASE action_type WHEN 'license_revocation' THEN 1 WHEN 'business_suspension' THEN 2 WHEN 'improvement_order' THEN 3 WHEN 'warning' THEN 4 WHEN 'guidance' THEN 5 ELSE 6 END, action_date DESC";
      break;
    case "newest":
    default:
      orderBy = "created_at DESC";
  }

  const total = db
    .prepare(`SELECT COUNT(*) as c FROM administrative_actions ${whereClause}`)
    .get(params).c;

  const items = db
    .prepare(`SELECT * FROM administrative_actions ${whereClause} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getAdministrativeActionBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM administrative_actions WHERE slug = ? AND is_published = 1").get(slug);
}

export function getAdministrativeActionById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM administrative_actions WHERE id = ?").get(id);
}

// ─── 管理用関数 ─────────────────────

export function upsertAdministrativeAction(item) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(item.slug);

  if (existing) {
    db.prepare(`
      UPDATE administrative_actions SET
        organization_id = @organization_id,
        organization_name_raw = @organization_name_raw,
        action_type = @action_type,
        action_date = @action_date,
        authority_name = @authority_name,
        authority_level = @authority_level,
        prefecture = @prefecture,
        city = @city,
        industry = @industry,
        summary = @summary,
        detail = @detail,
        legal_basis = @legal_basis,
        penalty_period = @penalty_period,
        source_url = @source_url,
        source_name = @source_name,
        is_published = @is_published,
        review_status = @review_status,
        updated_at = datetime('now')
      WHERE slug = @slug
    `).run({
      slug: item.slug,
      organization_id: item.organization_id || null,
      organization_name_raw: item.organization_name_raw,
      action_type: item.action_type || "other",
      action_date: item.action_date || null,
      authority_name: item.authority_name || null,
      authority_level: item.authority_level || "national",
      prefecture: item.prefecture || null,
      city: item.city || null,
      industry: item.industry || null,
      summary: item.summary || null,
      detail: item.detail || null,
      legal_basis: item.legal_basis || null,
      penalty_period: item.penalty_period || null,
      source_url: item.source_url || null,
      source_name: item.source_name || null,
      is_published: item.is_published ?? 0,
      review_status: item.review_status || "pending",
    });
    return { action: "updated", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO administrative_actions (
      slug, organization_id, organization_name_raw, action_type, action_date,
      authority_name, authority_level, prefecture, city, industry,
      summary, detail, legal_basis, penalty_period,
      source_url, source_name, is_published, review_status
    ) VALUES (
      @slug, @organization_id, @organization_name_raw, @action_type, @action_date,
      @authority_name, @authority_level, @prefecture, @city, @industry,
      @summary, @detail, @legal_basis, @penalty_period,
      @source_url, @source_name, @is_published, @review_status
    )
  `).run({
    slug: item.slug,
    organization_id: item.organization_id || null,
    organization_name_raw: item.organization_name_raw,
    action_type: item.action_type || "other",
    action_date: item.action_date || null,
    authority_name: item.authority_name || null,
    authority_level: item.authority_level || "national",
    prefecture: item.prefecture || null,
    city: item.city || null,
    industry: item.industry || null,
    summary: item.summary || null,
    detail: item.detail || null,
    legal_basis: item.legal_basis || null,
    penalty_period: item.penalty_period || null,
    source_url: item.source_url || null,
    source_name: item.source_name || null,
    is_published: item.is_published ?? 0,
    review_status: item.review_status || "pending",
  });

  return { action: "created", id: result.lastInsertRowid };
}

// ─── sitemap 用 ─────────────────────

export function listGyoseiShobunSlugsForSitemap() {
  const db = getDb();
  return db
    .prepare("SELECT slug, updated_at FROM administrative_actions WHERE is_published = 1 ORDER BY updated_at DESC")
    .all();
}
