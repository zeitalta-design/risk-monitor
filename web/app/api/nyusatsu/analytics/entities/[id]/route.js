import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  fetchEntityLookup,
  fetchEntityTimeline,
  fetchEntityBuyerRelations,
  fetchClusterMates,
} from "@/lib/agents/analyzer/nyusatsu/entity-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/nyusatsu/analytics/entities/[id]
 *
 * entity 単一の集計レスポンス。
 * Phase 2 Priority 1: 最適化経路（entity-detail.js）を利用し、298k 行の
 * 全表スキャンを避けて winner_corporate_number + alias name で pushdown。
 */
export async function GET(request, { params }) {
  try {
    const entityId = parseInt((await params).id, 10);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "invalid entity id" }, { status: 400 });
    }
    const db = getDb();

    // 1) entity + aliases を1本のラウンドトリップ束で取得（targetedWhere を確定）
    const lookup = fetchEntityLookup({ db, entityId });
    if (!lookup.entity) {
      return NextResponse.json({ error: "entity not found" }, { status: 404 });
    }
    const { entity, aliases, targetedWhere, targetedParams } = lookup;

    // 2) timeline / buyers / cluster_mates を並列実行
    //    libsql compat layer は SQL 実行ごとに HTTP round-trip があるため、
    //    await Promise.all で発火タイミングを重ねる意味がある。
    const [timeline, buyers, clusterMates] = await Promise.all([
      Promise.resolve().then(() => fetchEntityTimeline({ db, granularity: "month", targetedWhere, targetedParams })),
      Promise.resolve().then(() => fetchEntityBuyerRelations({ db, targetedWhere, targetedParams, limit: 10 })),
      Promise.resolve().then(() => fetchClusterMates({ db, entity })),
    ]);

    // 3) summary は timeline + buyers から組み立て（追加クエリなし）
    const total_awards = timeline.reduce((s, r) => s + r.total_awards, 0);
    const total_amount = timeline.reduce((s, r) => s + (r.total_amount || 0), 0);
    const active_months = timeline.length;
    const first_award = timeline[0]?.period || null;
    const last_award = timeline[timeline.length - 1]?.period || null;

    return NextResponse.json({
      entity: {
        id: entity.id,
        corporate_number: entity.corporate_number,
        canonical_name: entity.canonical_name,
        normalized_key: entity.normalized_key,
        prefecture: entity.prefecture,
        source: entity.source,
        cluster_id: entity.cluster_id,
        cluster_canonical_name: entity.cluster_canonical_name,
        cluster_signal: entity.cluster_signal,
        cluster_size: entity.cluster_size,
      },
      summary: {
        total_awards,
        total_amount,
        unique_buyers: buyers.unique_buyers,
        active_months,
        first_award,
        last_award,
        concentration_count: buyers.concentration_count,
        concentration_amount: buyers.concentration_amount,
        top_issuer: buyers.top_issuer,
      },
      timeline,
      buyers: buyers.items,
      aliases: aliases.slice(0, 20),
      cluster_mates: clusterMates,
    });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/entities/[id] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
