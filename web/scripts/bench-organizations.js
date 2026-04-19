/**
 * /api/organizations 高速化の検証ベンチ。
 * 最適化前後の SQL を直接走らせて比較する。
 */
import { getDb } from "../lib/db.js";

const db = getDb();

function bench(label, fn) {
  const t0 = performance.now();
  const r = fn();
  const ms = (performance.now() - t0).toFixed(1);
  console.log(`  ${label.padEnd(48)} ${ms.padStart(8)} ms`);
  return r;
}

function buildWhere({ keyword, corp, onlyCorp }) {
  const where = ["o.is_active = 1"];
  const params = {};
  if (corp) { where.push("o.corporate_number = @corp"); params.corp = corp; }
  else if (keyword) {
    where.push("(o.display_name LIKE @kw OR o.normalized_name LIKE @kw OR o.corporate_number = @corpExact)");
    params.kw = `%${keyword}%`; params.corpExact = keyword;
  }
  if (onlyCorp) where.push("o.corporate_number IS NOT NULL AND o.corporate_number != ''");
  return { whereSql: `WHERE ${where.join(" AND ")}`, params };
}

// ── Before: created_at DESC + 5 個別 COUNT クエリ
function runBefore(opts) {
  const { whereSql, params } = buildWhere(opts);
  const ps = 20, p = opts.page || 1;
  db.prepare(`SELECT COUNT(*) n FROM organizations o ${whereSql}`).get(params);
  const rows = db.prepare(`
    SELECT o.id, o.display_name, o.normalized_name, o.corporate_number,
           o.prefecture, o.city, o.source, o.created_at
    FROM organizations o ${whereSql}
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: ps, offset: (p - 1) * ps });
  if (rows.length === 0) return;
  const orgIds = rows.map((r) => r.id);
  const corps = rows.map((r) => r.corporate_number).filter(Boolean);
  const orgIn = `(${orgIds.map(() => "?").join(",")})`;
  const corpIn = corps.length > 0 ? `(${corps.map(() => "?").join(",")})` : null;
  db.prepare(`SELECT organization_id, COUNT(*) n FROM hojokin_items WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`).all(...orgIds);
  db.prepare(`SELECT organization_id, COUNT(*) n FROM kyoninka_entities WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`).all(...orgIds);
  db.prepare(`SELECT organization_id, COUNT(*) n FROM administrative_actions WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`).all(...orgIds);
  if (corpIn) {
    db.prepare(`SELECT winner_corporate_number AS corp, COUNT(*) n FROM nyusatsu_results WHERE winner_corporate_number IN ${corpIn} AND is_published = 1 GROUP BY winner_corporate_number`).all(...corps);
    db.prepare(`SELECT corporate_number AS corp, COUNT(*) n FROM sanpai_items WHERE corporate_number IN ${corpIn} AND is_published = 1 GROUP BY corporate_number`).all(...corps);
  }
}

// ── After: id DESC + UNION ALL の 1 件数クエリ
function runAfter(opts, sort = "newest") {
  const { whereSql, params } = buildWhere(opts);
  const ps = 20, p = opts.page || 1;
  db.prepare(`SELECT COUNT(*) n FROM organizations o ${whereSql}`).get(params);
  const orderSql = sort === "linked"
    ? `ORDER BY CASE WHEN o.corporate_number IS NULL OR o.corporate_number = '' THEN 1 ELSE 0 END, o.id DESC`
    : `ORDER BY o.id DESC`;
  const rows = db.prepare(`
    SELECT o.id, o.display_name, o.normalized_name, o.corporate_number,
           o.prefecture, o.city, o.source
    FROM organizations o ${whereSql}
    ${orderSql}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: ps, offset: (p - 1) * ps });
  if (rows.length === 0) return;
  const orgIds = rows.map((r) => r.id);
  const corps = rows.map((r) => r.corporate_number).filter(Boolean);
  const orgIn = `(${orgIds.map(() => "?").join(",")})`;
  const corpIn = corps.length > 0 ? `(${corps.map(() => "?").join(",")})` : null;
  const parts = [
    `SELECT 'hojokin' d, organization_id oid, NULL corp, COUNT(*) n FROM hojokin_items WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
    `SELECT 'kyoninka' d, organization_id oid, NULL corp, COUNT(*) n FROM kyoninka_entities WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
    `SELECT 'gyosei_shobun' d, organization_id oid, NULL corp, COUNT(*) n FROM administrative_actions WHERE organization_id IN ${orgIn} AND is_published = 1 GROUP BY organization_id`,
  ];
  const args = [...orgIds, ...orgIds, ...orgIds];
  if (corpIn) {
    parts.push(
      `SELECT 'nyusatsu' d, NULL oid, winner_corporate_number corp, COUNT(*) n FROM nyusatsu_results WHERE winner_corporate_number IN ${corpIn} AND is_published = 1 GROUP BY winner_corporate_number`,
      `SELECT 'sanpai' d, NULL oid, corporate_number corp, COUNT(*) n FROM sanpai_items WHERE corporate_number IN ${corpIn} AND is_published = 1 GROUP BY corporate_number`,
    );
    args.push(...corps, ...corps);
  }
  db.prepare(parts.join(" UNION ALL ")).all(...args);
}

console.log("── BEFORE (created_at DESC + 5 COUNTs) ──");
bench("page 1 / no filter",          () => runBefore({}));
bench("page 50 / no filter (deep)",  () => runBefore({ page: 50 }));
bench("page 1 / keyword='建設'",     () => runBefore({ keyword: "建設" }));

console.log("\n── AFTER (id DESC + UNION ALL) ──");
bench("page 1 / no filter / newest", () => runAfter({}));
bench("page 50 / no filter / newest",() => runAfter({ page: 50 }));
bench("page 1 / keyword='建設'",     () => runAfter({ keyword: "建設" }));
bench("page 1 / no filter / linked", () => runAfter({}, "linked"));
bench("page 1 / corp exact",         () => runAfter({ corp: "1234567890123" }));

process.exit(0);
