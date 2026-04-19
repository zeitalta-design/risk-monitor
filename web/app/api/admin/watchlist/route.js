/**
 * GET  /api/admin/watchlist — ウォッチ一覧取得
 * POST /api/admin/watchlist — ウォッチ登録
 * DELETE /api/admin/watchlist — ウォッチ解除
 *
 * 一括確認済みは POST /api/admin/watchlist/seen を使用
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  listWatches,
  addWatch,
  removeWatch,
  removeWatchById,
  getWatchedOrgSet,
  updateWatchThreshold,
  updateWatchFrequency,
} from "@/lib/repositories/watched-organizations";

export async function GET(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  // mode=set: ウォッチ済み企業名セットを返す（一覧画面のボタン判定用）
  if (mode === "set") {
    const set = getWatchedOrgSet(user.id);
    return NextResponse.json({ watchedKeys: [...set] });
  }

  const items = listWatches(user.id);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const { organization_name, industry, deal_score_threshold, notify_frequency } = body;

  if (!organization_name) {
    return NextResponse.json({ error: "organization_name is required" }, { status: 400 });
  }

  // Phase J-7: deal_score_threshold は任意。未指定時は repo 側で DB default 80。
  // Phase J-8: notify_frequency は任意。未指定 / 空欄は repo 側で DB default 'realtime'。
  const result = addWatch(
    user.id,
    organization_name,
    industry || "",
    deal_score_threshold,
    notify_frequency ?? null,
  );
  if (result.action === "invalid_frequency") {
    return NextResponse.json(
      { error: "notify_frequency must be one of realtime | daily | off" },
      { status: 400 },
    );
  }
  return NextResponse.json(result, { status: result.action === "added" ? 201 : 200 });
}

// Phase J-7/J-8: 既存 watch の設定更新。
//   body の一方 or 両方を指定する:
//     - deal_score_threshold: 0..100 の整数
//     - notify_frequency:     realtime | daily | off
//   両方省略時のみ 400。各項目のバリデーションは repo 側に委譲。
export async function PATCH(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const id = Number.isInteger(body?.id) ? body.id : parseInt(body?.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const hasThreshold = "deal_score_threshold" in (body || {});
  const hasFrequency = "notify_frequency" in (body || {});
  if (!hasThreshold && !hasFrequency) {
    return NextResponse.json(
      { error: "deal_score_threshold or notify_frequency is required" },
      { status: 400 },
    );
  }

  const response = {};

  if (hasThreshold) {
    const r = updateWatchThreshold(user.id, id, body.deal_score_threshold);
    if (r.action === "invalid_threshold") {
      return NextResponse.json({ error: "deal_score_threshold must be 0..100" }, { status: 400 });
    }
    if (r.action === "not_found") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    response.deal_score_threshold = r.deal_score_threshold;
  }

  if (hasFrequency) {
    const r = updateWatchFrequency(user.id, id, body.notify_frequency);
    if (r.action === "invalid_frequency") {
      return NextResponse.json(
        { error: "notify_frequency must be one of realtime | daily | off" },
        { status: 400 },
      );
    }
    if (r.action === "not_found") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    response.notify_frequency = r.notify_frequency;
  }

  return NextResponse.json({ action: "updated", ...response });
}

export async function DELETE(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();

  // id で解除 or organization_name + industry で解除
  if (body.id) {
    const result = removeWatchById(user.id, body.id);
    return NextResponse.json(result);
  }

  const { organization_name, industry } = body;
  if (!organization_name) {
    return NextResponse.json({ error: "organization_name or id is required" }, { status: 400 });
  }

  const result = removeWatch(user.id, organization_name, industry || "");
  return NextResponse.json(result);
}
