/**
 * ウォッチリスト通知サービス
 *
 * watch 対象に新しい行政処分が出た場合にメール通知する。
 * - 通知判定: action_date > last_notified_action_date
 * - ユーザーごとに1通の digest メール
 * - 送信成功時に last_notified_action_date を更新
 * - last_seen_action_date（UI確認済み）とは独立
 *
 * SMTP 送信は既存の email-sender.js (getTransporter) を再利用。
 */

import nodemailer from "nodemailer";
import { getDb } from "./db";
import { getTransporter } from "./email-sender";

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

// ─── 通知対象の検出 ─────────────────────

/**
 * 通知すべき新着処分があるウォッチを取得
 * ユーザーごとにグループ化して返す
 *
 * @returns {Map<number, { user: {id, email, name}, watches: Array }>}
 */
export function detectPendingNotifications() {
  const db = getDb();

  const rows = db.prepare(`
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
  `).all();

  // ユーザーごとにグループ化
  const byUser = new Map();
  for (const row of rows) {
    if (!row.user_email) continue; // メールなしユーザーはスキップ

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
      last_notified_action_date: row.last_notified_action_date,
    });
  }

  return byUser;
}

// ─── メール本文生成 ─────────────────────

/**
 * ユーザーごとの digest メール本文を生成
 */
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
    if (w.industry) {
      lines.push(`  業種: ${INDUSTRY_LABELS[w.industry] || w.industry}`);
    }
    if (w.prefecture) {
      lines.push(`  都道府県: ${w.prefecture}`);
    }
    lines.push(`  新着処分: ${w.new_action_count}件`);
    if (w.latest_action_date) {
      lines.push(`  最新処分日: ${w.latest_action_date.substring(0, 10)}`);
    }
    if (w.latest_action_type) {
      lines.push(`  処分種別: ${ACTION_LABELS[w.latest_action_type] || w.latest_action_type}`);
    }
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

// ─── 通知カーソル更新 ─────────────────────

/**
 * 指定ウォッチの last_notified_action_date を更新
 */
function updateNotifiedCursor(watchIds) {
  if (watchIds.length === 0) return;

  const db = getDb();
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
    for (const id of watchIds) {
      stmt.run(id);
    }
  })();
}

// ─── risk_alerts 挿入（冪等） ─────────────────────

/**
 * 新着処分を risk_alerts テーブルに挿入する。
 * UNIQUE INDEX (user_id, action_id) により重複挿入は INSERT OR IGNORE で無視される。
 *
 * @param {number} userId
 * @param {number} watchId - watched_organizations.id
 * @param {string} organizationName
 * @param {string} industry
 * @param {string|null} lastNotifiedDate - この日付より新しい処分のみ対象
 * @returns {number} 挿入件数
 */
