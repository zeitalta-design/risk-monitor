import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { detectDuplicates } from "@/lib/quality/duplicate-checker";
import { getCompletenessStats, getIncompleteEvents } from "@/lib/quality/data-completeness";
import { getReviewQualityStats, getFlaggedReviews } from "@/lib/quality/review-quality";
import { getPhotoQualityStats, getFlaggedPhotos } from "@/lib/quality/photo-quality";
import { getResultQualityStats, getResultQualityOverview } from "@/lib/quality/result-quality";
import { getQualityScoreDistribution, getBatchQualityScores } from "@/lib/quality/quality-score";
import { getDb } from "@/lib/db";

/**
 * Phase214: 品質管理ダッシュボードAPI
 *
 * GET /api/admin/quality?view=dashboard|duplicates|incomplete|reviews|photos|results|scores
 */
export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "dashboard";
    const limit = Math.min(parseInt(searchParams.get("limit")) || 50, 200);
    const offset = parseInt(searchParams.get("offset")) || 0;
    const sportType = searchParams.get("sport_type") || "";

    switch (view) {
      case "dashboard": {
        const duplicates = detectDuplicates({ threshold: 50, limit: 5 });
        const completeness = getCompletenessStats();
        const reviewStats = getReviewQualityStats();
        const photoStats = getPhotoQualityStats();
        const resultStats = getResultQualityStats();
        const scoreDist = getQualityScoreDistribution();

        // 最近更新された大会
        const db = getDb();
        const recentUpdated = db.prepare(`
          SELECT id, title, updated_at, sport_type
          FROM events WHERE is_active = 1 AND updated_at IS NOT NULL
          ORDER BY updated_at DESC LIMIT 5
        `).all();

        // 今週改善すべき大会（低スコア＋今後開催）
        const lowScoreEvents = getBatchQualityScores({ limit: 5, maxScore: 40 });

        return NextResponse.json({
          duplicateCount: duplicates.length,
          topDuplicates: duplicates.slice(0, 3),
          completeness,
          reviewStats,
          photoStats,
          resultStats,
          scoreDist,
          recentUpdated,
          priorityEvents: lowScoreEvents.items,
        });
      }

      case "duplicates": {
        const threshold = parseInt(searchParams.get("threshold")) || 50;
        const items = detectDuplicates({ threshold, limit });
        return NextResponse.json({ items, total: items.length });
      }

      case "incomplete": {
        const minMissing = parseInt(searchParams.get("min_missing")) || 1;
        const result = getIncompleteEvents({ limit, offset, minMissing, sportType });
        return NextResponse.json(result);
      }

      case "reviews": {
        const result = getFlaggedReviews({ limit, offset });
        return NextResponse.json(result);
      }

      case "photos": {
        const statusFilter = searchParams.get("status") || "";
        const result = getFlaggedPhotos({ limit, offset, statusFilter });
        return NextResponse.json(result);
      }

      case "results": {
        const result = getResultQualityOverview({ limit, offset });
        return NextResponse.json(result);
      }

      case "scores": {
        const maxScore = parseInt(searchParams.get("max_score")) || 100;
        const result = getBatchQualityScores({ limit, offset, maxScore, sportType });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "不正なviewパラメータ" }, { status: 400 });
    }
  } catch (err) {
    console.error("Quality API error:", err);
    return NextResponse.json({ error: "品質データ取得に失敗しました" }, { status: 500 });
  }
}
