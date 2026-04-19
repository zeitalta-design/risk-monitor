/**
 * Cron: Deal Score 通知 — daily モード専用エントリ（Phase J-10）
 *
 * `/realtime` と対をなす。mode は "daily" 固定。
 * Vercel cron からは 1 日 1 回のみ叩く想定。
 */
import { NextResponse } from "next/server";
import { run, verifyCronAuth } from "../route";

export const dynamic = "force-dynamic";

function parseThresholdOverride(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("minScore");
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const thresholdOverride = parseThresholdOverride(request);
    const result = await run({ dryRun: true, thresholdOverride, mode: "daily" });
    console.log("[notify-deal-score/daily] dry-run", result);
    return NextResponse.json({ ...result, preview: true });
  } catch (e) {
    console.error("[notify-deal-score/daily] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const thresholdOverride = parseThresholdOverride(request);
    const result = await run({ dryRun: false, thresholdOverride, mode: "daily" });
    console.log("[notify-deal-score/daily] run", result);
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[notify-deal-score/daily] POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