function insertRiskAlertsForWatch(userId, watchId, organizationName, industry, lastNotifiedDate) {
  const db = getDb();

  const dateFilter = lastNotifiedDate
    ? `AND action_date >= '${lastNotifiedDate.replace(/'/g, "''")}'`
    : "";

  const newActions = db.prepare(`
    SELECT id, action_type, action_date, organization_name_raw, industry, summary
    FROM administrative_actions
    WHERE organization_name_raw = @org
      AND industry = @industry
      AND is_published = 1
      ${dateFilter}
    ORDER BY action_date DESC NULLS LAST, id DESC
    LIMIT 50
  `).all({ org: organizationName, industry: industry || "" });

  if (newActions.length === 0) return 0;

  const ACTION_LABELS = {
    license_revocation: "許可取消",
    business_suspension: "業務停止",
    improvement_order: "指示処分",
    warning: "警告",
    guidance: "指導",
    other: "その他",
  };

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO risk_alerts
      (user_id, watched_org_id, action_id, organization_name, industry, action_type, action_date, title, body)
    VALUES
      (@user_id, @watched_org_id, @action_id, @organization_name, @industry, @action_type, @action_date, @title, @body)
  `);

  let inserted = 0;
  db.transaction(() => {
    for (const action of newActions) {
      const label = ACTION_LABELS[action.action_type] || "処分";
      const result = insertStmt.run({
        user_id: userId,
        watched_org_id: watchId,
        action_id: action.id,
        organization_name: organizationName,
        industry: industry || "",
        action_type: action.action_type,
        action_date: action.action_date || null,
        title: `${organizationName}に新しい行政処分が追加されました（${label}）`,
        body: action.summary ? action.summary.slice(0, 200) : null,
      });
      inserted += result.changes;
    }
  })();

  return inserted;
}

/**
 * 全ウォッチ対象に対して risk_alerts を挿入する（冪等）。
 * runWatchlistNotifications と独立して呼び出し可能。
 * @returns {{ inserted: number, watches: number }}
 */
export function syncRiskAlerts() {
  const db = getDb();

  const watches = db.prepare(`
    SELECT w.id, w.user_id, w.organization_name, w.industry, w.last_notified_action_date
    FROM watched_organizations w
    JOIN users u ON u.id = w.user_id AND u.is_active = 1
  `).all();

  let totalInserted = 0;
  for (const w of watches) {
    const inserted = insertRiskAlertsForWatch(
      w.user_id, w.id, w.organization_name, w.industry, w.last_notified_action_date
    );
    totalInserted += inserted;
  }

  return { inserted: totalInserted, watches: watches.length };
}

// ─── メイン実行 ─────────────────────

/**
 * ウォッチ通知を実行
 *
 * @param {object} options
 * @param {boolean} options.dryRun - true なら送信せず結果だけ返す
 * @returns {object} 結果サマリー
 */
export async function runWatchlistNotifications({ dryRun = false } = {}) {
  const pendingByUser = detectPendingNotifications();

  if (pendingByUser.size === 0) {
    return {
      success: true,
      usersNotified: 0,
      watchesNotified: 0,
      emailsSent: 0,
      emailsFailed: 0,
      dryRun,
      details: [],
    };
  }

  let transporterInfo = null;
  if (!dryRun) {
    const t = await getTransporter();
    transporterInfo = t.info;
  }

  const from = process.env.MAIL_FROM || "行政処分DB <noreply@taikainavi.jp>";
  let emailsSent = 0;
  let emailsFailed = 0;
  const details = [];

  for (const [userId, { user, watches }] of pendingByUser) {
    const { subject, bodyText } = buildDigestEmail(user.name, watches);
    const watchIds = watches.map((w) => w.watch_id);

    if (dryRun) {
      details.push({
        userId,
        email: user.email,
        watchCount: watches.length,
        subject,
        dryRun: true,
      });
      continue;
    }

    try {
      const { transporter, info } = await getTransporter();
      const result = await transporter.sendMail({
        from,
        to: user.email,
        subject,
        text: bodyText,
      });

      // 送信成功 → risk_alerts 挿入 → カーソル更新
      for (const w of watches) {
        insertRiskAlertsForWatch(
          userId, w.watch_id, w.organization_name, w.industry, w.last_notified_action_date || null
        );
      }
      updateNotifiedCursor(watchIds);
      emailsSent++;

      const detail = {
        userId,
        email: user.email,
        watchCount: watches.length,
        status: "sent",
        messageId: result.messageId,
      };

      // Ethereal の場合はプレビューURL
      if (info.type === "ethereal") {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) detail.previewUrl = previewUrl;
      }

      details.push(detail);
    } catch (error) {
      // 送信失敗 → カーソルは更新しない（次回リトライ）
      emailsFailed++;
      details.push({
        userId,
        email: user.email,
        watchCount: watches.length,
        status: "failed",
        error: error.message,
      });
    }
  }

  const totalWatches = [...pendingByUser.values()].reduce(
    (sum, { watches }) => sum + watches.length,
    0
  );

  return {
    success: emailsFailed === 0,
    usersNotified: emailsSent,
    watchesNotified: totalWatches,
    emailsSent,
    emailsFailed,
    dryRun,
    transporterInfo,
    details,
  };
}
