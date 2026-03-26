import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/platform/search?q=keyword&domain=all&limit=20
 * 7ドメイン横断検索
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const domainFilter = searchParams.get("domain") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const db = getDb();
    const kw = `%${q}%`;
    const results = [];

    const DOMAINS = [
      { id: "food-recall", table: "food_recall_items", titleCol: "product_name", slugCol: "slug", summaryCol: "summary", basePath: "/food-recall", label: "食品リコール", icon: "🥫" },
      { id: "shitei", table: "shitei_items", titleCol: "title", slugCol: "slug", summaryCol: "summary", basePath: "/shitei", label: "指定管理", icon: "🏛️" },
      { id: "sanpai", table: "sanpai_items", titleCol: "company_name", slugCol: "slug", summaryCol: "notes", basePath: "/sanpai", label: "産廃", icon: "🚛" },
      { id: "kyoninka", table: "kyoninka_entities", titleCol: "entity_name", slugCol: "slug", summaryCol: "notes", basePath: "/kyoninka", label: "許認可", icon: "📋" },
      { id: "saas", table: "items", titleCol: "title", slugCol: "slug", summaryCol: "summary", basePath: "/saas", label: "SaaS", icon: "💻" },
      { id: "hojokin", table: "hojokin_items", titleCol: "title", slugCol: "slug", summaryCol: "summary", basePath: "/hojokin", label: "補助金", icon: "💰" },
      { id: "yutai", table: "yutai_items", titleCol: "title", slugCol: "slug", summaryCol: "benefit_summary", basePath: "/yutai", label: "株主優待", icon: "🎁" },
      { id: "minpaku", table: "minpaku_items", titleCol: "title", slugCol: "slug", summaryCol: "summary", basePath: "/minpaku", label: "民泊", icon: "🏠" },
    ];

    const targets = domainFilter === "all" ? DOMAINS : DOMAINS.filter(d => d.id === domainFilter);

    for (const domain of targets) {
      try {
        const rows = db.prepare(`
          SELECT ${domain.titleCol} as title, ${domain.slugCol} as slug, ${domain.summaryCol} as summary
          FROM ${domain.table}
          WHERE is_published = 1 AND (${domain.titleCol} LIKE ? OR ${domain.summaryCol} LIKE ?)
          ORDER BY updated_at DESC LIMIT ?
        `).all(kw, kw, Math.ceil(limit / targets.length));

        for (const row of rows) {
          results.push({
            title: row.title,
            slug: row.slug,
            summary: row.summary ? row.summary.substring(0, 100) : null,
            domain: domain.id,
            domainLabel: domain.label,
            domainIcon: domain.icon,
            url: `${domain.basePath}/${row.slug}`,
          });
        }
      } catch { /* skip domain errors */ }
    }

    return NextResponse.json({ results: results.slice(0, limit), total: results.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
