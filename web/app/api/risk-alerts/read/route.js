/**
 * POST /api/risk-alerts/read — 既読化
 * body: { id } or { all: true }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const db = getDb();

    if (body.all) {
      db.prepare("UPDATE risk_alerts SET is_read = 1 WHERE user_id = ?").run(user.id);
      return NextResponse.json({ action: "all_read" });
    }

    if (body.id) {
      db.prepare("UPDATE risk_alerts SET is_read = 1 WHERE id = ? AND user_id = ?").run(body.id, user.id);
      return NextResponse.json({ action: "read", id: body.id });
    }

    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
