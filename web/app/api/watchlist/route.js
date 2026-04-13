/**
 * 一般ユーザー向けウォッチAPI
 *
 * GET    /api/watchlist?org=xxx&industry=yyy  → ウォッチ状態確認
 * POST   /api/watchlist { organization_name, industry }  → ウォッチ登録
 * DELETE /api/watchlist { organization_name, industry }  → ウォッチ解除
 *
 * 認証: ログイン必須（getCurrentUser）
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addWatch, removeWatch, isWatched } from "@/lib/repositories/watched-organizations";

export const dynamic = "force-dynamic";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "login_required" }, { status: 401 }) };
  return { user, error: null };
}

/** ウォッチ状態確認 */
export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");
    const industry = searchParams.get("industry") || "";

    if (!org) return NextResponse.json({ error: "org is required" }, { status: 400 });

    const watched = isWatched(user.id, org, industry);
    return NextResponse.json({ ok: true, isWatched: watched });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** ウォッチ登録 */
export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { organization_name, industry } = body;
    if (!organization_name) return NextResponse.json({ error: "organization_name is required" }, { status: 400 });

    const result = addWatch(user.id, organization_name, industry || "");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** ウォッチ解除 */
export async function DELETE(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { organization_name, industry } = body;
    if (!organization_name) return NextResponse.json({ error: "organization_name is required" }, { status: 400 });

    const result = removeWatch(user.id, organization_name, industry || "");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
