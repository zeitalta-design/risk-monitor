/**
 * メール送信キュー生成サービス
 * notifications → email_jobs 変換
 */

import { getDb } from "./db";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";

/**
 * email_jobs テーブルに user_id カラムを追加（冪等）
 */
function ensureEmailJobsSchema(db) {
  try {
    db.exec("ALTER TABLE email_jobs ADD COLUMN user_id INTEGER");
  } catch {
    // カラム既存時は無視
  }
}

/**
 * 通知タイプ別のメールテンプレート
 */
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
    subject: (n) => `【Risk Monitor】保存条件に一致する大会が見つかりました`,
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
  const lines = [
    message,
    "",
    `大会名: ${ev?.title || n.title}`,
  ];
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
  let payload = {};
  try { payload = JSON.parse(n.payload_json || "{}"); } catch {}

  const lines = [
    "保存した検索条件に一致する大会が見つかりました。",
    "",
    `大会名: ${ev?.title || n.title}`,
  ];
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
  const lines = [
    `お気に入り登録している大会の締切が近づいています。`,
    "",
    message,
    "",
    `大会名: ${ev?.title || n.title}`,
  ];
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

/**
 * 未メール化の通知からメールジョブを生成
 * users テーブルから実メールアドレスを取得
 * @param {object} db
 * @returns {{ jobs: object[], skippedNoEmail: number }} email job候補とスキップ数
 */
export function buildEmailJobsFromNotifications(db) {
  ensureEmailJobsSchema(db);

  // email_jobs に存在しない notification を取得（usersをJOIN）
  const notifications = db.prepare(`
    SELECT n.*, u.email as user_email, u.id as user_id
    FROM notifications n
    LEFT JOIN users u ON n.user_key = CAST(u.id AS TEXT)
    LEFT JOIN email_jobs ej ON ej.notification_id = n.id
    WHERE ej.id IS NULL
    ORDER BY n.id
  `).all();

  const jobs = [];
  let skippedNoEmail = 0;

  for (const n of notifications) {
    const template = EMAIL_TEMPLATES[n.type];
    if (!template) continue;

    // メールアドレスがないユーザーはスキップ
    if (!n.user_email) {
      skippedNoEmail++;
      continue;
    }

    // event情報を取得
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
      to_email: n.user_email,
      user_id: n.user_id,
      subject,
      body_text: bodyText,
      preview_text: previewText,
      status: "pending",
      send_type: n.type,
    });
  }

  return { jobs, skippedNoEmail };
}

/**
 * メールジョブをDBに挿入（重複はユニークインデックスで排除）
 * @param {object} db
 * @param {object[]} jobs
 * @returns {number} 挿入件数
 */
export function insertEmailJobs(db, jobs) {
  if (jobs.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO email_jobs
    (user_key, notification_id, event_id, to_email, user_id, subject, body_text, preview_text, status, send_type)
    VALUES (@user_key, @notification_id, @event_id, @to_email, @user_id, @subject, @body_text, @preview_text, @status, @send_type)
  `);

  let inserted = 0;
  const doInsert = db.transaction(() => {
    for (const job of jobs) {
      if (stmt.run(job).changes > 0) inserted++;
    }
  });
  doInsert();

  return inserted;
}

/**
 * 統合実行: 通知 → メールキュー生成
 * @returns {object} 結果サマリー
 */
export function generateEmailJobs() {
  const db = getDb();
  const { jobs, skippedNoEmail } = buildEmailJobsFromNotifications(db);
  const inserted = insertEmailJobs(db, jobs);

  const breakdown = {};
  const userKeys = new Set();
  for (const job of jobs) {
    breakdown[job.send_type] = (breakdown[job.send_type] || 0) + 1;
    userKeys.add(job.user_key);
  }

  return {
    total: jobs.length,
    inserted,
    skipped: jobs.length - inserted,
    skippedNoEmail,
    userCount: userKeys.size,
    breakdown,
  };
}
