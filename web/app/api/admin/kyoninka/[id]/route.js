import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getKyoninkaAdminById, updateKyoninkaEntity } from "@/lib/repositories/kyoninka";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getKyoninkaAdminById(Number(id));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const body = await request.json();
    if (!body.entity_name) return NextResponse.json({ error: "entity_name は必須です" }, { status: 400 });
    const before = getKyoninkaAdminById(numId);
    const item = {
      slug: body.slug ?? before?.slug ?? "",
      entity_name: String(body.entity_name).trim(),
      normalized_name: body.normalized_name ?? before?.normalized_name ?? "",
      corporate_number: body.corporate_number ?? before?.corporate_number ?? null,
      prefecture: body.prefecture ?? before?.prefecture ?? null,
      city: body.city ?? before?.city ?? null,
      address: body.address ?? before?.address ?? null,
      entity_status: body.entity_status ?? before?.entity_status ?? "active",
      primary_license_family: body.primary_license_family ?? before?.primary_license_family ?? null,
      registration_count: body.registration_count ?? before?.registration_count ?? 0,
      latest_update_date: body.latest_update_date ?? before?.latest_update_date ?? null,
      source_name: body.source_name ?? before?.source_name ?? null,
      source_url: body.source_url ?? before?.source_url ?? null,
      notes: body.notes ?? before?.notes ?? null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : (before?.is_published ?? 1),
    };
    updateKyoninkaEntity(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "kyoninka_entity", targetId: String(numId),
      details: { domain: "kyoninka", slug: item.slug, entity_name: item.entity_name },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
