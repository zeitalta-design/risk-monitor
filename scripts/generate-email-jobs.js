/**
 * メールキュー生成スクリプト
 *
 * Usage:
 *   node scripts/generate-email-jobs.js
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";
const DEFAULT_EMAIL = "demo@example.com";

// --- DB setup ---
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

const startTime = Date.now();
console.log("=== メールキュー生成 ===");
console.log(`開始: ${new Date().toISOString()}`);

// --- Templates ---
const EMAIL_TEMPLATES = {
  deadline_today: {
    subject: (n, ev) => `【Risk Monitor】本日締切: ${ev?.title || n.title}`,
    body: (n, ev) => buildDeadlineBody(n, ev, "本日がエントリー締切です。"),
  },
  deadline_3d: {
    subject: (n, ev) => `【Risk Monitor】締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildDeadlineBody(n, ev, "エントリー締切まであと3日です。"),
  },
  deadline_7d: {
    subject: (n, ev) => `【Risk Monitor】締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildDeadlineBody(n, ev, "エントリー締切まであと7日です。"),
  },
  saved_search_match: {
    subject: () => `【Risk Monitor】保存条件に一致する大会が見つかりました`,
    body: (n, ev) => buildSavedSearchBody(n, ev),
  },
  favorite_deadline_today: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が本日締切: ${ev?.title || n.title}`,
    body: (n, ev) => buildFavoriteDeadlineBody(n, ev, "本日がエントリー締切です。お見逃しなく！"),
  },
  favorite_deadline_3d: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildFavoriteDeadlineBody(n, ev, "エントリー締切まであと3日です。"),
  },
  favorite_deadline_7d: {
    subject: (n, ev) => `【Risk Monitor】お気に入り大会が締切間近: ${ev?.title || n.title}`,
    body: (n, ev) => buildFavoriteDeadlineBody(n, ev, "エントリー締切まであと7日です。"),
  },
};

function buildDeadlineBody(n, ev, message) {
  const lines = [message, "", `大会名: ${ev?.title || n.title}`];
  if (ev?.entry_end_date) lines.push(`締切日: ${ev.entry_end_date}`);
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  lines.push("");
  if (ev) {
    lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`);
    if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`);
  }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

function buildSavedSearchBody(n, ev) {
  const lines = ["保存した検索条件に一致する大会が見つかりました。", "", `大会名: ${ev?.title || n.title}`];
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  if (ev?.prefecture) lines.push(`開催地: ${ev.prefecture}`);
  if (n.body) lines.push(`一致理由: ${n.body}`);
  lines.push("");
  if (ev) {
    lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`);
    if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`);
  }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

function buildFavoriteDeadlineBody(n, ev, message) {
  const lines = ["お気に入り登録している大会の締切が近づいています。", "", message, "", `大会名: ${ev?.title || n.title}`];
  if (ev?.entry_end_date) lines.push(`締切日: ${ev.entry_end_date}`);
  if (ev?.event_date) lines.push(`開催日: ${ev.event_date}`);
  lines.push("");
  if (ev) {
    lines.push(`詳細ページ: ${APP_BASE_URL}/marathon/${ev.id}`);
    if (ev.source_url) lines.push(`外部リンク: ${ev.source_url}`);
  }
  lines.push("", "---", "Risk Monitor — スポーツ大会検索・通知サービス", APP_BASE_URL);
  return lines.join("\n");
}

// --- Main ---
try {
  console.log("\n[1] 未メール化の通知を取得中...");
  const notifications = db.prepare(`
    SELECT n.* FROM notifications n
    LEFT JOIN email_jobs ej ON ej.notification_id = n.id
    WHERE ej.id IS NULL
    ORDER BY n.id
  `).all();
  console.log(`  対象通知: ${notifications.length}件`);

  console.log("\n[2] メールジョブを生成中...");
  const jobs = [];
  for (const n of notifications) {
    const template = EMAIL_TEMPLATES[n.type];
    if (!template) continue;

    let ev = null;
    if (n.event_id) {
      ev = db.prepare(
        "SELECT id, title, event_date, entry_end_date, prefecture, source_url FROM events WHERE id = ?"
      ).get(n.event_id);
    }

    const subject = template.subject(n, ev);
    const bodyText = template.body(n, ev);
    const previewText = bodyText.split("\n").filter(l => l.trim()).slice(0, 2).join(" ");

    jobs.push({
      user_key: n.user_key,
      notification_id: n.id,
      event_id: n.event_id || null,
      to_email: DEFAULT_EMAIL,
      subject,
      body_text: bodyText,
      preview_text: previewText,
      status: "pending",
      send_type: n.type,
    });
  }

  console.log("\n[3] DB挿入中...");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO email_jobs
    (user_key, notification_id, event_id, to_email, subject, body_text, preview_text, status, send_type)
    VALUES (@user_key, @notification_id, @event_id, @to_email, @subject, @body_text, @preview_text, @status, @send_type)
  `);

  let inserted = 0;
  const doInsert = db.transaction(() => {
    for (const job of jobs) {
      if (stmt.run(job).changes > 0) inserted++;
    }
  });
  doInsert();

  const breakdown = {};
  for (const job of jobs) {
    breakdown[job.send_type] = (breakdown[job.send_type] || 0) + 1;
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n=== 完了 (${durationMs}ms) ===`);
  console.log(`  対象通知:     ${notifications.length}件`);
  console.log(`  生成ジョブ:   ${jobs.length}件`);
  console.log(`  新規挿入:     ${inserted}件`);
  console.log(`  重複スキップ: ${jobs.length - inserted}件`);
  console.log("\n--- 種別内訳 ---");
  for (const [type, count] of Object.entries(breakdown)) {
    console.log(`  ${type}: ${count}件`);
  }
  const totalInDb = db.prepare("SELECT COUNT(*) as c FROM email_jobs").get().c;
  console.log(`\n  DB総メールジョブ数: ${totalInDb}件`);

} catch (error) {
  console.error(`\n!!! エラー発生 !!!`);
  console.error(error.message);
  console.error(error.stack);
  process.exitCode = 1;
}

db.close();
