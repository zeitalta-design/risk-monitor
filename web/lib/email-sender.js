/**
 * メール送信サービス
 * nodemailer ベースの SMTP 送信
 * env 未設定時は Ethereal テストアカウントを自動生成
 */

import nodemailer from "nodemailer";
import { getDb } from "./db";

let _transporter = null;
let _transporterInfo = null;

/**
 * SMTP トランスポーターを取得（シングルトン）
 * env 設定があればそれを使い、なければ Ethereal テストアカウントを自動生成
 */
export async function getTransporter() {
  if (_transporter) return { transporter: _transporter, info: _transporterInfo };

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    _transporterInfo = {
      type: "smtp",
      host: process.env.SMTP_HOST,
      user: process.env.SMTP_USER,
    };
  } else {
    // Ethereal テストアカウントを自動生成
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      tls: { rejectUnauthorized: false },
    });
    _transporterInfo = {
      type: "ethereal",
      host: "smtp.ethereal.email",
      user: testAccount.user,
      webUrl: "https://ethereal.email",
    };
  }

  return { transporter: _transporter, info: _transporterInfo };
}

/**
 * 1件のメールジョブを送信
 * @param {object} job - email_jobs レコード
 * @param {object} options
 * @param {boolean} options.dryRun - true なら送信せず結果だけ返す
 * @returns {object} { success, messageId?, previewUrl?, error? }
 */
export async function sendEmailJob(job, { dryRun = false } = {}) {
  if (dryRun) {
    return { success: true, dryRun: true };
  }

  const { transporter, info } = await getTransporter();
  const from = process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.jp>";

  try {
    const result = await transporter.sendMail({
      from,
      to: job.to_email,
      subject: job.subject,
      text: job.body_text,
    });

    const response = { success: true, messageId: result.messageId };

    // Ethereal の場合はプレビューURLを取得
    if (info.type === "ethereal") {
      const previewUrl = nodemailer.getTestMessageUrl(result);
      if (previewUrl) response.previewUrl = previewUrl;
    }

    return response;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * pending の email_jobs を一括送信
 * @param {object} options
 * @param {number} options.limit - 最大送信件数
 * @param {boolean} options.dryRun - ドライラン
 * @returns {object} 結果サマリー
 */
export async function sendPendingEmailJobs({ limit = 50, dryRun = false } = {}) {
  const db = getDb();

  const pendingJobs = db
    .prepare("SELECT * FROM email_jobs WHERE status = 'pending' ORDER BY id LIMIT ?")
    .all(limit);

  if (pendingJobs.length === 0) {
    return { pending: 0, sent: 0, failed: 0, results: [] };
  }

  // dry-run でなければトランスポーターを事前に取得してバリデーション
  let transporterInfo = null;
  if (!dryRun) {
    const t = await getTransporter();
    transporterInfo = t.info;
  }

  let sentCount = 0;
  let failedCount = 0;
  const results = [];

  for (const job of pendingJobs) {
    const result = await sendEmailJob(job, { dryRun });

    if (dryRun) {
      results.push({
        id: job.id,
        subject: job.subject,
        to: job.to_email,
        dryRun: true,
      });
      continue;
    }

    if (result.success) {
      db.prepare(
        "UPDATE email_jobs SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
      ).run(job.id);
      sentCount++;
      results.push({
        id: job.id,
        status: "sent",
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      });
    } else {
      db.prepare(
        "UPDATE email_jobs SET status = 'failed', error_message = ? WHERE id = ?"
      ).run(result.error, job.id);
      failedCount++;
      results.push({
        id: job.id,
        status: "failed",
        error: result.error,
      });
    }
  }

  return {
    pending: pendingJobs.length,
    sent: sentCount,
    failed: failedCount,
    dryRun,
    transporterInfo,
    results,
  };
}
