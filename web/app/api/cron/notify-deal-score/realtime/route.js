/**
 * Cron: Deal Score 通知 — realtime モード専用エントリ（Phase J-10）
 *
 * Vercel cron の `path` は query string を保持しないため、
 * `/api/cron/notify-deal-score?mode=realtime` を直接登録できない。
 * 代わりに mode 固定のサブルートを用意し、共通ロジック (`run`) を呼ぶ。
 *
 * - GET  : dry-run
 * - POST : 実行（INSERT OR IGNORE）
 *
 * 認証・threshold override の挙動は親ルートと同一。
 * mode は "realtime" 固定（?mode= は無視される）。
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
    const result = await run({ dryRun: true, thresholdOverride, mode: "realtime" });
    console.log("[notify-deal-score/realtime] dry-run", result);
    return NextResponse.json({ ...result, preview: true });
  } catch (e) {
    console.error("[notify-deal-score/realtime] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const thresholdOverride = parseThresholdOverride(request);
    const result = await run({ dryRun: false, thresholdOverride, mode: "realtime" });
    console.log("[notify-deal-score/realtime] run", result);
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[notify-deal-score/realtime] POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
