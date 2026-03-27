import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";
import { determineOfficialEntryStatus, getOfficialStatusDef } from "@/lib/official-entry-status";

/**
 * Phase71: 締切カレンダーAPI
 *
 * GET /api/entry-deadlines
 *
 * 「今申し込むべき大会」を判断できるよう、
 * 募集状態グループ別にイベントを返す。
 *
 * グループ:
 *   today    - 本日締切
 *   in3days  - 3日以内
 *   in7days  - 7日以内
 *   thisMonth - 今月中
 *   capacity_warning - 定員間近
 *   full     - 定員到達
 *   closed   - 募集終了
 *   unknown  - 要確認
 */
export async function GET(request) {
  try {
    const db = getDb();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // 今月末
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonthStr = endOfMonth.toISOString().split("T")[0];

    // 受付中 or 未判定のイベント（開催日が未来）
    const events = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date, e.entry_start_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               (SELECT GROUP_CONCAT(DISTINCT CAST(er.distance_km AS TEXT))
                FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
               ) as distance_list,
               e.popularity_score, e.description,
               e.official_entry_status, e.official_entry_status_label,
               e.official_checked_at, e.official_deadline_text,
               e.official_capacity_text, e.official_status_source_url,
               e.official_status_confidence, e.official_status_note,
               e.source_url, e.official_url, e.last_verified_at,
               e.entry_signals_json,
               md.venue_name
        FROM events e
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.is_active = 1
          AND (e.event_date IS NULL OR e.event_date >= ?)
        ORDER BY e.entry_end_date ASC NULLS LAST, e.popularity_score DESC
        LIMIT 500
      `)
      .all(todayStr);

    // 各イベントの official status を決定
    const groups = {
      today: [],
      in3days: [],
      in7days: [],
      thisMonth: [],
      capacity_warning: [],
      full: [],
      closed: [],
      unknown: [],
    };

    const stats = {
      total: 0,
      openTotal: 0,
      closingSoon: 0,
      capacityWarning: 0,
      fullCount: 0,
      closedCount: 0,
    };

    for (const event of events) {
      // official status を取得 or 算出
      let officialStatus = event.official_entry_status;
      let officialLabel = event.official_entry_status_label;
      let confidence = event.official_status_confidence || 0;
      let deadlineText = event.official_deadline_text;
      let capacityText = event.official_capacity_text;
      let statusNote = event.official_status_note;
      let checkedAt = event.official_checked_at;

      // official が未設定の場合、リアルタイム算出
      if (!officialStatus) {
        let signals = [];
        if (event.entry_signals_json) {
          try { signals = JSON.parse(event.entry_signals_json); } catch {}
        }
        const result = determineOfficialEntryStatus(event, { signals });
        officialStatus = result.status;
        officialLabel = result.label;
        confidence = result.confidence;
        deadlineText = result.deadlineText;
        capacityText = result.capacityText;
        statusNote = result.note;
      }

      // display status（従来のフォールバック）
      const ds = getEventDisplayStatus(event);
      const statusDef = getOfficialStatusDef(officialStatus);

      const enriched = {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        entry_end_date: event.entry_end_date,
        prefecture: event.prefecture,
        city: event.city,
        sport_type: event.sport_type,
        distance_list: event.distance_list,
        popularity_score: event.popularity_score,
        source_url: event.source_url,
        official_url: event.official_url,
        venue_name: event.venue_name,
        // official status
        official_entry_status: officialStatus,
        official_entry_status_label: officialLabel || statusDef.label,
        official_status_confidence: confidence,
        official_deadline_text: deadlineText,
        official_capacity_text: capacityText,
        official_status_note: statusNote,
        official_checked_at: checkedAt,
        // display status (従来)
        entry_status: ds.status,
        entry_status_label: ds.label,
      };

      stats.total++;

      // グループ振り分け
      if (officialStatus === "full") {
        groups.full.push(enriched);
        stats.fullCount++;
      } else if (officialStatus === "closed") {
        groups.closed.push(enriched);
        stats.closedCount++;
      } else if (officialStatus === "suspended") {
        groups.closed.push(enriched);
        stats.closedCount++;
      } else if (officialStatus === "capacity_warning") {
        groups.capacity_warning.push(enriched);
        stats.capacityWarning++;
        stats.openTotal++;
      } else if (officialStatus === "awaiting_update") {
        // Phase79: 情報更新待ち → unknown グループに入れる
        groups.unknown.push(enriched);
      } else if (officialStatus === "closing_soon" || officialStatus === "open" || officialStatus === "unknown") {
        // 締切日ベースでグループ分け
        if (event.entry_end_date) {
          const deadline = new Date(event.entry_end_date);
          const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

          if (diffDays <= 0) {
            groups.today.push(enriched);
            stats.closingSoon++;
            stats.openTotal++;
          } else if (diffDays <= 3) {
            groups.in3days.push(enriched);
            stats.closingSoon++;
            stats.openTotal++;
          } else if (diffDays <= 7) {
            groups.in7days.push(enriched);
            stats.closingSoon++;
            stats.openTotal++;
          } else if (deadline <= endOfMonth) {
            groups.thisMonth.push(enriched);
            stats.openTotal++;
          } else {
            // 今月以降は unknown 扱いではなく、グループ外
            // ただし open なら openTotal にカウント
            if (officialStatus === "open" || officialStatus === "closing_soon") {
              stats.openTotal++;
            }
          }
        } else if (officialStatus === "unknown") {
          groups.unknown.push(enriched);
        } else {
          // 締切日不明だが open
          stats.openTotal++;
        }
      }
    }

    // 各グループを popularity で再ソート（today/in3days/in7days は締切日ソート維持）
    groups.capacity_warning.sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));
    groups.full.sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));
    groups.closed.sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));

    // 件数制限
    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].slice(0, 20);
    }

    return NextResponse.json({ groups, stats });
  } catch (error) {
    console.error("Entry deadlines API error:", error);
    return NextResponse.json({
      groups: { today: [], in3days: [], in7days: [], thisMonth: [], capacity_warning: [], full: [], closed: [], unknown: [] },
      stats: { total: 0, openTotal: 0, closingSoon: 0, capacityWarning: 0, fullCount: 0, closedCount: 0 },
    });
  }
}
