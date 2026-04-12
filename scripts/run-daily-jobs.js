/**
 * 日次ジョブランナー（統合版）
 *
 * 1. 通知候補生成
 * 2. メールキュー生成
 * 3. メール送信（オプション）
 *
 * Usage:
 *   node scripts/run-daily-jobs.js
 *   node scripts/run-daily-jobs.js --date 2026-03-15
 *   node scripts/run-daily-jobs.js --with-email-send
 *   node scripts/run-daily-jobs.js --with-email-send --limit-emails 10
 *   node scripts/run-daily-jobs.js --dry-run
 *   node scripts/run-daily-jobs.js --skip-email-send
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const nodemailer = webRequire("nodemailer");

// .env.local 読み込み
const envPath = path.join(__dirname, "..", "web", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

// --- DB setup ---
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

// --- notification-service ロジック（インライン） ---
function ensureNotificationSchema() {
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN event_id INTEGER");
  } catch {}
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN related_search_id INTEGER");
  } catch {}
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(user_key, type, event_id)"
  );
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildDeadlineNotifications({ today }) {
  const results = [];
  const deadlines = [
    { days: 0, type: "deadline_today", label: "本日締切", settingKey: "enable_deadline_today" },
    { days: 3, type: "deadline_3d", label: "締切間近（3日前）", settingKey: "enable_deadline_3d" },
    { days: 7, type: "deadline_7d", label: "締切間近（7日前）", settingKey: "enable_deadline_7d" },
  ];

  // 全アクティブユーザー取得
  const users = db.prepare("SELECT id FROM users WHERE is_active = 1").all();

  for (const dl of deadlines) {
    const targetDate = addDays(today, dl.days);
    const events = db
      .prepare(
        "SELECT id, title, entry_end_date FROM events WHERE entry_end_date = ? AND is_active = 1"
      )
      .all(targetDate);

    for (const ev of events) {
      for (const user of users) {
        // ユーザーの通知設定を確認
        const setting = db.prepare(
          `SELECT ${dl.settingKey} as enabled FROM notification_settings WHERE user_key = ?`
        ).get(String(user.id));
        // 設定なし or 有効の場合のみ生成
        if (setting && !setting.enabled) continue;

        results.push({
          user_key: String(user.id),
          type: dl.type,
          title: `${dl.label}: ${ev.title}`,
          body: `エントリー締切は ${ev.entry_end_date} です。`,
          payload_json: JSON.stringify({ event_id: ev.id, deadline_date: ev.entry_end_date }),
          event_id: ev.id,
          related_search_id: null,
        });
      }
    }
  }
  return results;
}

function buildFavoriteDeadlineNotifications({ today }) {
  const results = [];
  const deadlines = [
    { days: 0, type: "favorite_deadline_today", label: "お気に入り大会が本日締切" },
    { days: 3, type: "favorite_deadline_3d", label: "お気に入り大会の締切間近（3日前）" },
    { days: 7, type: "favorite_deadline_7d", label: "お気に入り大会の締切間近（7日前）" },
  ];
  for (const dl of deadlines) {
    const targetDate = addDays(today, dl.days);
    const rows = db
      .prepare(
        `SELECT f.user_key, e.id as event_id, e.title, e.entry_end_date
         FROM favorites f JOIN events e ON e.id = f.event_id
         WHERE e.entry_end_date = ? AND e.is_active = 1`
      )
      .all(targetDate);
    for (const row of rows) {
      results.push({
        user_key: row.user_key,
        type: dl.type,
        title: `${dl.label}: ${row.title}`,
        body: `お気に入り登録した大会のエントリー締切は ${row.entry_end_date} です。`,
        payload_json: JSON.stringify({ event_id: row.event_id, deadline_date: row.entry_end_date }),
        event_id: row.event_id,
        related_search_id: null,
      });
    }
  }
  return results;
}

function buildSavedSearchNotifications() {
  const results = [];
  const searches = db.prepare("SELECT * FROM saved_searches").all();
  for (const search of searches) {
    const conditions = [];
    const params = [];
    if (search.sport_type) { conditions.push("e.sport_type = ?"); params.push(search.sport_type); }
    if (search.keyword) { conditions.push("e.title LIKE ?"); params.push(`%${search.keyword}%`); }
    if (search.prefecture) { conditions.push("e.prefecture = ?"); params.push(search.prefecture); }
    if (search.event_month) { conditions.push("e.event_month = ?"); params.push(search.event_month); }
    if (conditions.length === 0) continue;

    const where = conditions.join(" AND ");
    let filters = {};
    try { filters = JSON.parse(search.filters_json || "{}"); } catch {}

    let query, queryParams;
    if (filters.distance) {
      query = `SELECT DISTINCT e.id, e.title, e.event_date, e.prefecture
               FROM events e JOIN event_races er ON er.event_id = e.id
               WHERE ${where} AND e.is_active = 1 AND er.race_type = ?`;
      queryParams = [...params, filters.distance];
    } else {
      query = `SELECT e.id, e.title, e.event_date, e.prefecture
               FROM events e WHERE ${where} AND e.is_active = 1`;
      queryParams = params;
    }
    const events = db.prepare(query).all(...queryParams);
    const condStr = [search.sport_type, search.keyword, search.prefecture, search.event_month ? `${search.event_month}月` : null, filters.distance].filter(Boolean).join("・");

    for (const ev of events) {
      results.push({
        user_key: search.user_key,
        type: "saved_search_match",
        title: `保存条件に一致: ${ev.title}`,
        body: `「${condStr}」の条件に一致する大会です。`,
        payload_json: JSON.stringify({ event_id: ev.id, search_id: search.id }),
        event_id: ev.id,
        related_search_id: search.id,
      });
    }
  }
  return results;
}

function generateAllNotifications({ today }) {
  ensureNotificationSchema();
  const deadlines = buildDeadlineNotifications({ today });
  const favorites = buildFavoriteDeadlineNotifications({ today });
  const matches = buildSavedSearchNotifications();
  const all = [...deadlines, ...favorites, ...matches];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO notifications
    (user_key, type, title, body, payload_json, event_id, related_search_id)
    VALUES (@user_key, @type, @title, @body, @payload_json, @event_id, @related_search_id)
  `);
  let inserted = 0;
  db.transaction(() => {
    for (const n of all) { if (stmt.run(n).changes > 0) inserted++; }
  })();

  const breakdown = {};
  const userKeys = new Set();
  for (const n of all) {
    breakdown[n.type] = (breakdown[n.type] || 0) + 1;
    userKeys.add(n.user_key);
  }
  return { total: all.length, inserted, skipped: all.length - inserted, breakdown, userCount: userKeys.size };
}

// --- email-service ロジック（インライン） ---
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";

const EMAIL_TEMPLATES = {
  deadline_today: {
    subject: (n, ev) => `【Risk Monitor】本日締切: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailDeadlineBody(n, ev, "本日がエントリー締切です。"),
  },
  deadline_3d: {
    subject: (n, ev) => `【Risk Monitor】締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailDeadlineBody(n, ev, "エントリー締切まであと3日です。"),
  },
  deadline_7d: {
    subject: (n, ev) => `【Risk Monitor】締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailDeadlineBody(n, ev, "エントリー締切まであと7日です。"),
  },
  saved_search_match: {
    subject: () => `【Risk Monitor】保存条件に一致する大会が見つかりました`,
    body: (n, ev) => buildEmailSearchBody(n, ev),
  },
  favorite_deadline_today: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が本日締切: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailFavoriteBody(n, ev, "本日がエントリー締切です。お見逃しなく！"),
  },
  favorite_deadline_3d: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailFavoriteBody(n, ev, "エントリー締切まであと3日です。"),
  },
  favorite_deadline_7d: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildEmailFavoriteBody(n, ev, "エントリー締切まであと7日です。"),
  },
};

function buildEmailDeadlineBody(n, ev, message) {
  const lines = [message, "", `大会名: ${ev?.title || n.title}`];
  if (ev?.entry_end_date) lines.push(`締切日: ${ev.entry_end_date}`);
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  lines.push("");
  if (ev) { lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`); if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`); }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

function buildEmailSearchBody(n, ev) {
  const lines = ["保存した検索条件に一致する大会が見つかりました。", "", `大会名: ${ev?.title || n.title}`];
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  if (ev?.prefecture) lines.push(`開催地: ${ev.prefecture}`);
  if (n.body) lines.push(`一致理由: ${n.body}`);
  lines.push("");
  if (ev) { lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`); if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`); }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

function buildEmailFavoriteBody(n, ev, message) {
  const lines = ["お気に入り登録している大会の締切が近づいています。", "", message, "", `大会名: ${ev?.title || n.title}`];
  if (ev?.entry_end_date) lines.push(`締切日: ${ev.entry_end_date}`);
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  lines.push("");
  if (ev) { lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`); if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`); }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

function ensureEmailJobsSchema() {
  try { db.exec("ALTER TABLE email_jobs ADD COLUMN user_id INTEGER"); } catch {}
}

function generateEmailJobs() {
  ensureEmailJobsSchema();

  const notifications = db.prepare(`
    SELECT n.*, u.email as user_email, u.id as user_id
    FROM notifications n
    LEFT JOIN users u ON n.user_key = CAST(u.id AS TEXT)
    LEFT JOIN email_jobs ej ON ej.notification_id = n.id
    WHERE ej.id IS NULL ORDER BY n.id
  `).all();

  const jobs = [];
  let skippedNoEmail = 0;

  for (const n of notifications) {
    const template = EMAIL_TEMPLATES[n.type];
    if (!template) continue;

    if (!n.user_email) {
      skippedNoEmail++;
      continue;
    }

    let ev = null;
    if (n.event_id) {
      ev = db.prepare("SELECT id, title, event_date, entry_end_date, prefecture, source_url FROM events WHERE id = ?").get(n.event_id);
    }
    const subject = template.subject(n, ev);
    const bodyText = template.body(n, ev);
    const previewText = bodyText.split("\n").filter(l => l.trim()).slice(0, 2).join(" ");
    jobs.push({
      user_key: n.user_key, notification_id: n.id, event_id: n.event_id || null,
      to_email: n.user_email, user_id: n.user_id,
      subject, body_text: bodyText, preview_text: previewText,
      status: "pending", send_type: n.type,
    });
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO email_jobs
    (user_key, notification_id, event_id, to_email, user_id, subject, body_text, preview_text, status, send_type)
    VALUES (@user_key, @notification_id, @event_id, @to_email, @user_id, @subject, @body_text, @preview_text, @status, @send_type)
  `);
  let inserted = 0;
  db.transaction(() => { for (const job of jobs) { if (stmt.run(job).changes > 0) inserted++; } })();

  const userKeys = new Set(jobs.map(j => j.user_key));
  return { total: jobs.length, inserted, skipped: jobs.length - inserted, skippedNoEmail, userCount: userKeys.size };
}

// --- Parse args ---
const args = process.argv.slice(2);
let today;
const dateIdx = args.indexOf("--date");
if (dateIdx !== -1 && args[dateIdx + 1]) {
  today = args[dateIdx + 1];
} else {
  today = new Date().toISOString().slice(0, 10);
}

const withEmailSend = args.includes("--with-email-send");
const skipEmailSend = args.includes("--skip-email-send");
const dryRun = args.includes("--dry-run");
let limitEmails = 50;
const limitIdx = args.indexOf("--limit-emails");
if (limitIdx !== -1 && args[limitIdx + 1]) {
  limitEmails = Number(args[limitIdx + 1]);
}

const doSendEmails = withEmailSend && !skipEmailSend && !dryRun;

// --- Main ---
const startTime = Date.now();

console.log("========================================");
console.log("  日次ジョブランナー");
console.log("========================================");
console.log(`対象日:         ${today}`);
console.log(`メール送信:     ${doSendEmails ? "ON" : "OFF"}`);
console.log(`ドライラン:     ${dryRun ? "ON" : "OFF"}`);
if (doSendEmails) console.log(`メール上限:     ${limitEmails}件`);
console.log(`開始:           ${new Date().toISOString()}`);
console.log("");

// daily_jobs レコード作成
const dailyJobId = db
  .prepare(
    `INSERT INTO daily_jobs (run_date, status, with_email_send, dry_run) VALUES (?, 'running', ?, ?)`
  )
  .run(today, doSendEmails ? 1 : 0, dryRun ? 1 : 0).lastInsertRowid;

const results = {
  notifications_generated: 0,
  notifications_inserted: 0,
  notifications_user_count: 0,
  email_jobs_generated: 0,
  email_jobs_inserted: 0,
  email_jobs_user_count: 0,
  emails_sent: 0,
  emails_failed: 0,
};
const stepResults = {};
let overallStatus = "success";
let errorMessage = null;

// --- Step 1: 通知候補生成 ---
console.log("--- [Step 1] 通知候補生成 開始 ---");
const step1Start = Date.now();
try {
  if (dryRun) {
    console.log("  (ドライラン: DB更新なし)");
    stepResults.notifications = { status: "skipped_dry_run" };
  } else {
    const notifResult = generateAllNotifications({ today });
    results.notifications_generated = notifResult.total;
    results.notifications_inserted = notifResult.inserted;
    results.notifications_user_count = notifResult.userCount || 0;
    stepResults.notifications = { status: "success", ...notifResult, durationMs: Date.now() - step1Start };
    console.log(`  生成: ${notifResult.total}件`);
    console.log(`  新規挿入: ${notifResult.inserted}件`);
    console.log(`  スキップ: ${notifResult.skipped}件`);
    console.log(`  対象ユーザー: ${notifResult.userCount || 0}人`);
    if (notifResult.breakdown) {
      for (const [type, count] of Object.entries(notifResult.breakdown)) {
        console.log(`    ${type}: ${count}`);
      }
    }
  }
  console.log(`--- [Step 1] 通知候補生成 完了 (${Date.now() - step1Start}ms) ---\n`);
} catch (error) {
  overallStatus = "failed";
  errorMessage = `Step 1 通知候補生成: ${error.message}`;
  stepResults.notifications = { status: "failed", error: error.message, durationMs: Date.now() - step1Start };
  console.error(`--- [Step 1] 通知候補生成 失敗 ---`);
  console.error(`  ${error.message}\n`);
}

// --- Step 2: メールキュー生成 ---
if (overallStatus !== "failed") {
  console.log("--- [Step 2] メールキュー生成 開始 ---");
  const step2Start = Date.now();
  try {
    if (dryRun) {
      console.log("  (ドライラン: DB更新なし)");
      stepResults.email_jobs = { status: "skipped_dry_run" };
    } else {
      const emailResult = generateEmailJobs();
      results.email_jobs_generated = emailResult.total;
      results.email_jobs_inserted = emailResult.inserted;
      results.email_jobs_user_count = emailResult.userCount || 0;
      stepResults.email_jobs = { status: "success", ...emailResult, durationMs: Date.now() - step2Start };
      console.log(`  生成: ${emailResult.total}件`);
      console.log(`  新規挿入: ${emailResult.inserted}件`);
      console.log(`  スキップ: ${emailResult.skipped}件`);
      console.log(`  メールなしスキップ: ${emailResult.skippedNoEmail || 0}件`);
      console.log(`  対象ユーザー: ${emailResult.userCount || 0}人`);
    }
    console.log(`--- [Step 2] メールキュー生成 完了 (${Date.now() - step2Start}ms) ---\n`);
  } catch (error) {
    overallStatus = "partial_success";
    errorMessage = `Step 2 メールキュー生成: ${error.message}`;
    stepResults.email_jobs = { status: "failed", error: error.message, durationMs: Date.now() - step2Start };
    console.error(`--- [Step 2] メールキュー生成 失敗 ---`);
    console.error(`  ${error.message}\n`);
  }
}

// --- Step 3: メール送信 ---
async function sendEmails() {
  if (!doSendEmails) {
    console.log("--- [Step 3] メール送信 スキップ ---\n");
    stepResults.email_send = { status: "skipped" };
    return;
  }

  console.log("--- [Step 3] メール送信 開始 ---");
  const step3Start = Date.now();

  try {
    const pendingJobs = db
      .prepare("SELECT * FROM email_jobs WHERE status = 'pending' ORDER BY id LIMIT ?")
      .all(limitEmails);

    console.log(`  pending: ${pendingJobs.length}件`);

    if (pendingJobs.length === 0) {
      stepResults.email_send = { status: "success", sent: 0, failed: 0, durationMs: Date.now() - step3Start };
      console.log(`--- [Step 3] メール送信 完了 (送信対象なし) ---\n`);
      return;
    }

    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      console.log(`  SMTP: ${process.env.SMTP_HOST}`);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        tls: { rejectUnauthorized: false },
      });
      console.log(`  Ethereal: ${testAccount.user}`);
    }

    const from = process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.com>";
    let sentCount = 0;
    let failedCount = 0;

    for (const job of pendingJobs) {
      try {
        const result = await transporter.sendMail({ from, to: job.to_email, subject: job.subject, text: job.body_text });
        db.prepare("UPDATE email_jobs SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(job.id);
        sentCount++;
        let previewUrl = "";
        if (!process.env.SMTP_HOST) {
          const url = nodemailer.getTestMessageUrl(result);
          if (url) previewUrl = ` → ${url}`;
        }
        console.log(`  #${job.id} ✓ sent${previewUrl}`);
      } catch (error) {
        db.prepare("UPDATE email_jobs SET status = 'failed', error_message = ? WHERE id = ?").run(error.message, job.id);
        failedCount++;
        console.log(`  #${job.id} ✗ failed: ${error.message}`);
      }
    }

    results.emails_sent = sentCount;
    results.emails_failed = failedCount;

    if (failedCount > 0 && overallStatus === "success") overallStatus = "partial_success";

    stepResults.email_send = {
      status: failedCount === 0 ? "success" : "partial",
      pending: pendingJobs.length,
      sent: sentCount,
      failed: failedCount,
      durationMs: Date.now() - step3Start,
    };

    console.log(`--- [Step 3] メール送信 完了 (sent:${sentCount} / failed:${failedCount}) (${Date.now() - step3Start}ms) ---\n`);
  } catch (error) {
    if (overallStatus === "success") overallStatus = "partial_success";
    errorMessage = `Step 3 メール送信: ${error.message}`;
    stepResults.email_send = { status: "failed", error: error.message, durationMs: Date.now() - step3Start };
    console.error(`--- [Step 3] メール送信 失敗 ---`);
    console.error(`  ${error.message}\n`);
  }
}

sendEmails()
  .then(() => {
    const durationMs = Date.now() - startTime;

    db.prepare(
      `UPDATE daily_jobs SET
        status = ?, finished_at = datetime('now'), duration_ms = ?,
        notifications_generated = ?, notifications_inserted = ?,
        email_jobs_generated = ?, email_jobs_inserted = ?,
        emails_sent = ?, emails_failed = ?,
        summary_json = ?, error_message = ?
       WHERE id = ?`
    ).run(
      overallStatus, durationMs,
      results.notifications_generated, results.notifications_inserted,
      results.email_jobs_generated, results.email_jobs_inserted,
      results.emails_sent, results.emails_failed,
      JSON.stringify(stepResults), errorMessage, dailyJobId
    );

    console.log("========================================");
    console.log("  日次ジョブ サマリー");
    console.log("========================================");
    console.log(`  ステータス:       ${overallStatus}`);
    console.log(`  daily_job_id:     #${dailyJobId}`);
    console.log(`  対象日:           ${today}`);
    console.log(`  実行時間:         ${durationMs}ms`);
    console.log("");
    console.log(`  通知生成:         ${results.notifications_generated}件`);
    console.log(`  通知挿入:         ${results.notifications_inserted}件`);
    console.log(`  通知対象ユーザー: ${results.notifications_user_count || 0}人`);
    console.log(`  メールキュー生成: ${results.email_jobs_generated}件`);
    console.log(`  メールキュー挿入: ${results.email_jobs_inserted}件`);
    console.log(`  メール対象ユーザー: ${results.email_jobs_user_count || 0}人`);
    console.log(`  メール送信:       ${results.emails_sent}件`);
    console.log(`  メール失敗:       ${results.emails_failed}件`);
    if (errorMessage) {
      console.log("");
      console.log(`  エラー: ${errorMessage}`);
    }
    console.log("========================================");

    if (overallStatus === "failed") process.exitCode = 1;
  })
  .catch((error) => {
    console.error("\n!!! 致命的エラー !!!");
    console.error(error.message);
    console.error(error.stack);
    db.prepare(
      `UPDATE daily_jobs SET status = 'failed', finished_at = datetime('now'),
       duration_ms = ?, error_message = ? WHERE id = ?`
    ).run(Date.now() - startTime, error.message, dailyJobId);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
