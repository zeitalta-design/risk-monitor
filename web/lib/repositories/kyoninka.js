/**
 * 許認可・登録事業者横断検索 — DB アクセス層
 */

import { getDb } from "@/lib/db";

// ─── 公開用関数 ─────────────────────

export function listKyoninkaEntities({
  keyword = "",
  prefecture = "",
  license_family = "",
  entity_status = "",
  has_corporate_number = "",
  has_disciplinary = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(entity_name LIKE @kw OR normalized_name LIKE @kw OR corporate_number LIKE @kw OR address LIKE @kw OR notes LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (prefecture) {
    where.push("prefecture = @prefecture");
    params.prefecture = prefecture;
  }
  if (license_family) {
    where.push("primary_license_family = @license_family");
    params.license_family = license_family;
  }
  if (entity_status) {
    where.push("entity_status = @entity_status");
    params.entity_status = entity_status;
  }
  if (has_corporate_number === "yes") {
    where.push("corporate_number IS NOT NULL AND corporate_number != ''");
  } else if (has_corporate_number === "no") {
    where.push("(corporate_number IS NULL OR corporate_number = '')");
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = "updated_at DESC";
      break;
    case "name":
      orderBy = "entity_name ASC";
      break;
    case "registration_count":
      orderBy = "registration_count DESC, updated_at DESC";
      break;
    default:
      orderBy = "id DESC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM kyoninka_entities ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM kyoninka_entities ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getKyoninkaBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM kyoninka_entities WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getKyoninkaById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM kyoninka_entities WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getKyoninkaByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM kyoninka_entities WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

// ─── 名寄せ ─────────────────────

/**
 * 法人番号で既存エンティティを検索
 */
export function findEntityByCorporateNumber(corporateNumber) {
  if (!corporateNumber) return null;
  const db = getDb();
  return db.prepare("SELECT * FROM kyoninka_entities WHERE corporate_number = ?").get(corporateNumber) || null;
}

/**
 * 正規化名で既存エンティティを検索
 */
export function findEntityByNormalizedName(normalizedName) {
  if (!normalizedName) return null;
  const db = getDb();
  return db.prepare("SELECT * FROM kyoninka_entities WHERE normalized_name = ?").get(normalizedName) || null;
}

// ─── 許認可登録情報 ─────────────────────

export function listRegistrationsByEntityId(entityId) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM kyoninka_registrations WHERE entity_id = ? ORDER BY valid_from DESC, id DESC"
  ).all(entityId);
}

export function createRegistration(reg) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO kyoninka_registrations
      (entity_id, license_family, license_type, registration_number, authority_name, prefecture,
       valid_from, valid_to, registration_status, disciplinary_flag, source_name, source_url, detail_url,
       created_at, updated_at)
    VALUES
      (@entity_id, @license_family, @license_type, @registration_number, @authority_name, @prefecture,
       @valid_from, @valid_to, @registration_status, @disciplinary_flag, @source_name, @source_url, @detail_url,
       datetime('now'), datetime('now'))
  `).run(reg);
  return { id: result.lastInsertRowid };
}

export function updateRegistration(id, reg) {
  const db = getDb();
  db.prepare(`
    UPDATE kyoninka_registrations SET
      license_family = @license_family, license_type = @license_type,
      registration_number = @registration_number, authority_name = @authority_name,
      prefecture = @prefecture, valid_from = @valid_from, valid_to = @valid_to,
      registration_status = @registration_status, disciplinary_flag = @disciplinary_flag,
      source_name = @source_name, source_url = @source_url, detail_url = @detail_url,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...reg, id });
  return { id };
}

export function deleteRegistration(id) {
  const db = getDb();
  db.prepare("DELETE FROM kyoninka_registrations WHERE id = ?").run(id);
}

// ─── Upsert（import 用） ─────────────────────

export function upsertKyoninkaEntity(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE kyoninka_entities SET
        entity_name = @entity_name, normalized_name = @normalized_name,
        corporate_number = @corporate_number, prefecture = @prefecture,
        city = @city, address = @address, entity_status = @entity_status,
        primary_license_family = @primary_license_family,
        registration_count = @registration_count, latest_update_date = @latest_update_date,
        source_name = @source_name, source_url = @source_url, notes = @notes,
        is_published = @is_published, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO kyoninka_entities
      (slug, entity_name, normalized_name, corporate_number, prefecture, city, address,
       entity_status, primary_license_family, registration_count, latest_update_date,
       source_name, source_url, notes, is_published, published_at, created_at, updated_at)
    VALUES
      (@slug, @entity_name, @normalized_name, @corporate_number, @prefecture, @city, @address,
       @entity_status, @primary_license_family, @registration_count, @latest_update_date,
       @source_name, @source_url, @notes, @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

/**
 * registration_count, latest_update_date を再計算して更新
 */
export function refreshEntityRegistrationStats(entityId) {
  const db = getDb();
  const regs = listRegistrationsByEntityId(entityId);
  const count = regs.length;
  const latestDate = regs.length > 0 ? (regs[0].valid_from || regs[0].created_at) : null;

  // primary_license_family: 最も多い family を採用
  const familyCounts = {};
  regs.forEach((r) => { familyCounts[r.license_family] = (familyCounts[r.license_family] || 0) + 1; });
  const primaryFamily = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

  db.prepare(`
    UPDATE kyoninka_entities SET
      registration_count = @count,
      latest_update_date = @latestDate,
      primary_license_family = @primaryFamily,
      updated_at = datetime('now')
    WHERE id = @entityId
  `).run({ count, latestDate, primaryFamily, entityId });
}

export function listKyoninkaSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM kyoninka_entities WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listKyoninkaAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(entity_name LIKE @kw OR slug LIKE @kw OR corporate_number LIKE @kw OR prefecture LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM kyoninka_entities ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM kyoninka_entities ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getKyoninkaAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM kyoninka_entities WHERE id = ?").get(id) || null;
}

export function createKyoninkaEntity(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO kyoninka_entities
      (slug, entity_name, normalized_name, corporate_number, prefecture, city, address,
       entity_status, primary_license_family, registration_count, latest_update_date,
       source_name, source_url, notes, is_published, published_at, created_at, updated_at)
    VALUES
      (@slug, @entity_name, @normalized_name, @corporate_number, @prefecture, @city, @address,
       @entity_status, @primary_license_family, @registration_count, @latest_update_date,
       @source_name, @source_url, @notes, @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateKyoninkaEntity(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE kyoninka_entities SET
      slug = @slug, entity_name = @entity_name, normalized_name = @normalized_name,
      corporate_number = @corporate_number, prefecture = @prefecture, city = @city,
      address = @address, entity_status = @entity_status,
      primary_license_family = @primary_license_family,
      registration_count = @registration_count, latest_update_date = @latest_update_date,
      source_name = @source_name, source_url = @source_url, notes = @notes,
      is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
