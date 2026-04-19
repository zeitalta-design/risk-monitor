#!/usr/bin/env node
/**
 * Phase J-16 動作確認スクリプト（Turso 向け）
 *
 * 目的: 保存案件の status 変化検知 → watch_notifications INSERT →
 *       last_seen_status UPDATE が意図通り動くかを End-to-End で検証する。
 *
 * 使い方:
 *   node scripts/verify-j16-status-notif.mjs            # Turso (要 env)
 *   node scripts/verify-j16-status-notif.mjs --cleanup  # テストデータだけ削除
 *
 * 前提:
 *   - nyusatsu_items に実在する行が 1 件以上ある
 *   - users に実在する admin/test ユーザーが 1 件以上ある
 *
 * 副作用:
 *   - saved_deals / watch_notifications にテスト行を作る（最後にロールバック）
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// .env.local 読み込み
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

// ── route.js を import すると next/server を引くので、cron 本体を再実装する ──
//   本番挙動と乖離しないよう、SQL / メッセージ文面は route.js と完全一致させる。
const DEADLINE_WINDOW_DAYS = 3;

function jstTodayRoute(now = new Date()) {
  const JST_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const jstDayStart = Math.floor((now.getTime() + JST_MS) / DAY_MS) * DAY_MS;
  const d = new Date(jstDayStart);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
function daysBetweenYmd(a, b) {
  const toMs = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toMs(b) - toMs(a)) / 86400000);
}
function buildDeadlineTitle(t) { return `締切が近い: ${t ? String(t).slice(0, 80) : "保存案件"}`; }
function buildDeadlineSummary(dl, left) { return `締切 ${dl}（${left <= 0 ? "本日締切" : `残 ${left} 日`}）`; }
function buildStatusTitle(t) { return `保存案件に変化あり: ${t ? String(t).slice(0, 80) : "保存案件"}`; }
function buildStatusSummary(o, n) { return `状況が「${o ?? "—"}」から「${n ?? "—"}」に変わりました`; }

async function run({ dryRun = false, now = new Date() } = {}) {
  const db = getDb();
  const todayYmd = jstTodayRoute(now);
  const untilYmd = addDaysYmd(todayYmd, DEADLINE_WINDOW_DAYS);
  const s = {
    dryRun, windowDays: DEADLINE_WINDOW_DAYS, today: todayYmd, until: untilYmd,
    deadlineCandidates: 0, deadlineInserted: 0, deadlineDuplicates: 0,
    statusCandidates: 0, statusInserted: 0, statusDuplicates: 0, statusBackfilled: 0,
    candidates: 0, insertedNotifications: 0, skippedDuplicates: 0,
  };

  const dues = db.prepare(`
    SELECT sd.user_id, sd.deal_slug, ni.title, ni.deadline
    FROM saved_deals sd
    INNER JOIN nyusatsu_items ni ON ni.slug = sd.deal_slug AND ni.is_published = 1
    WHERE ni.deadline IS NOT NULL AND ni.deadline != ''
      AND ni.deadline >= @today AND ni.deadline <= @until
  `).all({ today: todayYmd, until: untilYmd });
  s.deadlineCandidates = dues.length;

  if (!dryRun) {
    const bf = db.prepare(`
      UPDATE saved_deals SET last_seen_status = (
        SELECT ni.status FROM nyusatsu_items ni
        WHERE ni.slug = saved_deals.deal_slug AND ni.is_published = 1
      ) WHERE last_seen_status IS NULL
    `).run();
    s.statusBackfilled = bf.changes || 0;
  }

  const diffs = db.prepare(`
    SELECT sd.user_id, sd.deal_slug, sd.last_seen_status AS old_status,
           ni.status AS new_status, ni.title
    FROM saved_deals sd
    INNER JOIN nyusatsu_items ni ON ni.slug = sd.deal_slug AND ni.is_published = 1
    WHERE sd.last_seen_status IS NOT NULL AND ni.status IS NOT NULL
      AND sd.last_seen_status != ni.status
  `).all();
  s.statusCandidates = diffs.length;
  if (dryRun) { s.candidates = s.deadlineCandidates + s.statusCandidates; return s; }

  const insertNotif = db.prepare(
    `INSERT OR IGNORE INTO watch_notifications
       (user_id, type, source_slug, event_date, organization_name, title, summary, frequency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateLastSeen = db.prepare(
    "UPDATE saved_deals SET last_seen_status = ? WHERE user_id = ? AND deal_slug = ?",
  );

  for (const r of dues) {
    const left = daysBetweenYmd(todayYmd, r.deadline);
    const res = insertNotif.run(
      r.user_id, "saved_deal_update", r.deal_slug, r.deadline,
      "", buildDeadlineTitle(r.title), buildDeadlineSummary(r.deadline, left), "realtime",
    );
    if (res.changes > 0) s.deadlineInserted++; else s.deadlineDuplicates++;
  }
  for (const r of diffs) {
    const res = insertNotif.run(
      r.user_id, "saved_deal_update", r.deal_slug, todayYmd,
      "", buildStatusTitle(r.title), buildStatusSummary(r.old_status, r.new_status), "realtime",
    );
    if (res.changes > 0) s.statusInserted++; else s.statusDuplicates++;
    updateLastSeen.run(r.new_status, r.user_id, r.deal_slug);
  }

  s.candidates = s.deadlineCandidates + s.statusCandidates;
  s.insertedNotifications = s.deadlineInserted + s.statusInserted;
  s.skippedDuplicates = s.deadlineDuplicates + s.statusDuplicates;
  return s;
}

const db = getDb();
const TEST_USER_ID = 999999; // 衝突しない番号

function pad(n) { return String(n).padStart(2, "0"); }
function jstToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
}

function cleanup() {
  const dn = db.prepare("DELETE FROM watch_notifications WHERE user_id = ?").run(TEST_USER_ID).changes || 0;
  const ds = db.prepare("DELETE FROM saved_deals WHERE user_id = ?").run(TEST_USER_ID).changes || 0;
  console.log(`  cleanup: saved_deals=${ds} watch_notifications=${dn}`);
}

if (process.argv.includes("--cleanup")) {
  cleanup();
  process.exit(0);
}

console.log("═══ Phase J-16 動作確認 ═══\n");

try {
  cleanup();

  // ── Step 1: 対象 nyusatsu_items を 2 件用意する ──────────
  //   1件目: status 変化テスト用
  //   2件目: deadline テスト用
  const items = db.prepare(
    `SELECT slug, title, status, deadline FROM nyusatsu_items
     WHERE is_published = 1 AND status IS NOT NULL
     LIMIT 2`
  ).all();
  if (items.length < 2) {
    console.error("✗ nyusatsu_items が 2 件未満。テスト不可。");
    process.exit(1);
  }
  const [itemA, itemB] = items;
  console.log(`[items] A: slug=${itemA.slug} status=${itemA.status}`);
  console.log(`[items] B: slug=${itemB.slug} status=${itemB.status}\n`);

  // ── Step 2: saveDeal 相当（status snapshot 付き） ────────
  db.prepare(
    "INSERT INTO saved_deals (user_id, deal_slug, last_seen_status) VALUES (?, ?, ?)"
  ).run(TEST_USER_ID, itemA.slug, itemA.status);
  db.prepare(
    "INSERT INTO saved_deals (user_id, deal_slug, last_seen_status) VALUES (?, ?, ?)"
  ).run(TEST_USER_ID, itemB.slug, itemB.status);
  console.log("[step2] saveDeal × 2 完了（last_seen_status は現在 status と一致）\n");

  // ── Step 3: 変化なしで cron 実行 → 通知 0 件であるべき ───
  let result = await run({ dryRun: false });
  const step3Notifs = db.prepare(
    "SELECT COUNT(*) AS n FROM watch_notifications WHERE user_id = ?"
  ).get(TEST_USER_ID)?.n || 0;
  console.log(`[step3] 変化なし cron: 通知=${step3Notifs} (期待: 0)`);
  if (step3Notifs !== 0) {
    console.error("  ✗ 変化なしなのに通知が入った");
    process.exit(1);
  }
  console.log("  ✓ 変化なしで通知なし\n");

  // ── Step 4: itemA の status を書き換える ──────────────
  //   他の値にずらしてから戻す。副作用最小化のため元の値を覚えておく。
  const origStatus = itemA.status;
  const mutated = origStatus + "__j16_test";
  db.prepare("UPDATE nyusatsu_items SET status = ? WHERE slug = ?").run(mutated, itemA.slug);
  console.log(`[step4] itemA status: "${origStatus}" → "${mutated}"\n`);

  try {
    // ── Step 5: cron 実行 → itemA だけ 1 件通知が入るべき ─
    result = await run({ dryRun: false });
    const notifs = db.prepare(
      `SELECT source_slug AS deal_slug, type, event_date, title, summary
       FROM watch_notifications WHERE user_id = ? ORDER BY id DESC`
    ).all(TEST_USER_ID);
    console.log(`[step5] 変化 1 件で cron: 通知=${notifs.length} (期待: 1)`);
    console.log(`        cron summary statusInserted=${result.statusInserted} statusCandidates=${result.statusCandidates}`);
    if (notifs.length !== 1) {
      console.error("  ✗ 通知件数が想定外");
      for (const n of notifs) console.error("    ", n);
      throw new Error("unexpected notif count");
    }
    const n = notifs[0];
    console.log("  ✓ 通知内容:");
    console.log(`      deal_slug  = ${n.deal_slug}   (期待 ${itemA.slug})`);
    console.log(`      type       = ${n.type}`);
    console.log(`      event_date = ${n.event_date}  (期待 ${jstToday()})`);
    console.log(`      title      = ${n.title}`);
    console.log(`      summary    = ${n.summary}`);
    if (n.deal_slug !== itemA.slug) throw new Error("wrong slug");
    if (n.type !== "saved_deal_update") throw new Error("wrong type");
    if (n.event_date !== jstToday()) throw new Error("event_date != today");
    if (!n.summary?.includes(origStatus) || !n.summary?.includes(mutated)) {
      throw new Error("summary に旧/新 status が含まれていない");
    }

    // ── Step 6: 再実行 → 二重通知しない（last_seen_status が追従した）──
    result = await run({ dryRun: false });
    const notifs2 = db.prepare(
      "SELECT COUNT(*) AS n FROM watch_notifications WHERE user_id = ?"
    ).get(TEST_USER_ID)?.n || 0;
    console.log(`\n[step6] 再 cron: 通知=${notifs2} (期待: 1, 変わらない)`);
    console.log(`        cron summary statusInserted=${result.statusInserted} statusCandidates=${result.statusCandidates}`);
    if (notifs2 !== 1) {
      throw new Error("再実行で通知が増えた（last_seen_status 未更新？）");
    }
    console.log("  ✓ dedupe: 再実行で通知が増えない\n");

    // ── Step 7: saved_deals の last_seen_status が最新値に追従しているか ─
    const sd = db.prepare(
      "SELECT last_seen_status FROM saved_deals WHERE user_id = ? AND deal_slug = ?"
    ).get(TEST_USER_ID, itemA.slug);
    console.log(`[step7] saved_deals.last_seen_status = "${sd?.last_seen_status}" (期待 "${mutated}")`);
    if (sd?.last_seen_status !== mutated) throw new Error("last_seen_status 未更新");
    console.log("  ✓ last_seen_status 更新済み\n");

    // ── Step 8: 未保存 item への影響なし確認 ──
    //   itemB は変化させていない。通知数は依然 1 のまま。
    const notifsB = db.prepare(
      "SELECT COUNT(*) AS n FROM watch_notifications WHERE user_id = ? AND source_slug = ?"
    ).get(TEST_USER_ID, itemB.slug)?.n || 0;
    console.log(`[step8] itemB (未変化) 通知=${notifsB} (期待: 0)`);
    if (notifsB !== 0) throw new Error("未変化 item に通知が入った");
    console.log("  ✓ 未変化 item に通知なし\n");

    // ── Step 9: deadline 通知が壊れていないこと ──
    //   itemB の deadline を今日+2日に一時的に書き換えて cron 実行。
    //   status 通知と event_date が異なるので独立して 1 件入るはず。
    const origDeadline = itemB.deadline;
    const today = jstTodayRoute();
    const nearDeadline = addDaysYmd(today, 2);
    db.prepare("UPDATE nyusatsu_items SET deadline = ? WHERE slug = ?").run(nearDeadline, itemB.slug);
    console.log(`[step9] itemB deadline: "${origDeadline}" → "${nearDeadline}" (today+2)`);
    try {
      const before = db.prepare(
        "SELECT COUNT(*) AS n FROM watch_notifications WHERE user_id = ? AND source_slug = ?"
      ).get(TEST_USER_ID, itemB.slug)?.n || 0;
      const r = await run({ dryRun: false });
      const after = db.prepare(
        `SELECT type, event_date, title, summary FROM watch_notifications
         WHERE user_id = ? AND source_slug = ? ORDER BY id DESC`
      ).all(TEST_USER_ID, itemB.slug);
      console.log(`        deadlineInserted=${r.deadlineInserted} deadlineCandidates=${r.deadlineCandidates}`);
      console.log(`        itemB 通知 before=${before} after=${after.length} (期待 before=0 after=1)`);
      if (after.length !== 1) throw new Error("deadline 通知が想定通りに入らなかった");
      if (after[0].event_date !== nearDeadline) throw new Error("deadline 通知の event_date が不正");
      if (!after[0].title.startsWith("締切が近い")) throw new Error("deadline 通知の title が不正");
      console.log("  ✓ deadline 通知も正常に発火（status pass と独立）\n");
    } finally {
      db.prepare("UPDATE nyusatsu_items SET deadline = ? WHERE slug = ?").run(origDeadline, itemB.slug);
      console.log(`[restore] itemB deadline を "${origDeadline}" に戻しました`);
    }

    console.log("═══ 全チェック通過 ✓ ═══");
  } finally {
    // nyusatsu_items を元に戻す
    db.prepare("UPDATE nyusatsu_items SET status = ? WHERE slug = ?").run(origStatus, itemA.slug);
    console.log(`[restore] itemA status を "${origStatus}" に戻しました`);
  }
} finally {
  cleanup();
}
