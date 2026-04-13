import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatureSummaries } from "@/lib/feature-marathons";
import { getEventDisplayStatus } from "@/lib/entry-status";
import { getPopularEvents } from "@/lib/event-popularity";

export const dynamic = "force-dynamic";

// 名寄せ済みレコード除外条件
const NOT_MERGED = "AND canonical_event_id IS NULL";

export async function GET() {
  try {
    const db = getDb();

    // 受付状態を再計算
    const enrichStatus = (events) =>
      events.map((e) => {
        const ds = getEventDisplayStatus(e);
        return { ...e, entry_status: ds.status };
      });

    // 掲載大会数（名寄せ済みは除外）
    const { total } = db
      .prepare(`SELECT COUNT(*) as total FROM events WHERE is_active = 1 ${NOT_MERGED}`)
      .get();

    // 共通SELECT — 画像URL含む（カード表示に必要）
    const CARD_COLS = `id, title, event_date, entry_end_date, prefecture, entry_status, sport_type,
                       hero_image_url`;

    // 直近締切の大会（カルーセル用に8件）
    let deadlineEvents = db
      .prepare(`
        SELECT ${CARD_COLS}
        FROM events
        WHERE is_active = 1 ${NOT_MERGED}
          AND entry_end_date IS NOT NULL
          AND entry_end_date >= date('now')
          AND entry_status = 'open'
        ORDER BY entry_end_date ASC
        LIMIT 8
      `)
      .all();

    if (deadlineEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT ${CARD_COLS}
          FROM events
          WHERE is_active = 1 ${NOT_MERGED}
            AND event_date >= date('now')
            AND entry_status = 'open'
          ORDER BY event_date ASC
          LIMIT 8
        `)
        .all();
      if (fallback.length > deadlineEvents.length) {
        deadlineEvents = fallback;
      }
    }

    // 新着・注目大会（カルーセル用に8件）
    let newEvents = db
      .prepare(`
        SELECT ${CARD_COLS}
        FROM events
        WHERE is_active = 1 ${NOT_MERGED}
          AND event_date >= date('now')
        ORDER BY updated_at DESC
        LIMIT 8
      `)
      .all();

    if (newEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT ${CARD_COLS}
          FROM events
          WHERE is_active = 1 ${NOT_MERGED}
          ORDER BY updated_at DESC
          LIMIT 8
        `)
        .all();
      if (fallback.length > newEvents.length) {
        newEvents = fallback;
      }
    }

    // 人気大会（カルーセル用に8件）
    let popularEvents = getPopularEvents({ limit: 8, days: 30 });

    if (!popularEvents || popularEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type,
                 hero_image_url, popularity_score, popularity_label, popularity_key
          FROM events
          WHERE is_active = 1 ${NOT_MERGED}
            AND entry_status = 'open'
            AND event_date >= date('now')
          ORDER BY popularity_score DESC, event_date ASC
          LIMIT 8
        `)
        .all();
      if (fallback.length > (popularEvents?.length || 0)) {
        popularEvents = enrichStatus(fallback);
      }
    }

    // 比較軸サマリー
    let featureSummaries = [];
    try {
      featureSummaries = getFeatureSummaries();
    } catch (e) {
      console.error("Feature summaries error:", e);
    }

    return NextResponse.json({
      total,
      deadlineEvents: enrichStatus(deadlineEvents),
      newEvents: enrichStatus(newEvents),
      popularEvents,
      featureSummaries,
    });
  } catch (error) {
    console.error("Top API error:", error);
    return NextResponse.json({ total: 0, deadlineEvents: [], newEvents: [], popularEvents: [] });
  }
}
