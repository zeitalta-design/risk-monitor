import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/platform/overview
 * 全ドメイン横断のサマリー（公開件数、最終更新、新着数）
 */
export async function GET() {
  try {
    const db = getDb();

    const DOMAINS = [
      { id: "food-recall", table: "food_recall_items", label: "食品リコール監視", icon: "🥫", path: "/food-recall", type: "監視型", description: "消費者庁のリコール・自主回収情報を日次自動取得" },
      { id: "shitei", table: "shitei_items", label: "指定管理公募まとめ", icon: "🏛️", path: "/shitei", type: "公募型", description: "自治体の指定管理者・業務委託公募情報を横断検索" },
      { id: "sanpai", table: "sanpai_items", label: "産廃処分ウォッチ", icon: "🚛", path: "/sanpai", type: "監視型", description: "産業廃棄物処理業者の行政処分情報を全国追跡" },
      { id: "kyoninka", table: "kyoninka_entities", label: "許認可検索", icon: "📋", path: "/kyoninka", type: "検索型", description: "建設業許可・宅建業等の許認可事業者を10県で検索" },
      { id: "saas", table: "items", label: "SaaS比較ナビ", icon: "💻", path: "/saas", type: "比較型", description: "SaaS製品を8カテゴリ69件で比較・おすすめ" },
      { id: "hojokin", table: "hojokin_items", label: "補助金ナビ", icon: "💰", path: "/hojokin", type: "監視型", description: "中小企業向け補助金・助成金情報を検索" },
      { id: "yutai", table: "yutai_items", label: "株主優待ナビ", icon: "🎁", path: "/yutai", type: "比較型", description: "人気の株主優待銘柄を比較・検索" },
      { id: "minpaku", table: "minpaku_items", label: "民泊ナビ", icon: "🏠", path: "/minpaku", type: "比較型", description: "民泊・バケーションレンタル物件を比較" },
    ];

    const domains = [];
    let totalItems = 0;

    for (const d of DOMAINS) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${d.table} WHERE is_published = 1`).get().c;
        const latest = db.prepare(`SELECT MAX(updated_at) as latest FROM ${d.table} WHERE is_published = 1`).get().latest;

        // 直近7日の新着件数
        let recentCount = 0;
        try {
          recentCount = db.prepare(`SELECT COUNT(*) as c FROM ${d.table} WHERE is_published = 1 AND created_at > datetime('now', '-7 days')`).get().c;
        } catch { /* ignore */ }

        totalItems += count;
        domains.push({
          ...d,
          count,
          latestUpdate: latest,
          recentCount,
        });
      } catch {
        domains.push({ ...d, count: 0, latestUpdate: null, recentCount: 0 });
      }
    }

    return NextResponse.json({
      domains,
      totalItems,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
