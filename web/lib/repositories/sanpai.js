/**
 * 産廃処理業者・行政処分ウォッチ — DB アクセス層
 */

import { getDb } from "@/lib/db";

// ─── 公開用関数 ─────────────────────

export function listSanpaiItems({
  keyword = "",
  prefecture = "",
  license_type = "",
  risk_level = "",
  status = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(company_name LIKE @kw OR business_area LIKE @kw OR notes LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (prefecture) {
    where.push("prefecture = @prefecture");
    params.prefecture = prefecture;
  }
  if (license_type) {
    where.push("license_type = @license_type");
    params.license_type = license_type;
  }
  if (risk_level) {
    where.push("risk_level = @risk_level");
    params.risk_level = risk_level;
  }
  if (status) {
    where.push("status = @status");
    params.status = status;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = "updated_at DESC";
      break;
    case "risk_high":
      orderBy = "CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, updated_at DESC";
      break;
    case "penalty_recent":
      orderBy = "latest_penalty_date DESC NULLS LAST, updated_at DESC";
      break;
    default:
      orderBy = "id DESC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM sanpai_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM sanpai_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getSanpaiBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM sanpai_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getSanpaiById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM sanpai_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getSanpaiByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM sanpai_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

// ─── 処分履歴 ─────────────────────

export function listPenaltiesByItemId(sanpaiItemId) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM sanpai_penalties WHERE sanpai_item_id = ? ORDER BY penalty_date DESC, id DESC"
  ).all(sanpaiItemId);
}

export function createPenalty(penalty) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sanpai_penalties (sanpai_item_id, penalty_date, penalty_type, authority_name, summary, disposition_period, source_url, created_at, updated_at)
    VALUES (@sanpai_item_id, @penalty_date, @penalty_type, @authority_name, @summary, @disposition_period, @source_url, datetime('now'), datetime('now'))
  `).run(penalty);
  return { id: result.lastInsertRowid };
}

export function updatePenalty(id, penalty) {
  const db = getDb();
  db.prepare(`
    UPDATE sanpai_penalties SET
      penalty_date = @penalty_date, penalty_type = @penalty_type,
      authority_name = @authority_name, summary = @summary,
      disposition_period = @disposition_period, source_url = @source_url,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...penalty, id });
  return { id };
}

export function deletePenalty(id) {
  const db = getDb();
  db.prepare("DELETE FROM sanpai_penalties WHERE id = ?").run(id);
}

// ─── Upsert（import 用） ─────────────────────

export function upsertSanpaiItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM sanpai_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE sanpai_items SET
        company_name = @company_name, corporate_number = @corporate_number,
        prefecture = @prefecture, city = @city,
        license_type = @license_type, waste_category = @waste_category,
        business_area = @business_area, status = @status,
        risk_level = @risk_level, penalty_count = @penalty_count,
        latest_penalty_date = @latest_penalty_date,
        source_name = @source_name, source_url = @source_url,
        detail_url = @detail_url, notes = @notes,
        is_published = @is_published, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO sanpai_items
      (slug, company_name, corporate_number, prefecture, city,
       license_type, waste_category, business_area, status,
       risk_level, penalty_count, latest_penalty_date,
       source_name, source_url, detail_url, notes,
       is_published, published_at, created_at, updated_at)
    VALUES
      (@slug, @company_name, @corporate_number, @prefecture, @city,
       @license_type, @waste_category, @business_area, @status,
       @risk_level, @penalty_count, @latest_penalty_date,
       @source_name, @source_url, @detail_url, @notes,
       @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

/**
 * 事業者の penalty_count, latest_penalty_date, risk_level を再計算して更新
 */
export function refreshSanpaiItemPenaltyStats(itemId) {
  const db = getDb();
  const penalties = listPenaltiesByItemId(itemId);
  const penaltyCount = penalties.length;
  const latestPenaltyDate = penalties.length > 0 ? penalties[0].penalty_date : null;

  // 簡易リスクレベル計算
  let riskLevel = "none";
  if (penalties.length > 0) {
    const types = penalties.map((p) => p.penalty_type);
    if (types.includes("license_revocation")) riskLevel = "critical";
    else if (types.includes("business_suspension")) riskLevel = "high";
    else if (types.includes("improvement_order")) riskLevel = "medium";
    else riskLevel = "low";
  }

  db.prepare(`
    UPDATE sanpai_items SET
      penalty_count = @penaltyCount,
      latest_penalty_date = @latestPenaltyDate,
      risk_level = @riskLevel,
      updated_at = datetime('now')
    WHERE id = @itemId
  `).run({ penaltyCount, latestPenaltyDate, riskLevel, itemId });
}

export function listSanpaiSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM sanpai_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listSanpaiAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(company_name LIKE @kw OR slug LIKE @kw OR prefecture LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM sanpai_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM sanpai_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getSanpaiAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM sanpai_items WHERE id = ?").get(id) || null;
}

export function createSanpaiItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sanpai_items (slug, company_name, corporate_number, prefecture, city,
      license_type, waste_category, business_area, status,
      risk_level, penalty_count, latest_penalty_date,
      source_name, source_url, detail_url, notes,
      is_published, published_at, created_at, updated_at)
    VALUES (@slug, @company_name, @corporate_number, @prefecture, @city,
      @license_type, @waste_category, @business_area, @status,
      @risk_level, @penalty_count, @latest_penalty_date,
      @source_name, @source_url, @detail_url, @notes,
      @is_published, @published_at, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateSanpaiItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE sanpai_items SET slug = @slug, company_name = @company_name,
      corporate_number = @corporate_number, prefecture = @prefecture, city = @city,
      license_type = @license_type, waste_category = @waste_category,
      business_area = @business_area, status = @status,
      risk_level = @risk_level, penalty_count = @penalty_count,
      latest_penalty_date = @latest_penalty_date,
      source_name = @source_name, source_url = @source_url,
      detail_url = @detail_url, notes = @notes,
      is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
