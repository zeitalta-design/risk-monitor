import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase228: 問い合わせ管理API
 * GET: 一覧取得（絞り込み・検索対応）
 * PATCH: ステータス・担当者・メモ更新
 */
export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const q = searchParams.get("q");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (status) {
      where.push("i.status = ?");
      params.push(status);
    }
    if (type) {
      where.push("i.inquiry_type = ?");
      params.push(type);
    }
    if (priority) {
      where.push("i.priority = ?");
      params.push(priority);
    }
    if (q) {
      where.push("(i.subject LIKE ? OR i.name LIKE ? OR i.email LIKE ? OR i.body LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const total = db.prepare(`SELECT COUNT(*) as count FROM inquiries i ${whereClause}`).get(...params)?.count || 0;

    const inquiries = db.prepare(`
      SELECT i.*, e.title as event_title
      FROM inquiries i
      LEFT JOIN events e ON i.event_id = e.id
      ${whereClause}
      ORDER BY
        CASE i.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        CASE i.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
        i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // サマリー
    const summary = db.prepare(`
      SELECT status, COUNT(*) as count FROM inquiries GROUP BY status
    `).all();

    return NextResponse.json({
      inquiries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: Object.fromEntries(summary.map((s) => [s.status, s.count])),
    });
  } catch (err) {
    console.error("Inquiries API error:", err);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { id, status, priority, assignee, admin_memo } = body;

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push("status = ?");
      params.push(status);
      if (status === "resolved") {
        updates.push("resolved_at = datetime('now')");
      }
    }
    if (priority) {
      updates.push("priority = ?");
      params.push(priority);
    }
    if (assignee !== undefined) {
      updates.push("assignee = ?");
      params.push(assignee);
    }
    if (admin_memo !== undefined) {
      updates.push("admin_memo = ?");
      params.push(admin_memo);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE inquiries SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    // メモをnote履歴に追加
    if (admin_memo) {
      db.prepare(
        `INSERT INTO inquiry_notes (inquiry_id, note_type, note_text, created_by) VALUES (?, 'memo', ?, 'admin')`
      ).run(id, admin_memo);
    }

    const updated = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id);
    return NextResponse.json({ inquiry: updated });
  } catch (err) {
    console.error("Inquiry update error:", err);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
