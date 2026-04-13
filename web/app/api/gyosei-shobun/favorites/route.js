/**
 * 行政処分DB — お気に入りAPI（認証対応版）
 *
 * ログインユーザー: user_key = String(user.id)（自動取得）
 * 未ログイン: user_key をリクエストから受け取る（anon_xxxx）
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addFavorite, removeFavorite, listFavorites } from "@/lib/repositories/gyosei-shobun";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** セッションまたはリクエストから user_key を解決 */
async function resolveUserKey(request, fromBody = false) {
  // 1. ログインユーザーのIDを優先
  try {
    const user = await getCurrentUser();
    if (user?.id) return { userKey: String(user.id), isAuthenticated: true };
  } catch { /* session取得失敗は無視 */ }

  // 2. フォールバック: リクエストから user_key
  if (fromBody) return { userKey: null, isAuthenticated: false }; // bodyは後で取得
  const { searchParams } = new URL(request.url);
  const userKey = searchParams.get("user_key");
  return { userKey, isAuthenticated: false };
}

/** お気に入り一覧 */
export async function GET(request) {
  try {
    const { userKey, isAuthenticated } = await resolveUserKey(request);
    const effectiveKey = userKey || new URL(request.url).searchParams.get("user_key");
    if (!effectiveKey) {
      return NextResponse.json({ error: "user_key is required" }, { status: 400 });
    }
    const page = Math.max(1, parseInt(new URL(request.url).searchParams.get("page") || "1", 10));
    const pageSize = Math.min(200, parseInt(new URL(request.url).searchParams.get("pageSize") || "20", 10));
    const result = listFavorites(effectiveKey, { page, pageSize });
    return NextResponse.json({ ok: true, isAuthenticated, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** お気に入り追加 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action_id } = body;
    if (!action_id) {
      return NextResponse.json({ error: "action_id is required" }, { status: 400 });
    }

    // ログインユーザーのIDを優先、なければbodyのuser_key
    let userKey;
    try {
      const user = await getCurrentUser();
      if (user?.id) userKey = String(user.id);
    } catch { /* ignore */ }
    if (!userKey) userKey = body.user_key;
    if (!userKey) {
      return NextResponse.json({ error: "user_key is required (login or provide user_key)" }, { status: 400 });
    }

    const result = addFavorite(userKey, Number(action_id));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    // ── 自動ウォッチ登録（ログインユーザーのみ） ──
    let watchAdded = false;
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const db = getDb();
        // action_id から organization_name_raw と industry を取得
        const action = db.prepare("SELECT organization_name_raw, industry FROM administrative_actions WHERE id = ?").get(Number(action_id));
        if (action?.organization_name_raw) {
          const { addWatch } = await import("@/lib/repositories/watched-organizations");
          const watchResult = addWatch(user.id, action.organization_name_raw, action.industry || "");
          watchAdded = watchResult.action === "added";
        }
      }
    } catch { /* ウォッチ登録失敗はお気に入り自体に影響させない */ }

    return NextResponse.json({ ok: true, already: result.already || false, watchAdded });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** お気に入り削除 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { action_id } = body;
    if (!action_id) {
      return NextResponse.json({ error: "action_id is required" }, { status: 400 });
    }

    let userKey;
    try {
      const user = await getCurrentUser();
      if (user?.id) userKey = String(user.id);
    } catch { /* ignore */ }
    if (!userKey) userKey = body.user_key;
    if (!userKey) {
      return NextResponse.json({ error: "user_key is required" }, { status: 400 });
    }

    const result = removeFavorite(userKey, Number(action_id));
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
