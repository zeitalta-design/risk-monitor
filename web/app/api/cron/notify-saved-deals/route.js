/**
 * Cron: 保存案件の変化通知（Phase J-15）
 *
 * GET  /api/cron/notify-saved-deals → dry-run（件数プレビュー）
 * POST /api/cron/notify-saved-deals → 実行（INSERT OR IGNORE）
 *
 * 対象条件（v1 最小実装）:
 *   - saved_deals に登録されている nyusatsu_items
 *   - deadline が JST today 以降 3 日以内（残 0..3 日）
 *
 * 通知 row:
 *   - type         = 'saved_deal_update'
 *   - source_slug  = nyusatsu_items.slug
 *   - event_date   = deadline （YYYY-MM-DD）
 *   - frequency    = 'realtime'
 * dedupe は既存 UNIQUE (user_id, type, source_slug, event_date) のまま。
 * deadline が後日変更されれば event_date が変わるので再通知されるが、
 * 同一 deadline なら何度 cron を叩いても二重通知はしない。
 *
 * 既存 deal_score / gyosei_shobun / nyusatsu 通知には一切 touch しない。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyCronAuth } from "../notify-deal-score/route";

export const dynamic = "force-dynamic";

const DEADLINE_WINDOW_DAYS = 3;
const INSERT_BATCH = 100; // SQLite 999 parameter 制限対策

// JST 固定の今日の YYYY-MM-DD
function jstToday(now = new Date()) {
  const JST_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const jstDayStart = Math.floor((now.getTime() + JST_MS) / DAY_MS) * DAY_MS;
  const d = new Date(jstDayStart);
  const pad = (n) => String(n).padStart(2, "0");
  // jstDayStart は UTC ms 空間の「JST 0:00」→ UTC 日付に変換すると前日になるので、
  // 取るのは JST 日付。ここは UTC ゲッタで OK（JST 0:00 を UTC で見た瞬間の年月日）。
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(t);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function daysBetweenYmd(fromYmd, toYmd) {
  const parse = (s) => {
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toYmd) - parse(fromYmd)) / (24 * 60 * 60 * 1000));
}

// 対象レコードを取得。
//   saved_deals × nyusatsu_items (公開) の INNER JOIN。
//   今日 <= deadline <= today + N で絞る。
function fetchDueSavedDeals(db, { todayYmd, untilYmd }) {
  return db.prepare(`
    SELECT
      sd.user_id,
      sd.deal_slug,
      ni.title,
      ni.deadline
    FROM saved_deals sd
    INNER JOIN nyusatsu_items ni
      ON ni.slug = sd.deal_slug AND ni.is_published = 1
    WHERE ni.deadline IS NOT NULL
      AND ni.deadline != ''
      AND ni.deadline >= @today
      AND ni.deadline <= @until
  `).all({ today: todayYmd, until: untilYmd });
}

function buildDeadlineTitle(title) {
  const t = title ? String(title).slice(0, 80) : "保存案件";
  return `締切が近い: ${t}`;
}
function buildDeadlineSummary(deadline, daysLeft) {
  const rem = daysLeft <= 0 ? "本日締切" : `残 ${daysLeft} 日`;
  return `締切 ${deadline}（${rem}）`;
}

// Phase J-16: status 変化通知の文面。
function buildStatusTitle(title) {
  const t = title ? String(title).slice(0, 80) : "保存案件";
  return `保存案件に変化あり: ${t}`;
}
function buildStatusSummary(oldStatus, newStatus) {
  return `状況が「${oldStatus ?? "—"}」から「${newStatus ?? "—"}」に変わりました`;
}

// Phase J-16: 「前回見た status」と現在 status が異なる保存案件を列挙。
//   last_seen_status が NULL の行（migration 前の既存保存）は対象外。
//   ni.status が NULL の行も対象外（NULL != X は NULL で判定できないため）。
function fetchStatusChanges(db) {
  return db.prepare(`
    SELECT
      sd.user_id,
      sd.deal_slug,
      sd.last_seen_status AS old_status,
      ni.status           AS new_status,
      ni.title
    FROM saved_deals sd
    INNER JOIN nyusatsu_items ni
      ON ni.slug = sd.deal_slug AND ni.is_published = 1
    WHERE sd.last_seen_status IS NOT NULL
      AND ni.status IS NOT NULL
      AND sd.last_seen_status != ni.status
  `).all();
}

// Phase J-16: last_seen_status が NULL の行（migration 前 / 旧 API 経由の保存）に
//   現在の status を埋める。通知は出さない（「初回だけ埋めて以降追跡」運用）。
//   ni.status が NULL の行はそのまま NULL のまま（追跡対象外）。
function backfillLastSeenStatus(db) {
  const res = db.prepare(`
    UPDATE saved_deals
    SET last_seen_status = (
      SELECT ni.status FROM nyusatsu_items ni
      WHERE ni.slug = saved_deals.deal_slug AND ni.is_published = 1
    )
    WHERE last_seen_status IS NULL
  `).run();
  return res.changes || 0;
}

export async function run({ dryRun = false, now = new Date() } = {}) {
  const db = getDb();
  const todayYmd = jstToday(now);
  const untilYmd = addDaysYmd(todayYmd, DEADLINE_WINDOW_DAYS);

  const summary = {
    dryRun,
    windowDays:              DEADLINE_WINDOW_DAYS,
    today:                   todayYmd,
    until:                   untilYmd,
    // deadline pass
    deadlineCandidates:      0,
    deadlineInserted:        0,
    deadlineDuplicates:      0,
    // status pass
    statusCandidates:        0,
    statusInserted:          0,
    statusDuplicates:        0,
    statusBackfilled:        0,
    // 後方互換のためトップレベルの合算もキープ
    candidates:              0,
    insertedNotifications:   0,
    skippedDuplicates:       0,
  };

  // ── 1. deadline pass（既存挙動） ──
  const dues = fetchDueSavedDeals(db, { todayYmd, untilYmd });
  summary.deadlineCandidates = dues.length;

  // ── 2. status pass: NULL backfill → 差分検知 ──
  //   dry-run では backfill も行わない（観測用のみ）。
  if (!dryRun) {
    summary.statusBackfilled = backfillLastSeenStatus(db);
  }
  const diffs = fetchStatusChanges(db);
  summary.statusCandidates = diffs.length;

  if (dryRun) {
    summary.candidates = summary.deadlineCandidates + summary.statusCandidates;
    return summary;
  }

  db.exec("BEGIN");
  try {
    // deadline insert
    for (let i = 0; i < dues.length; i += INSERT_BATCH) {
      const slice = dues.slice(i, i + INSERT_BATCH);
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params = [];
      for (const r of slice) {
        const daysLeft = daysBetweenYmd(todayYmd, r.deadline);
        params.push(
          r.user_id,
          "saved_deal_update",
          r.deal_slug,              // source_slug
          r.deadline,               // event_date = deadline
          "",
          buildDeadlineTitle(r.title),
          buildDeadlineSummary(r.deadline, daysLeft),
          "realtime",
        );
      }
      const res = db.prepare(
        `INSERT OR IGNORE INTO watch_notifications
           (user_id, type, source_slug, event_date, organization_name, title, summary, frequency)
         VALUES ${placeholders}`
      ).run(...params);
      const inserted = res.changes || 0;
      summary.deadlineInserted   += inserted;
      summary.deadlineDuplicates += (slice.length - inserted);
    }

    // status change insert + last_seen_status UPDATE
    //   INSERT OR IGNORE の結果に関わらず last_seen_status は必ず更新する
    //   （翌日同じ変化を検出し続けないため）。deadline と同日・同 slug で UNIQUE
    //   衝突する場合もあるが、その場合でも状態は進めて次の変化だけ追うように整える。
    const updateLastSeen = db.prepare(
      "UPDATE saved_deals SET last_seen_status = ? WHERE user_id = ? AND deal_slug = ?",
    );
    for (let i = 0; i < diffs.length; i += INSERT_BATCH) {
      const slice = diffs.slice(i, i + INSERT_BATCH);
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params = [];
      for (const r of slice) {
        params.push(
          r.user_id,
          "saved_deal_update",
          r.deal_slug,
          todayYmd,                           // event_date = 実装時点の日付
          "",
          buildStatusTitle(r.title),
          buildStatusSummary(r.old_status, r.new_status),
          "realtime",
        );
      }
      const res = db.prepare(
        `INSERT OR IGNORE INTO watch_notifications
           (user_id, type, source_slug, event_date, organization_name, title, summary, frequency)
         VALUES ${placeholders}`
      ).run(...params);
      const inserted = res.changes || 0;
      summary.statusInserted   += inserted;
      summary.statusDuplicates += (slice.length - inserted);

      for (const r of slice) {
        updateLastSeen.run(r.new_status, r.user_id, r.deal_slug);
      }
    }

    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch {}
    console.error("[notify-saved-deals] INSERT failed:", e);
    throw e;
  }

  summary.candidates            = summary.deadlineCandidates + summary.statusCandidates;
  summary.insertedNotifications = summary.deadlineInserted + summary.statusInserted;
  summary.skippedDuplicates     = summary.deadlineDuplicates + summary.statusDuplicates;

  return summary;
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run({ dryRun: true });
    console.log("[notify-saved-deals] dry-run", result);
    return NextResponse.json({ ...result, preview: true });
  } catch (e) {
    console.error("[notify-saved-deals] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run({ dryRun: false });
    console.log("[notify-saved-deals] run", result);
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[notify-saved-deals] POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
