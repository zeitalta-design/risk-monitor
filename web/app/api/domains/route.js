import { NextResponse } from "next/server";
import "@/lib/domains"; // side-effect: 全ドメイン登録
import { getAllDomains } from "@/lib/core/domain-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/domains
 * 登録済み全ドメインのメタ情報を返す。
 * フロントエンドのナビゲーション生成やドメイン選択UIに使用。
 */
export async function GET() {
  try {
    const domains = getAllDomains().map((d) => ({
      id: d.id,
      name: d.name,
      basePath: d.basePath,
      adminBasePath: d.adminBasePath,
      categoryCount: d.categories.length,
      terminology: d.terminology,
    }));

    return NextResponse.json({ domains, count: domains.length });
  } catch (error) {
    console.error("GET /api/domains error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
