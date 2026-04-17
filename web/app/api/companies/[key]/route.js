/**
 * 企業横断参照 API
 *
 * GET /api/companies/[key]
 *   key = corporate_number (13桁) もしくは normalized_name
 *
 * 戻り値: nyusatsu / hojokin / kyoninka / sanpai の関連 id 一覧と件数
 *   （集計や統合ダッシュボード向け計算はしない。件数 + id のみ。）
 */
import { NextResponse } from "next/server";
import { getCompanyCrossDomain } from "@/lib/repositories/companies";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { key } = await params;
    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const result = getCompanyCrossDomain(decodeURIComponent(key), { limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/companies/[key] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
