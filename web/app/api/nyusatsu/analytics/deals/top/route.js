/**
 * GET /api/nyusatsu/analytics/deals/top
 *
 * Phase J-1: 有望案件リスト / Phase J-1.5: batch 最適化。
 *
 * entity に対して、候補案件（items / results）を最新 N 件だけ取得し、
 * Deal Score の「共通 bundle」を 1 回だけ計算した上で、候補ごとに issuer + 合成を行う。
 *
 * ポリシー:
 *   - 候補は最新 200 件のみ（全件スキャンしない）
 *   - 共通 score（entity / market / category）は 1 回のみ計算
 *   - issuer_score は案件依存だが同一 key を memoize
 *   - fuzzy / LLM / issuer 推定は一切しない（batch helper 側に集約）
 *   - 返却は軽量フィールドのみ（詳細は /deal-score を個別に叩く想定）
 *
 * Query:
 *   - entityId  (必須, >0)
 *   - limit     (任意, default 20, max 50)
 *   - minScore  (任意, default 70, 0..100)
 *   - source    (任意, default "items", "items" | "results")
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeTopDealScores } from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

const CANDIDATE_LIMIT = 200;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_MIN_SCORE = 70;

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

    let limit = parseInt(searchParams.get("limit") || "", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    let minScore = Number(searchParams.get("minScore"));
    if (!Number.isFinite(minScore)) minScore = DEFAULT_MIN_SCORE;
    if (minScore < 0) minScore = 0;
    if (minScore > 100) minScore = 100;

    const db = getDb();

    // Step 1: 候補取得（軽量・最新順）
    const candidates = source === "items"
      ? db.prepare(`
          SELECT id, slug, title, category,
                 announcement_date AS date,
                 issuer_name, issuer_dept_hint, issuer_code
          FROM nyusatsu_items
          WHERE is_published = 1
          ORDER BY announcement_date DESC
          LIMIT ${CANDIDATE_LIMIT}
        `).all()
      : db.prepare(`
          SELECT id, NULL AS slug, title, category,
                 award_date AS date,
                 issuer_name, issuer_dept_hint, issuer_code
          FROM nyusatsu_results
          WHERE is_published = 1
          ORDER BY award_date DESC
          LIMIT ${CANDIDATE_LIMIT}
        `).all();

    // Step 2: batch Deal Score（共通 bundle 1 回 + 案件差分）
    const { items, stats } = await computeTopDealScores({
      db, entityId, items: candidates, minScore, limit,
    });

    console.log("[deals/top]", {
      entityId,
      source,
      fetched: candidates.length,
      filtered: stats.passed,
      returned: stats.returned,
    });

    // Spec 通りの軽量フィールドに整形（reasons / components は返さない）
    const trimmed = items.map((it) => ({
      id:       it.id,
      slug:     it.slug,
      title:    it.title,
      category: it.category,
      date:     it.date,
      score:    it.score,
      label:    it.label,
      issuer:   it.issuer,
    }));

    return NextResponse.json({ items: trimmed });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/deals/top error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
