import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getAwardRanking,
  getAwardTimeline,
  getBuyerRelations,
} from "@/lib/agents/analyzer/nyusatsu";

export const dynamic = "force-dynamic";

/**
 * GET /api/nyusatsu/analytics/entities/[id]
 *
 * entity 単一の集計レスポンス（ranking/1件 + timeline + buyers + cluster情報）。
 * entity detail ページで 1 呼出しに束ねる目的。
 */
export async function GET(request, { params }) {
  try {
    const entityId = parseInt((await params).id, 10);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: "invalid entity id" }, { status: 400 });
    }
    const db = getDb();

    // entity 本体
    const entity = db.prepare(`
      SELECT e.*, c.canonical_name AS cluster_canonical_name, c.signal AS cluster_signal, c.size AS cluster_size
      FROM resolved_entities e
      LEFT JOIN entity_clusters c ON c.id = e.cluster_id
      WHERE e.id = ?
    `).get(entityId);

    if (!entity) {
      return NextResponse.json({ error: "entity not found" }, { status: 404 });
    }

    // 上位 1 件だけ取得（= この entity の summary）
    // ranking は by=entity で limit 1 にするより、直接この entity だけ出す用の
    // getAwardRanking + フィルタが複雑なので、代わりに timeline の集計から
    // summary を作る
    const timeline = getAwardTimeline({ db, granularity: "month", entityId });
    const total_awards = timeline.reduce((s, r) => s + r.total_awards, 0);
    const total_amount = timeline.reduce((s, r) => s + (r.total_amount || 0), 0);
    const unique_buyers = timeline.length > 0
      ? Math.max(...timeline.map((r) => r.unique_buyers))
      : 0; // 大まかな上限値（期間全体の unique は別クエリが必要）
    const active_months = timeline.length;
    const first_award = timeline[0]?.period || null;
    const last_award = timeline[timeline.length - 1]?.period || null;

    const buyers = getBuyerRelations({ db, entityId, limit: 10 });

    // エイリアス（表記ゆれ履歴）
    const aliases = db.prepare(`
      SELECT raw_name, seen_count, first_seen, last_seen
      FROM resolution_aliases
      WHERE entity_id = ?
      ORDER BY seen_count DESC, last_seen DESC
      LIMIT 20
    `).all(entityId);

    // cluster に所属する仲間 entity（あれば）
    const clusterMates = entity.cluster_id
      ? db.prepare(`
          SELECT id, canonical_name, corporate_number
          FROM resolved_entities
          WHERE cluster_id = ? AND id != ?
          ORDER BY canonical_name
        `).all(entity.cluster_id, entityId)
      : [];

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
        unique_buyers: buyers.items.length > 0 ? buyers.total_awards > 0 ? (new Set(buyers.items.map((i)=>i.issuer_name))).size : 0 : 0,
        active_months,
        first_award,
        last_award,
        concentration_count: buyers.concentration_count,
        concentration_amount: buyers.concentration_amount,
        top_issuer: buyers.top_issuer,
      },
      timeline,
      buyers: buyers.items,
      aliases,
      cluster_mates: clusterMates,
    });
  } catch (e) {
    console.error("GET /api/nyusatsu/analytics/entities/[id] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
