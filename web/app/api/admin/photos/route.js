import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  getAdminPhotos,
  updatePhotoStatus,
  updatePhotoMeta,
  createPhoto,
} from "@/lib/photo-service";

/**
 * Phase158: 管理者用写真API
 * GET   /api/admin/photos — 一覧
 * POST  /api/admin/photos — 追加
 * PATCH /api/admin/photos — メタ更新/ステータス変更
 */

export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const data = getAdminPhotos({
      eventId: searchParams.get("event_id") ? Number(searchParams.get("event_id")) : undefined,
      sportType: searchParams.get("sport_type") || undefined,
      status: searchParams.get("status") || undefined,
      imageType: searchParams.get("image_type") || undefined,
      limit: Math.min(Number(searchParams.get("limit")) || 50, 200),
      offset: Number(searchParams.get("offset")) || 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Admin photos GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    if (!body.event_id || !body.image_url) {
      return NextResponse.json({ error: "event_id and image_url are required" }, { status: 400 });
    }
    const result = createPhoto(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Admin photos POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const { photo_id, ...updates } = body;

    if (!photo_id) {
      return NextResponse.json({ error: "photo_id is required" }, { status: 400 });
    }

    // status変更のみの場合はシンプルなパス
    if (updates.status && Object.keys(updates).length === 1) {
      return NextResponse.json(updatePhotoStatus(Number(photo_id), updates.status));
    }

    return NextResponse.json(updatePhotoMeta(Number(photo_id), updates));
  } catch (err) {
    console.error("Admin photos PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
