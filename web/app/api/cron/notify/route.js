/**
 * Cron: watch_notifications in-app 通知ジェネレータ
 *
 * GET  /api/cron/notify         → dry-run（件数プレビュー、書き込みなし）
 * POST /api/cron/notify         → 実行（INSERT + カーソル更新）
 *
 * 処理:
 *   1. watched_organizations を全件取得
 *   2. 各 watch について：
 *      - gyosei-shobun: admin_actions WHERE action_date > last_inapp_notified_action_date
 *                       AND is_published = 1
 *                       ∧ 軽量正規化名 == watch の軽量正規化名
 *                       ∧ （watch.industry が空でなければ industry 一致）
 *      - nyusatsu:     nyusatsu_results WHERE award_date > last_notified_award_date
 *                       AND is_published = 1
 *                       ∧ 軽量正規化名 == watch の軽量正規化名
 *   3. 各 watch につき 1 トランザクションで：
 *      - watch_notifications に INSERT OR IGNORE（重複は UNIQUE で弾く）
 *      - watched_organizations.last_inapp_notified_action_date / last_notified_award_date
 *        を max(event_date) に更新
 *
 * 照合ポリシー:
 *   - organization_name の軽量正規化のみ（trim + 連続空白の圧縮）
 *   - fuzzy / LLM は一切なし
 *
 * 認証:
 *   - Authorization: Bearer $CRON_SECRET（Vercel cron 用）
 *   - または admin_session / mvp_session cookie（手動呼び出し）
 *   - CRON_SECRET 未設定時は dev とみなしてスキップ
 *
 * 既存 email digest (lib/watchlist-notification-service.js) とは
 * 独立した cursor 列（last_inapp_notified_action_date）を使用するため、
 * 二系統の通知が相互に取りこぼしを起こさない。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// ─── 認証 ─────────────────────────────────────
function verifyCronAuth(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  const adminSession =
    request.cookies?.get?.("admin_session")?.value ||
    request.cookies?.get?.("mvp_session")?.value;
  if (adminSession) return true;
  if (!secret) return true; // dev
  return false;
}

// ─── 軽量正規化（trim + 連続空白圧縮のみ） ───────────
// fuzzy / LLM は禁止。全角空白 (\u3000) / 半角空白 / タブ等も 1 つの半角空白に圧縮。
function normalizeLight(s) {
  if (s == null) return "";
  return String(s).trim().replace(/[\s\u3000]+/g, " ");
}

// ─── 1 watch 分の gyosei-shobun マッチ検出 ───────────
function findGyoseiMatches(db, watch) {
  const cursor = watch.last_inapp_notified_action_date || "";
  const rows = db.prepare(`
    SELECT id, slug, organization_name_raw, action_type, action_date,
           industry, prefecture, authority_name, summary
    FROM administrative_actions
    WHERE is_published = 1
      AND action_date IS NOT NULL AND action_date != ''
      AND action_date > @cursor
      AND organization_name_raw IS NOT NULL
  `).all({ cursor });

  const watchKey = normalizeLight(watch.organization_name);
  const hasIndustry = !!(watch.industry && watch.industry !== "");
  return rows.filter((r) => {
    if (normalizeLight(r.organization_name_raw) !== watchKey) return false;
    if (hasIndustry && r.industry !== watch.industry) return false;
    return true;
  });
}

// ─── 1 watch 分の nyusatsu マッチ検出 ───────────
function findNyusatsuMatches(db, watch) {
  const cursor = watch.last_notified_award_date || "";
  const rows = db.prepare(`
    SELECT id, slug, winner_name, winner_corporate_number,
           issuer_name, title, award_amount, award_date
    FROM nyusatsu_results
    WHERE is_published = 1
      AND award_date IS NOT NULL AND award_date != ''
      AND award_date > @cursor
      AND winner_name IS NOT NULL
  `).all({ cursor });

  const watchKey = normalizeLight(watch.organization_name);
  return rows.filter((r) => normalizeLight(r.winner_name) === watchKey);
}

// ─── UX 用タイトル生成 ─────────────────────────
const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order:  "改善命令",
  warning:            "指示・警告",
  guidance:           "指導・勧告",
  other:              "その他",
};

function buildGyoseiTitle(row) {
  const label = ACTION_LABELS[row.action_type] || row.action_type || "処分";
  const place = row.prefecture ? `（${row.prefecture}）` : "";
  return `${row.organization_name_raw}：${label}${place}`;
}
function buildGyoseiSummary(row) {
  const parts = [];
  if (row.authority_name) parts.push(row.authority_name);
  if (row.summary) parts.push(row.summary.slice(0, 120));
  return parts.join(" / ") || null;
}
function buildNyusatsuTitle(row) {
  return `${row.winner_name}：落札 ${row.title || "(件名不明)"}`;
}
function buildNyusatsuSummary(row) {
  const parts = [];
  if (row.issuer_name) parts.push(row.issuer_name);
  if (row.award_amount) parts.push(`${row.award_amount.toLocaleString()}円`);
  return parts.join(" / ") || null;
}

// ─── 1 watch 分を永続化（明示 BEGIN/COMMIT） ─────────
//
// Turso (libsql HTTP) では better-sqlite3 互換の db.transaction(fn) が
// 大量 INSERT + 10秒近辺で「cannot rollback - no transaction is active」を
// 出すことがある。安定動作のため明示 BEGIN/COMMIT + batch multi-row INSERT
// を採用。1 statement あたりの行数は SQLite 999 parameter 制限 / 7 col = 142 が上限、
// 安全側で 100 行に制限。
function persistWatchResult(db, watch, gyoseiHits, nyusatsuHits) {
  const actionCursor = gyoseiHits.length > 0
    ? gyoseiHits.reduce((m, r) => (r.action_date > m ? r.action_date : m), "")
    : null;
  const awardCursor = nyusatsuHits.length > 0
    ? nyusatsuHits.reduce((m, r) => (r.award_date > m ? r.award_date : m), "")
    : null;

  const rows = [
    ...gyoseiHits.map((r) => ({
      user_id:           watch.user_id,
      type:              "gyosei_shobun",
      source_slug:       r.slug,
      event_date:        r.action_date,
      organization_name: watch.organization_name,
      title:             buildGyoseiTitle(r),
      summary:           buildGyoseiSummary(r),
    })),
    ...nyusatsuHits.map((r) => ({
      user_id:           watch.user_id,
      type:              "nyusatsu",
      source_slug:       r.slug,
      event_date:        r.award_date,
      organization_name: watch.organization_name,
      title:             buildNyusatsuTitle(r),
      summary:           buildNyusatsuSummary(r),
    })),
  ];

  if (rows.length === 0 && !actionCursor && !awardCursor) {
    return { inserted: 0 };
  }

  let inserted = 0;
  db.exec("BEGIN");
  try {
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params = [];
      for (const r of slice) {
        params.push(r.user_id, r.type, r.source_slug, r.event_date,
                    r.organization_name, r.title, r.summary);
      }
      const res = db.prepare(
        `INSERT OR IGNORE INTO watch_notifications
           (user_id, type, source_slug, event_date, organization_name, title, summary)
         VALUES ${placeholders}`
      ).run(...params);
      inserted += res.changes || 0;
    }
    if (actionCursor || awardCursor) {
      db.prepare(`
        UPDATE watched_organizations
        SET last_inapp_notified_action_date = COALESCE(?, last_inapp_notified_action_date),
            last_notified_award_date        = COALESCE(?, last_notified_award_date),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(actionCursor, awardCursor, watch.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* transaction may already be gone */ }
    throw e;
  }
  return { inserted };
}

