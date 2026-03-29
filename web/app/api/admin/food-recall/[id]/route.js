import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getFoodRecallAdminById, updateFoodRecallItem } from "@/lib/repositories/food-recall";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getFoodRecallAdminById(Number(id));
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
    if (!body.product_name) return NextResponse.json({ error: "product_name は必須です" }, { status: 400 });
    const before = getFoodRecallAdminById(numId);
    const item = {
      slug: body.slug ?? before?.slug ?? "",
      product_name: String(body.product_name).trim(),
      manufacturer: body.manufacturer ?? before?.manufacturer ?? null,
      category: body.category ?? before?.category ?? null,
      recall_type: body.recall_type ?? before?.recall_type ?? null,
      reason: body.reason ?? before?.reason ?? null,
      risk_level: body.risk_level ?? before?.risk_level ?? "low",
      affected_area: body.affected_area ?? before?.affected_area ?? null,
      lot_number: body.lot_number ?? before?.lot_number ?? null,
      recall_date: body.recall_date ?? before?.recall_date ?? null,
      status: body.status ?? before?.status ?? "ongoing",
      consumer_action: body.consumer_action ?? before?.consumer_action ?? null,
      source_url: body.source_url ?? before?.source_url ?? null,
      manufacturer_url: body.manufacturer_url ?? before?.manufacturer_url ?? null,
      summary: body.summary ?? before?.summary ?? null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : (before?.is_published ?? 1),
    };
    updateFoodRecallItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "food_recall_item", targetId: String(numId),
      details: { domain: "food-recall", slug: item.slug, product_name: item.product_name },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
