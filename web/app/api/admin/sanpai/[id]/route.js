import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSanpaiAdminById, updateSanpaiItem } from "@/lib/repositories/sanpai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getSanpaiAdminById(Number(id));
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
    if (!body.company_name) return NextResponse.json({ error: "company_name は必須です" }, { status: 400 });
    // 既存値をベースにマージ（repositoryのUPDATE文が全カラムを要求するため）
    const before = getSanpaiAdminById(numId);
    const item = {
      slug: body.slug ?? before?.slug ?? "",
      company_name: String(body.company_name).trim(),
      corporate_number: body.corporate_number ?? before?.corporate_number ?? null,
      prefecture: body.prefecture ?? before?.prefecture ?? null,
      city: body.city ?? before?.city ?? null,
      license_type: body.license_type ?? before?.license_type ?? null,
      waste_category: body.waste_category ?? before?.waste_category ?? null,
      business_area: body.business_area ?? before?.business_area ?? null,
      status: body.status ?? before?.status ?? "active",
      risk_level: body.risk_level ?? before?.risk_level ?? "low",
      penalty_count: body.penalty_count ?? before?.penalty_count ?? 0,
      latest_penalty_date: body.latest_penalty_date ?? before?.latest_penalty_date ?? null,
      source_name: body.source_name ?? before?.source_name ?? null,
      source_url: body.source_url ?? before?.source_url ?? null,
      detail_url: body.detail_url ?? before?.detail_url ?? null,
      notes: body.notes ?? before?.notes ?? null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : (before?.is_published ?? 1),
    };
    updateSanpaiItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id,
      action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "sanpai_item",
      targetId: String(numId),
      details: { domain: "sanpai", slug: item.slug, company_name: item.company_name },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
