/**
 * 行政処分DB — お気に入り登録確認API（認証対応版）
 *
 * GET /api/gyosei-shobun/favorites/check?action_id=123
 *   ログインユーザー: セッションからuser_idを自動取得
 *   未ログイン: ?user_key=anon_xxxx を使用
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkFavorite } from "@/lib/repositories/gyosei-shobun";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get("action_id");
    if (!actionId) {
      return NextResponse.json({ error: "action_id is required" }, { status: 400 });
    }

    // ログインユーザーのIDを優先
    let userKey;
    let isAuthenticated = false;
    try {
      const user = await getCurrentUser();
      if (user?.id) { userKey = String(user.id); isAuthenticated = true; }
    } catch { /* ignore */ }
    if (!userKey) userKey = searchParams.get("user_key");
    if (!userKey) {
      return NextResponse.json({ ok: true, isFavorite: false, isAuthenticated: false });
    }

    const result = checkFavorite(userKey, Number(actionId));
    return NextResponse.json({ ok: true, ...result, isAuthenticated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
