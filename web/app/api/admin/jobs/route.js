import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const db = getDb();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const status = url.searchParams.get("status");
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const total = db
      .prepare(`SELECT COUNT(*) as c FROM notification_jobs ${whereClause}`)
      .get(...params).c;

    const jobs = db
      .prepare(
        `SELECT * FROM notification_jobs ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
