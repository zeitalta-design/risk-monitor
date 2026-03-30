/**
 * ウォッチリスト通知ランナー（スタンドアロン CLI）
 *
 * watch 対象に新しい行政処分があるユーザーに digest メールを送信する。
 * GitHub Actions scheduled workflow / 手動 SSH から呼ぶことを想定。
 *
 * Usage:
 *   node scripts/run-watchlist-notify.js
 *   node scripts/run-watchlist-notify.js --dry-run
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const nodemailer = webRequire("nodemailer");

// ==============================
// .env.local 読み込み
// ==============================
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

// ==============================
// DB setup
// ==============================
const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// last_notified_action_date カラム追加（冪等）
try {
  db.exec(
    "ALTER TABLE watched_organizations ADD COLUMN last_notified_action_date TEXT"
  );
} catch {
  // カラム既存時は無視
}

// ==============================
// 定数
// ==============================
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";

const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order: "改善命令",
  warning: "指示・警告",
  guidance: "指導・勧告",
  other: "その他",
};

const INDUSTRY_LABELS = {
  construction: "建設業",
  real_estate: "宅建業",
  architecture: "建築士",
  transport: "運送業",
};

// ==============================
// 通知対象の検出
// ==============================
function detectPendingNotifications() {
  const rows = db
    .prepare(
      `
    SELECT
      w.id AS watch_id,
      w.user_id,
      w.organization_name,
      w.industry,
      w.last_notified_action_date,
      u.email AS user_email,
      u.name AS user_name,
      COUNT(a.id) AS new_action_count,
      MAX(a.action_date) AS latest_action_date,
      (SELECT a2.action_type FROM administrative_actions a2
       WHERE a2.organization_name_raw = w.organization_name
         AND a2.industry = w.industry
         AND (w.last_notified_action_date IS NULL OR a2.action_date > w.last_notified_action_date)
       ORDER BY a2.action_date DESC NULLS LAST, a2.id DESC LIMIT 1
      ) AS latest_action_type,
      (SELECT a3.prefecture FROM administrative_actions a3
       WHERE a3.organization_name_raw = w.organization_name
         AND a3.industry = w.industry
       ORDER BY a3.action_date DESC NULLS LAST, a3.id DESC LIMIT 1
      ) AS prefecture
    FROM watched_organizations w
    JOIN users u ON u.id = w.user_id AND u.is_active = 1
    LEFT JOIN administrative_actions a
      ON a.organization_name_raw = w.organization_name
      AND a.industry = w.industry
      AND (w.last_notified_action_date IS NULL OR a.action_date > w.last_notified_action_date)
    GROUP BY w.id
    HAVING new_action_count > 0
    ORDER BY w.user_id, latest_action_date DESC
  `
    )
    .all();

  // ユーザーごとにグループ化
  const byUser = new Map();
  for (const row of rows) {
    if (!row.user_email) continue;
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        user: { id: row.user_id, email: row.user_email, name: row.user_name },
        watches: [],
      });
    }
    byUser.get(row.user_id).watches.push({
      watch_id: row.watch_id,
      organization_name: row.organization_name,
      industry: row.industry,
      new_action_count: row.new_action_count,
      latest_action_date: row.latest_action_date,
      latest_action_type: row.latest_action_type,
      prefecture: row.prefecture,
    });
  }
  return byUser;
}

// ==============================
// メール本文生成
// ==============================
function buildDigestEmail(userName, watches) {
  const subject = `[行政処分DB] ウォッチ企業に新しい処分があります（${watches.length}件）`;
  const lines = [];
  lines.push(`${userName || "管理者"} 様`);
  lines.push("");
  lines.push("ウォッチ登録している企業に新しい行政処分が見つかりました。");
  lines.push("");
  lines.push("─────────────────────────────");

  for (const w of watches) {
    lines.push("");
    lines.push(`■ ${w.organization_name}`);
    if (w.industry) lines.push(`  業種: ${INDUSTRY_LABELS[w.industry] || w.industry}`);
    if (w.prefecture) lines.push(`  都道府県: ${w.prefecture}`);
    lines.push(`  新着処分: ${w.new_action_count}件`);
    if (w.latest_action_date) lines.push(`  最新処分日: ${w.latest_action_date.substring(0, 10)}`);
    if (w.latest_action_type) lines.push(`  処分種別: ${ACTION_LABELS[w.latest_action_type] || w.latest_action_type}`);
  }

  lines.push("");
  lines.push("─────────────────────────────");
  lines.push("");
  lines.push(`ウォッチリスト: ${APP_BASE_URL}/admin/watchlist`);
  lines.push("");
  lines.push("---");
  lines.push("行政処分DB 管理通知");
  lines.push(APP_BASE_URL);

  return { subject, bodyText: lines.join("\n") };
}

// ==============================
// 通知カーソル更新
// ==============================
function updateNotifiedCursor(watchIds) {
  if (watchIds.length === 0) return;
  const stmt = db.prepare(`
    UPDATE watched_organizations
    SET last_notified_action_date = COALESCE(
      (SELECT MAX(a.action_date) FROM administrative_actions a
       WHERE a.organization_name_raw = watched_organizations.organization_name
         AND a.industry = watched_organizations.industry),
      last_notified_action_date
    ),
    updated_at = datetime('now')
    WHERE id = ?
  `);
  db.transaction(() => {
    for (const id of watchIds) stmt.run(id);
  })();
}

// ==============================
// Parse args
// ==============================
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// ==============================
// Main
// ==============================
const startTime = Date.now();

console.log("========================================");
console.log("  ウォッチリスト通知ランナー");
console.log("========================================");
console.log(`ドライラン: ${dryRun ? "ON" : "OFF"}`);
console.log(`開始:       ${new Date().toISOString()}`);
console.log("");

const pendingByUser = detectPendingNotifications();
const totalWatches = [...pendingByUser.values()].reduce(
  (sum, { watches }) => sum + watches.length,
  0
);

console.log(`通知対象: ${pendingByUser.size}ユーザー / ${totalWatches}ウォッチ`);

if (pendingByUser.size === 0) {
  const durationMs = Date.now() - startTime;
  const result = {
    success: true,
    usersNotified: 0,
    watchesNotified: 0,
    emailsSent: 0,
    emailsFailed: 0,
    dryRun,
    durationMs,
  };
  console.log("");
  console.log("通知対象なし。");
  console.log("");
  // JSON 結果行（workflow がパースする）
  console.log(`NOTIFY_RESULT=${JSON.stringify(result)}`);
  console.log("========================================");
  db.close();
  process.exit(0);
}

// メール送信処理（async）
async function sendNotifications() {
  let transporter;
  let transporterType = "unknown";

  if (!dryRun) {
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      transporterType = "smtp";
      console.log(`SMTP: ${process.env.SMTP_HOST}`);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        tls: { rejectUnauthorized: false },
      });
      transporterType = "ethereal";
      console.log(`Ethereal: ${testAccount.user}`);
    }
  }

  const from =
    process.env.MAIL_FROM || "行政処分DB <noreply@taikainavi.jp>";
  let emailsSent = 0;
  let emailsFailed = 0;

  console.log("");
  for (const [userId, { user, watches }] of pendingByUser) {
    const { subject, bodyText } = buildDigestEmail(user.name, watches);
    const watchIds = watches.map((w) => w.watch_id);

    if (dryRun) {
      console.log(
        `  [dry-run] ${user.email}: ${watches.length}件 — ${subject}`
      );
      continue;
    }

    try {
      const result = await transporter.sendMail({
        from,
        to: user.email,
        subject,
        text: bodyText,
      });

      // 送信成功 → カーソル更新
      updateNotifiedCursor(watchIds);
      emailsSent++;

      let previewInfo = "";
      if (transporterType === "ethereal") {
        const url = nodemailer.getTestMessageUrl(result);
        if (url) previewInfo = ` → ${url}`;
      }
      console.log(
        `  #${userId} ✓ sent to ${user.email} (${watches.length}件)${previewInfo}`
      );
    } catch (error) {
      emailsFailed++;
      console.log(
        `  #${userId} ✗ failed to ${user.email}: ${error.message}`
      );
    }
  }

  return { emailsSent, emailsFailed, transporterType };
}

sendNotifications()
  .then(({ emailsSent, emailsFailed, transporterType }) => {
    const durationMs = Date.now() - startTime;

    const result = {
      success: emailsFailed === 0,
      usersNotified: emailsSent,
      watchesNotified: totalWatches,
      emailsSent,
      emailsFailed,
      dryRun,
      transporterType: dryRun ? "none" : transporterType,
      durationMs,
    };

    console.log("");
    console.log("========================================");
    console.log("  ウォッチリスト通知 サマリー");
    console.log("========================================");
    console.log(`  ステータス:   ${result.success ? "success" : "partial_failure"}`);
    console.log(`  対象ユーザー: ${pendingByUser.size}人`);
    console.log(`  対象ウォッチ: ${totalWatches}件`);
    console.log(`  送信成功:     ${emailsSent}通`);
    console.log(`  送信失敗:     ${emailsFailed}通`);
    console.log(`  ドライラン:   ${dryRun ? "ON" : "OFF"}`);
    console.log(`  実行時間:     ${durationMs}ms`);
    console.log("========================================");

    // JSON 結果行（workflow がパースする）
    console.log(`NOTIFY_RESULT=${JSON.stringify(result)}`);

    if (emailsFailed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("\n!!! 致命的エラー !!!");
    console.error(error.message);
    console.error(error.stack);

    const result = {
      success: false,
      usersNotified: 0,
      watchesNotified: totalWatches,
      emailsSent: 0,
      emailsFailed: 0,
      dryRun,
      error: error.message,
    };
    console.log(`NOTIFY_RESULT=${JSON.stringify(result)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
