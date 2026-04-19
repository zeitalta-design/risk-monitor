/**
 * GET /api/organizations
 *
 * 企業一覧 / 検索 API（/organizations 画面用）。
 *
 * クエリ:
 *   - keyword: 表示名 / 正規化名 LIKE（または corp 完全一致）
 *   - corp:    corporate_number 完全一致
 *   - page, pageSize (最大 100)
 *   - only_corp: "1" なら corp ありだけに絞る
 *   - sort: "newest" (default, id DESC) | "linked" (entity_links 有りを優先)
 *
 * 戻り値: items[].counts = {nyusatsu, hojokin, kyoninka, gyosei_shobun, sanpai}
 * （page 単位で UNION ALL 1 クエリに集約。集計や統合ダッシュボードは載せない。）
 */
import { NextResponse } from "next/server";
import { listOrganizations } from "@/lib/repositories/organizations";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortRaw = searchParams.get("sort") || "newest";
    const sort = sortRaw === "linked" ? "linked" : "newest";
    const result = listOrganizations({
      keyword: searchParams.get("keyword") || "",
      corp: searchParams.get("corp") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || searchParams.get("page_size") || "20", 10),
      onlyCorp: searchParams.get("only_corp") === "1",
      sort,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/organizations error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
