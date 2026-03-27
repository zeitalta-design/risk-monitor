import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  getAdminResultsOverview,
  updateResultPublicStatus,
} from "@/lib/results-service";

/**
 * Phase148: 管理者用結果API
 *
 * GET   /api/admin/results — イベント別結果概要
 * PATCH /api/admin/results — 公開/非公開切り替え
 */

export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const sportType = searchParams.get("sport_type") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Number(searchParams.get("offset")) || 0;

    const data = getAdminResultsOverview({ sportType, limit, offset });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Admin results GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const { result_id, is_public } = body;

    if (result_id == null || is_public == null) {
      return NextResponse.json({ error: "result_id and is_public are required" }, { status: 400 });
    }

    const res = updateResultPublicStatus(Number(result_id), !!is_public);
    return NextResponse.json(res);
  } catch (err) {
    console.error("Admin results PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
