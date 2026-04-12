/**
 * GET  /api/risk-alerts        — アラート一覧（一般ユーザー）
 * POST /api/risk-alerts/read   — 既読化は /api/risk-alerts/read へ
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const items = db.prepare(`
      SELECT * FROM risk_alerts
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(user.id);

    const unreadCount = db.prepare(
      "SELECT COUNT(*) as c FROM risk_alerts WHERE user_id = ? AND is_read = 0"
    ).get(user.id).c;

    return NextResponse.json({ items, total: items.length, unreadCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
