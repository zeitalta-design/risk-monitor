import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/platform/feed
 * 横断新着フィード + ドメイン統計ランキング
 * トップページの共通新着ブロック・横断ランキングに使用
 */
export async function GET() {
  try {
    const db = getDb();

    const DOMAINS = [
      { id: "food-recall", table: "food_recall_items", titleCol: "product_name", slugCol: "slug", dateCol: "created_at", label: "食品リコール", icon: "🥫", path: "/food-recall", type: "監視型" },
      { id: "shitei", table: "shitei_items", titleCol: "title", slugCol: "slug", dateCol: "created_at", label: "指定管理", icon: "🏛️", path: "/shitei", type: "公募型" },
      { id: "sanpai", table: "sanpai_items", titleCol: "company_name", slugCol: "slug", dateCol: "created_at", label: "産廃処分", icon: "🚛", path: "/sanpai", type: "監視型" },
      { id: "kyoninka", table: "kyoninka_entities", titleCol: "entity_name", slugCol: "slug", dateCol: "created_at", label: "許認可", icon: "📋", path: "/kyoninka", type: "検索型" },
      { id: "saas", table: "items", titleCol: "title", slugCol: "slug", dateCol: "created_at", label: "SaaS", icon: "💻", path: "/saas", type: "比較型" },
      { id: "hojokin", table: "hojokin_items", titleCol: "title", slugCol: "slug", dateCol: "created_at", label: "補助金", icon: "💰", path: "/hojokin", type: "監視型" },
      { id: "yutai", table: "yutai_items", titleCol: "title", slugCol: "slug", dateCol: "created_at", label: "株主優待", icon: "🎁", path: "/yutai", type: "比較型" },
      { id: "minpaku", table: "minpaku_items", titleCol: "title", slugCol: "slug", dateCol: "created_at", label: "民泊", icon: "🏠", path: "/minpaku", type: "比較型" },
    ];

    // ─── 1. 横断新着フィード（直近追加/更新 最大15件）─────
    const recentItems = [];
    for (const d of DOMAINS) {
      try {
        const rows = db.prepare(
          `SELECT ${d.titleCol} as title, ${d.slugCol} as slug, ${d.dateCol} as date, updated_at
           FROM ${d.table} WHERE is_published = 1
           ORDER BY ${d.dateCol} DESC LIMIT 3`
        ).all();
        for (const row of rows) {
          recentItems.push({
            domain: d.id,
            domainLabel: d.label,
            domainIcon: d.icon,
            domainPath: d.path,
            domainType: d.type,
            title: row.title,
            slug: row.slug,
            url: `${d.path}/${row.slug}`,
            date: row.date,
            updatedAt: row.updated_at,
          });
        }
      } catch (err) { /* ignore domain errors */ }
    }
    // 日付でソートして上位15件
    recentItems.sort((a, b) => (b.updatedAt || b.date || "").localeCompare(a.updatedAt || a.date || ""));
    const feed = recentItems.slice(0, 15);

    // ─── 2. ドメイン統計ランキング ─────
    const stats = [];
    let totalItems = 0;
    for (const d of DOMAINS) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${d.table} WHERE is_published = 1`).get().c;
        let recentCount = 0;
        try {
          recentCount = db.prepare(`SELECT COUNT(*) as c FROM ${d.table} WHERE is_published = 1 AND created_at > datetime('now', '-30 days')`).get().c;
        } catch { /* ignore */ }
        totalItems += count;
        stats.push({ ...d, count, recentCount, table: undefined, titleCol: undefined, slugCol: undefined, dateCol: undefined });
      } catch {
        stats.push({ id: d.id, label: d.label, icon: d.icon, path: d.path, type: d.type, count: 0, recentCount: 0 });
      }
    }
    // 件数順ソート
    const byCount = [...stats].sort((a, b) => b.count - a.count);
    // 新着順ソート
    const byRecent = [...stats].filter(s => s.recentCount > 0).sort((a, b) => b.recentCount - a.recentCount);

    // ─── 3. タイプ別集計 ─────
    const typeMap = {};
    for (const s of stats) {
      if (!typeMap[s.type]) typeMap[s.type] = { type: s.type, count: 0, domains: [] };
      typeMap[s.type].count += s.count;
      typeMap[s.type].domains.push({ id: s.id, label: s.label, icon: s.icon, path: s.path, count: s.count });
    }
    const byType = Object.values(typeMap).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      feed,
      ranking: { byCount: byCount.slice(0, 5), byRecent: byRecent.slice(0, 5) },
      byType,
      totalItems,
      totalDomains: stats.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
