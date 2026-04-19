/**
 * GET /api/nyusatsu/analytics/deals/score-map
 *
 * Phase J-5: 一覧ページバッジ用の軽量 score map。
 * 指定 entity × 指定 ids (items | results) の Deal Score を配列で返す。
 *
 * ポリシー:
 *   - fuzzy / LLM / issuer 推定なし（deal-score-batch に集約）
 *   - 共通 bundle は 1 回のみ（computeDealScoreMap 内で確保）
 *   - ids は最大 50 件まで。それを超えた場合は先頭 50 件に clamp
 *   - 不明 id は単に結果に出ないだけ（エラーにしない）
 *
 * Query:
 *   - entityId (必須, >0)
 *   - ids      (必須, カンマ区切りの正整数、最大 50)
 *   - source   (任意, default "items", "items" | "results")
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeDealScoreMap } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

const MAX_IDS = 50;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const entityId = parseInt(searchParams.get("entityId") || "", 10);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "entityId is required" }, { status: 400 });
    }

    const rawSource = (searchParams.get("source") || "items").toLowerCase();
    if (rawSource !== "items" && rawSource !== "results") {
      return NextResponse.json({ error: "source must be 'items' or 'results'" }, { status: 400 });
    }
    const source = rawSource;

    const idsRaw = searchParams.get("ids") || "";
    const ids = idsRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_IDS);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids is required" }, { status: 400 });
    }

    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");

    const candidates = source === "items"
      ? db.prepare(`
          SELECT id, slug, title, category,
                 announcement_date AS date,
                 issuer_name, issuer_dept_hint, issuer_code
          FROM nyusatsu_items
          WHERE is_published = 1 AND id IN (${placeholders})
        `).all(...ids)
      : db.prepare(`
          SELECT id, NULL AS slug, title, category,
                 award_date AS date,
                 issuer_name, issuer_dept_hint, issuer_code
          FROM nyusatsu_results
          WHERE is_published = 1 AND id IN (${placeholders})
        `).all(...ids);

    const result = await computeDealScoreMap({
      db, entityId, items: candidates,
    });

    console.log("[deals/score-map]", {
      entityId,
      source,
      requested: ids.length,
      resolved:  candidates.length,
      returned:  result.length,
    });

    return NextResponse.json({ items: result });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/deals/score-map error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
