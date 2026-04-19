/**
 * GET /api/nyusatsu/analytics/issuer-score
 *
 * Issuer Affinity Score（Phase H Step 5）。entity × issuer_key の相性を 0〜100 で返す。
 *
 * Query:
 *   - entityId       (必須)
 *   - issuerKey      (必須) — issuer_dept_hint か issuer_code のどちらか
 *   - issuerKeyType  (任意) — "dept_hint" | "code"。未指定なら dept_hint を優先
 *   - yearCurrent    (任意) — recency 計算の基準年
 *
 * レスポンス: { score, label, components, inputs, issuer, weights }
 *   - issuer が識別不能（issuerKey 空）→ 400
 *   - 実績なし → score 0 を返す（null 判定は呼び出し側の責務）
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeIssuerAffinityScore } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = parseInt(searchParams.get("entityId") || "", 10);
    const issuerKey = (searchParams.get("issuerKey") || "").trim();
    const issuerKeyType = searchParams.get("issuerKeyType") || undefined;
    const yearCurrent   = searchParams.get("yearCurrent")   || undefined;

    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "entityId is required" }, { status: 400 });
    }
    if (!issuerKey) {
      return NextResponse.json({ error: "issuerKey is required" }, { status: 400 });
    }
    if (issuerKeyType && issuerKeyType !== "dept_hint" && issuerKeyType !== "code") {
      return NextResponse.json({ error: "issuerKeyType must be 'dept_hint' or 'code'" }, { status: 400 });
    }

    const result = computeIssuerAffinityScore({
      db: getDb(),
      entityId,
      issuerKey,
      issuerKeyType,
      yearCurrent,
    });
    if (!result) {
      return NextResponse.json({ error: "issuer score not computable" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/issuer-score error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
