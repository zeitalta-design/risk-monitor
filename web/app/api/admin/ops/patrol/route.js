import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Phase240: 巡回パトロール / 品質確認API（改善版）
 * - 問題種別ごとの件数カード
 * - patrol_status フィルタリング対応
 * - 再取得ログ取得
 */
export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const issue = searchParams.get("issue");
    const now = new Date().toISOString().split("T")[0];
    const staleDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const archivedDate = new Date(Date.now() - 31 * 86400000).toISOString().split("T")[0];

    // patrol_status除外条件: manual_resolved / refetch_excluded は除外
    const excludePatrol = `AND (patrol_status IS NULL OR patrol_status NOT IN ('manual_resolved', 'refetch_excluded'))`;

    // 問題種別ごとの件数
    const issueCounts = {
      no_date: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '') ${excludePatrol}`
      ).get().c,
      no_prefecture: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '') ${excludePatrol}`
      ).get().c,
      no_venue: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (venue_name IS NULL OR venue_name = '') ${excludePatrol}`
      ).get().c,
      no_distance: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND id NOT IN (SELECT DISTINCT event_id FROM event_races) ${excludePatrol}`
      ).get().c,
      no_url: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (official_url IS NULL OR official_url = '') ${excludePatrol}`
      ).get().c,
      past_archived: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND event_date < ? AND event_date IS NOT NULL AND event_date != ''`
      ).get(archivedDate).c,
      past_recent: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND event_date < ? AND event_date >= ? AND event_date IS NOT NULL AND event_date != ''`
      ).get(now, archivedDate).c,
      stale: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND updated_at < ? ${excludePatrol}`
      ).get(staleDate + "T00:00:00").c,
      conflict: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND verification_conflict = 1`
      ).get().c,
    };

    const ISSUE_META = {
      no_date: { label: "開催日未設定", level: "danger", priority: 1, refetchable: true },
      no_prefecture: { label: "都道府県未設定", level: "danger", priority: 2, refetchable: true },
      no_venue: { label: "会場未設定", level: "warning", priority: 3, refetchable: true },
      no_distance: { label: "種目（距離）未設定", level: "warning", priority: 4, refetchable: true },
      no_url: { label: "公式URL未設定", level: "warning", priority: 5, refetchable: true },
      past_archived: { label: "終了31日超で公開中", level: "danger", priority: 6, refetchable: false },
      past_recent: { label: "終了30日以内（公開中）", level: "info", priority: 7, refetchable: false },
      stale: { label: "30日以上未更新", level: "info", priority: 8, refetchable: true },
      conflict: { label: "情報矛盾あり", level: "warning", priority: 9, refetchable: false },
    };

    const issueCards = Object.entries(issueCounts).map(([key, count]) => ({
      key,
      ...ISSUE_META[key],
      count,
    })).sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1;
      if (a.count === 0 && b.count > 0) return 1;
      return a.priority - b.priority;
    });

    // 指定された問題種別の一覧取得
    let events = [];
    if (issue && ISSUE_META[issue]) {
      const selectCols = `SELECT e.id, e.title, e.sport_type, e.event_date, e.prefecture, e.city,
                          e.venue_name, e.source_url, e.source_site, e.official_url, e.updated_at,
                          e.patrol_status, e.patrol_note`;
      const baseWhere = `FROM events e WHERE e.is_active = 1`;

      const queries = {
        no_date: `${selectCols} ${baseWhere} AND (e.event_date IS NULL OR e.event_date = '') ${excludePatrol}`,
        no_prefecture: `${selectCols} ${baseWhere} AND (e.prefecture IS NULL OR e.prefecture = '') ${excludePatrol}`,
        no_venue: `${selectCols} ${baseWhere} AND (e.venue_name IS NULL OR e.venue_name = '') ${excludePatrol}`,
        no_distance: `${selectCols} ${baseWhere} AND e.id NOT IN (SELECT DISTINCT event_id FROM event_races) ${excludePatrol}`,
        no_url: `${selectCols} ${baseWhere} AND (e.official_url IS NULL OR e.official_url = '') ${excludePatrol}`,
        past_archived: `${selectCols} ${baseWhere} AND e.event_date < '${archivedDate}' AND e.event_date IS NOT NULL AND e.event_date != '' ORDER BY e.event_date DESC`,
        past_recent: `${selectCols} ${baseWhere} AND e.event_date < '${now}' AND e.event_date >= '${archivedDate}' AND e.event_date IS NOT NULL AND e.event_date != '' ORDER BY e.event_date DESC`,
        stale: `${selectCols} ${baseWhere} AND e.updated_at < '${staleDate}T00:00:00' ${excludePatrol} ORDER BY e.updated_at ASC`,
        conflict: `${selectCols}, e.verification_conflict_summary ${baseWhere} AND e.verification_conflict = 1`,
      };

      events = db.prepare(queries[issue] + " LIMIT 100").all();

      // 直近の再取得ログを各イベントに紐付け
      const eventIds = events.map((e) => e.id);
      if (eventIds.length > 0) {
        const logPlaceholders = eventIds.map(() => "?").join(",");
        const recentLogs = db.prepare(`
          SELECT event_id, status, failure_reason, failure_detail,
                 updated_fields, remaining_missing, created_at
          FROM patrol_refetch_logs
          WHERE event_id IN (${logPlaceholders})
          AND created_at = (
            SELECT MAX(created_at) FROM patrol_refetch_logs p2
            WHERE p2.event_id = patrol_refetch_logs.event_id
          )
        `).all(...eventIds);

        const logMap = {};
        for (const log of recentLogs) {
          logMap[log.event_id] = log;
        }

        for (const ev of events) {
          ev.last_refetch = logMap[ev.id] || null;
        }
      }
    }

    return NextResponse.json({
      issueCards,
      events,
      selectedIssue: issue,
      totalActive: db.prepare("SELECT COUNT(*) as c FROM events WHERE is_active = 1").get().c,
    });
  } catch (err) {
    console.error("Patrol API error:", err);
    return NextResponse.json({
      error: "取得に失敗しました",
      issueCards: [],
      events: [],
      totalActive: 0,
    }, { status: 500 });
  }
}

/**
 * PATCH: 大会に対するアクション
 */
export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { event_id, action, event_ids } = body;

    // 一括アーカイブ
    if (action === "archive_past" && event_ids && Array.isArray(event_ids)) {
      const placeholders = event_ids.map(() => "?").join(",");
      const result = db.prepare(
        `UPDATE events SET is_active = 0, updated_at = datetime('now') WHERE id IN (${placeholders}) AND is_active = 1`
      ).run(...event_ids);
      return NextResponse.json({
        message: `${result.changes}件を非公開に変更しました`,
        count: result.changes,
      });
    }

    if (!event_id || !action) {
      return NextResponse.json({ error: "event_id と action は必須です" }, { status: 400 });
    }

    switch (action) {
      case "toggle_active": {
        const ev = db.prepare("SELECT is_active FROM events WHERE id = ?").get(event_id);
        if (!ev) return NextResponse.json({ error: "大会が見つかりません" }, { status: 404 });
        const newActive = ev.is_active ? 0 : 1;
        db.prepare("UPDATE events SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(newActive, event_id);
        return NextResponse.json({ event_id, is_active: newActive, message: newActive ? "公開に変更しました" : "非公開に変更しました" });
      }

      case "flag_review": {
        db.prepare(
          "UPDATE events SET patrol_status = 'manual_review', updated_at = datetime('now') WHERE id = ?"
        ).run(event_id);
        db.prepare(
          `INSERT INTO admin_event_notes (event_id, note_type, note_text, created_by)
           VALUES (?, 'patrol_review', '巡回パトロールで「手動確認が必要」フラグを設定', 'admin')`
        ).run(event_id);
        return NextResponse.json({ event_id, message: "手動確認フラグを設定しました" });
      }

      case "dismiss": {
        db.prepare(
          "UPDATE events SET patrol_status = 'manual_resolved', patrol_note = '管理者が解消済みとして処理', updated_at = datetime('now') WHERE id = ?"
        ).run(event_id);
        db.prepare(
          `INSERT INTO admin_event_notes (event_id, note_type, note_text, created_by)
           VALUES (?, 'patrol_dismiss', '巡回パトロールで解消済みとして処理', 'admin')`
        ).run(event_id);
        return NextResponse.json({ event_id, message: "解消済みとして記録し、一覧から除外しました" });
      }

      case "mark_manual_required": {
        db.prepare(
          "UPDATE events SET patrol_status = 'manual_review', patrol_note = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(body.note || "手動対応が必要", event_id);
        return NextResponse.json({ event_id, message: "手動対応フラグを設定しました" });
      }

      case "exclude_refetch": {
        db.prepare(
          "UPDATE events SET patrol_status = 'refetch_excluded', patrol_note = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(body.note || "再取得対象外", event_id);
        return NextResponse.json({ event_id, message: "再取得対象外に設定しました" });
      }

      case "reset_patrol_status": {
        db.prepare(
          "UPDATE events SET patrol_status = 'auto', patrol_note = NULL, updated_at = datetime('now') WHERE id = ?"
        ).run(event_id);
        return NextResponse.json({ event_id, message: "パトロール状態をリセットしました" });
      }

      default:
        return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Patrol PATCH error:", err);
    return NextResponse.json({ error: "操作に失敗しました" }, { status: 500 });
  }
}