// ─── メインランナー ─────────────────────────────
function run({ dryRun = false } = {}) {
  const db = getDb();
  const watches = db.prepare(`
    SELECT id, user_id, organization_name, industry,
           last_inapp_notified_action_date, last_notified_award_date
    FROM watched_organizations
    ORDER BY id
  `).all();

  const summary = {
    dryRun,
    watchesScanned: watches.length,
    gyoseiMatches:  0,
    nyusatsuMatches:0,
    inserted:       0,
    perWatch:       [],
  };

  for (const w of watches) {
    const g = findGyoseiMatches(db, w);
    const n = findNyusatsuMatches(db, w);
    summary.gyoseiMatches   += g.length;
    summary.nyusatsuMatches += n.length;

    const detail = {
      watch_id: w.id,
      user_id:  w.user_id,
      organization_name: w.organization_name,
      industry: w.industry || null,
      gyosei:   g.length,
      nyusatsu: n.length,
    };

    if (!dryRun && (g.length > 0 || n.length > 0)) {
      const { inserted } = persistWatchResult(db, w, g, n);
      detail.inserted = inserted;
      summary.inserted += inserted;
    }

    if (g.length > 0 || n.length > 0) summary.perWatch.push(detail);
  }

  return summary;
}

// ─── HTTP handlers ─────────────────────────────
export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = run({ dryRun: true });
    return NextResponse.json({ ...result, preview: true });
  } catch (e) {
    console.error("[cron/notify] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = run({ dryRun: false });
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[cron/notify] POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
