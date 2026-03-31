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
  year = "",
  organization = "",
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
  if (year) {
    where.push("SUBSTR(action_date, 1, 4) = @year");
    params.year = year;
  }
  if (organization) {
    where.push("organization_name_raw = @organization");
    params.organization = organization;
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

/**
 * 統計ダッシュボード用の集計データを取得
 * 検索・絞り込み条件に対して集計する（page は含まない）
 */
export function getAdministrativeActionStats({
  keyword = "",
  action_type = "",
  prefecture = "",
  industry = "",
  year = "",
  organization = "",
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
  if (year) {
    where.push("SUBSTR(action_date, 1, 4) = @year");
    params.year = year;
  }
  if (organization) {
    where.push("organization_name_raw = @organization");
    params.organization = organization;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  // 総件数
  const totalCount = db
    .prepare(`SELECT COUNT(*) as c FROM administrative_actions ${whereClause}`)
    .get(params).c;

  // 年別件数（action_date の先頭4文字で集計）
  const countsByYear = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(SUBSTR(action_date, 1, 4), ''), '不明') AS year,
        COUNT(*) AS count
      FROM administrative_actions
      ${whereClause}
      GROUP BY year
      ORDER BY year DESC
    `)
    .all(params);

  // 事業者別件数 TOP 10
  const countsByOrganization = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(organization_name_raw, ''), '名称不明') AS organizationName,
        COUNT(*) AS count
      FROM administrative_actions
      ${whereClause}
      GROUP BY organizationName
      ORDER BY count DESC, organizationName ASC
      LIMIT 10
    `)
    .all(params);

  // 業種別件数 TOP 10
  const countsByIndustry = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(industry), ''), '業種不明') AS industry,
        COUNT(*) AS count
      FROM administrative_actions
      ${whereClause}
      GROUP BY industry
      ORDER BY count DESC, industry ASC
      LIMIT 10
    `)
    .all(params);

  // 処分種別件数
  const countsByActionType = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(action_type), ''), '種別不明') AS actionType,
        COUNT(*) AS count
      FROM administrative_actions
      ${whereClause}
      GROUP BY actionType
      ORDER BY count DESC, actionType ASC
    `)
    .all(params);

  // 都道府県別件数 TOP 10
  const countsByPrefecture = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(prefecture), ''), '都道府県不明') AS prefecture,
        COUNT(*) AS count
      FROM administrative_actions
      ${whereClause}
      GROUP BY prefecture
      ORDER BY count DESC, prefecture ASC
      LIMIT 10
    `)
    .all(params);

  return { totalCount, countsByYear, countsByOrganization, countsByIndustry, countsByActionType, countsByPrefecture };
}

/**
 * 前後事案を取得（action_date DESC, id DESC の並びで隣接1件ずつ）
 */
export function getAdjacentAdministrativeActions(currentItem) {
  const db = getDb();
  const date = currentItem.action_date || "";
  const id = currentItem.id;

  // 前の事案（並び順で1つ上 = より新しい or 同日でidが大きい）
  const prev = db
    .prepare(`
      SELECT id, slug, organization_name_raw, action_type, action_date, industry, prefecture
      FROM administrative_actions
      WHERE is_published = 1
        AND (action_date > @date OR (action_date = @date AND id > @id))
      ORDER BY action_date ASC, id ASC
      LIMIT 1
    `)
    .get({ date, id });

  // 次の事案（並び順で1つ下 = より古い or 同日でidが小さい）
  const next = db
    .prepare(`
      SELECT id, slug, organization_name_raw, action_type, action_date, industry, prefecture
      FROM administrative_actions
      WHERE is_published = 1
        AND (action_date < @date OR (action_date = @date AND id < @id))
      ORDER BY action_date DESC, id DESC
      LIMIT 1
    `)
    .get({ date, id });

  return { prev: prev || null, next: next || null };
}

/**
 * 関連事案を取得（同一事業者 > 同一業種+同一種別 > 同一業種 > 同一都道府県 の優先度）
 */
export function getRelatedAdministrativeActions(currentItem, limit = 5) {
  const db = getDb();
  return db
    .prepare(`
      SELECT *, (
        CASE WHEN organization_name_raw = @org THEN 100 ELSE 0 END
        + CASE WHEN industry = @industry AND industry != '' THEN 20 ELSE 0 END
        + CASE WHEN action_type = @action_type AND action_type != '' THEN 10 ELSE 0 END
        + CASE WHEN prefecture = @prefecture AND prefecture != '' THEN 5 ELSE 0 END
      ) AS relevance_score
      FROM administrative_actions
      WHERE is_published = 1
        AND id != @id
        AND (
          organization_name_raw = @org
          OR industry = @industry
          OR action_type = @action_type
          OR prefecture = @prefecture
        )
      ORDER BY relevance_score DESC, action_date DESC NULLS LAST
      LIMIT @limit
    `)
    .all({
      id: currentItem.id,
      org: currentItem.organization_name_raw || "",
      industry: currentItem.industry || "",
      action_type: currentItem.action_type || "",
      prefecture: currentItem.prefecture || "",
      limit,
    });
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

// ─── admin 用 ─────────────────────

export function listGyoseiShobunAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) {
    where.push("(organization_name_raw LIKE @kw OR summary LIKE @kw OR authority_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM administrative_actions ${whereClause}`).get(params).c;
  const items = db.prepare(`SELECT * FROM administrative_actions ${whereClause} ORDER BY action_date DESC NULLS LAST, id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function getGyoseiShobunAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM administrative_actions WHERE id = ?").get(id);
}

// ─── sitemap 用 ─────────────────────

export function listGyoseiShobunSlugsForSitemap() {
  const db = getDb();
  return db
    .prepare("SELECT slug, updated_at FROM administrative_actions WHERE is_published = 1 ORDER BY updated_at DESC")
    .all();
}
