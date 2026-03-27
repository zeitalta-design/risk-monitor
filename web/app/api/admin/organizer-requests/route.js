import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase135: 運営修正依頼管理API
 *
 * GET   /api/admin/organizer-requests — 依頼一覧
 * PATCH /api/admin/organizer-requests — ステータス更新
 */

export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const db = getDb();

    // 統計
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
        COUNT(CASE WHEN status = 'needs_recheck' THEN 1 END) as needs_recheck
      FROM organizer_update_requests
    `).get();

    // 一覧
    const statusFilter = status ? "WHERE status = ?" : "";
    const params = status ? [status, limit] : [limit];
    const requests = db.prepare(`
      SELECT * FROM organizer_update_requests
      ${statusFilter}
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'needs_recheck' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT ?
    `).all(...params);

    return NextResponse.json({ requests, stats });
  } catch (error) {
    console.error("GET /api/admin/organizer-requests error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { id, status, admin_note } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const validStatuses = ["pending", "in_progress", "applied", "needs_recheck"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`
      UPDATE organizer_update_requests
      SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = datetime('now')
      WHERE id = ?
    `).run(status, admin_note || null, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/organizer-requests error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
