/**
 * メール送信スクリプト
 *
 * Usage:
 *   node scripts/send-emails.js
 *   node scripts/send-emails.js --limit 10
 *   node scripts/send-emails.js --dry-run
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

// --- Parse args ---
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
let limit = 50;
const limitIdx = args.indexOf("--limit");
if (limitIdx !== -1 && args[limitIdx + 1]) {
  limit = Number(args[limitIdx + 1]);
}

const startTime = Date.now();
console.log("=== メール送信 ===");
console.log(`モード:   ${dryRun ? "ドライラン（送信なし）" : "実送信"}`);
console.log(`上限:     ${limit}件`);
console.log(`開始:     ${new Date().toISOString()}`);

async function main() {
  // pending 取得
  const pendingJobs = db
    .prepare("SELECT * FROM email_jobs WHERE status = 'pending' ORDER BY id LIMIT ?")
    .all(limit);

  console.log(`\npending: ${pendingJobs.length}件`);

  if (pendingJobs.length === 0) {
    console.log("\n送信対象がありません。");
    return;
  }

  if (dryRun) {
    console.log("\n--- ドライラン: 送信対象一覧 ---");
    for (const job of pendingJobs) {
      console.log(`  #${job.id} [${job.send_type}] → ${job.to_email}`);
      console.log(`    件名: ${job.subject}`);
    }
    console.log(`\n合計: ${pendingJobs.length}件（ドライランのため送信されません）`);
    return;
  }

  // トランスポーター準備
  let transporter;
  let transporterType;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    transporterType = `SMTP (${process.env.SMTP_HOST})`;
    console.log(`\nSMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
  } else {
    console.log("\nSMTP設定なし → Ethereal テストアカウントを生成中...");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      tls: { rejectUnauthorized: false },
    });
    transporterType = "Ethereal (テスト)";
    console.log(`  Ethereal User: ${testAccount.user}`);
    console.log(`  Ethereal Web:  https://ethereal.email`);
  }

  const from = process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.com>";
  console.log(`From: ${from}`);
  console.log(`Transport: ${transporterType}`);

  // 送信
  console.log("\n--- 送信中 ---");
  let sentCount = 0;
  let failedCount = 0;

  for (const job of pendingJobs) {
    try {
      const result = await transporter.sendMail({
        from,
        to: job.to_email,
        subject: job.subject,
        text: job.body_text,
      });

      db.prepare(
        "UPDATE email_jobs SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
      ).run(job.id);
      sentCount++;

      let previewUrl = "";
      if (!process.env.SMTP_HOST) {
        const url = nodemailer.getTestMessageUrl(result);
        if (url) previewUrl = ` → ${url}`;
      }
      console.log(`  #${job.id} ✓ sent${previewUrl}`);
    } catch (error) {
      db.prepare(
        "UPDATE email_jobs SET status = 'failed', error_message = ? WHERE id = ?"
      ).run(error.message, job.id);
      failedCount++;
      console.log(`  #${job.id} ✗ failed: ${error.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n=== 完了 (${durationMs}ms) ===`);
  console.log(`  対象:   ${pendingJobs.length}件`);
  console.log(`  送信済: ${sentCount}件`);
  console.log(`  失敗:   ${failedCount}件`);

  // DB stats
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      COUNT(*) as total
    FROM email_jobs
  `).get();
  console.log(`\n  DB状態: pending=${stats.pending} / sent=${stats.sent} / failed=${stats.failed} / total=${stats.total}`);
}

main()
  .catch((error) => {
    console.error("\n!!! エラー発生 !!!");
    console.error(error.message);
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
