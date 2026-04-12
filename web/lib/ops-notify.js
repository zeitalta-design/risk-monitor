/**
 * Phase228: 運営通知レイヤー
 *
 * チャネル抽象化アーキテクチャ:
 *   notify(event) → channels[].send(payload)
 *
 * 現在対応: Slack Webhook
 * 将来拡張: メール、LINE、Discord 等を channels に追加するだけ
 *
 * 環境変数:
 *   OPS_SLACK_WEBHOOK_URL — Slack Incoming Webhook URL
 *   OPS_NOTIFY_CHANNELS   — 有効チャネル (カンマ区切り, デフォルト: "slack")
 *   APP_BASE_URL           — 管理画面URLのベース
 */

import { siteConfig } from "./site-config";

// ──────────────────────────────
// 通知イベント種別
// ──────────────────────────────
export const OPS_EVENT = {
  INQUIRY_CREATED: "inquiry_created",
  SCRAPING_FAILED: "scraping_failed",
  PATROL_DANGER: "patrol_danger",
};

// ──────────────────────────────
// チャネル定義（抽象レイヤー）
// ──────────────────────────────

/** @typedef {{ type: string, send: (payload: NotifyPayload) => Promise<void> }} NotifyChannel */
/** @typedef {{ event: string, title: string, body: string, fields: {label:string, value:string}[], url?: string, level: 'danger'|'warning'|'info' }} NotifyPayload */

const channels = {
  slack: {
    type: "slack",
    /** Slack Incoming Webhook へ送信 */
    async send(payload) {
      const webhookUrl = process.env.OPS_SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        console.warn("[ops-notify] OPS_SLACK_WEBHOOK_URL が未設定のためSlack通知をスキップしました");
        return;
      }

      const colorMap = { danger: "#dc2626", warning: "#f59e0b", info: "#2563eb" };
      const emojiMap = { danger: "🚨", warning: "⚠️", info: "ℹ️" };

      const slackBody = {
        text: `${emojiMap[payload.level] || ""} ${payload.title}`,
        attachments: [
          {
            color: colorMap[payload.level] || "#6b7280",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: payload.body,
                },
              },
              ...(payload.fields.length > 0
                ? [
                    {
                      type: "section",
                      fields: payload.fields.map((f) => ({
                        type: "mrkdwn",
                        text: `*${f.label}*\n${f.value}`,
                      })),
                    },
                  ]
                : []),
              ...(payload.url
                ? [
                    {
                      type: "actions",
                      elements: [
                        {
                          type: "button",
                          text: { type: "plain_text", text: "管理画面で確認" },
                          url: payload.url,
                          style: payload.level === "danger" ? "danger" : "primary",
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
        ],
      };

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackBody),
        });
        if (!res.ok) {
          console.error(`[ops-notify] Slack送信失敗: ${res.status} ${await res.text()}`);
        }
      } catch (err) {
        console.error("[ops-notify] Slack送信エラー:", err.message);
      }
    },
  },

  // ── メール通知チャネル ──
  email: {
    type: "email",
    async send(payload) {
      const adminEmail = process.env.OPS_ADMIN_EMAIL;
      if (!adminEmail) {
        console.warn("[ops-notify] OPS_ADMIN_EMAIL が未設定のためメール通知をスキップしました");
        return;
      }

      try {
        const { getTransporter } = await import("./email-sender.js");
        const { transporter } = await getTransporter();
        const from = process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.jp>";

        const bodyText = [
          payload.title,
          "",
          payload.body,
          "",
          ...payload.fields.map((f) => `${f.label}: ${f.value}`),
          "",
          payload.url ? `管理画面: ${payload.url}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        await transporter.sendMail({
          from,
          to: adminEmail,
          subject: payload.title,
          text: bodyText,
        });
      } catch (err) {
        console.error("[ops-notify] メール送信エラー:", err.message);
      }
    },
  },
};

// ──────────────────────────────
// 送信ディスパッチャー
// ──────────────────────────────

/**
 * 全有効チャネルにペイロードを送信
 * @param {NotifyPayload} payload
 */
async function dispatch(payload) {
  const enabledStr = process.env.OPS_NOTIFY_CHANNELS || "slack,email";
  const enabled = enabledStr.split(",").map((s) => s.trim()).filter(Boolean);

  const tasks = enabled
    .filter((name) => channels[name])
    .map((name) =>
      channels[name].send(payload).catch((err) => {
        console.error(`[ops-notify] ${name} チャネル送信失敗:`, err.message);
      })
    );

  await Promise.allSettled(tasks);
}

// ──────────────────────────────
// 通知関数（呼び出し側はこれだけ使う）
// ──────────────────────────────

const baseUrl = () => siteConfig.siteUrl;

/**
 * 新規問い合わせ通知
 * @param {{ id: number, inquiry_type: string, subject: string, name: string, priority?: string }} inquiry
 */
export async function notifyInquiryCreated(inquiry) {
  const typeLabels = {
    general: "一般問い合わせ",
    listing_request: "掲載依頼",
    correction: "情報修正依頼",
    deletion: "削除依頼",
    bug_report: "不具合報告",
    organizer_apply: "主催者登録申請",
  };

  await dispatch({
    event: OPS_EVENT.INQUIRY_CREATED,
    level: inquiry.priority === "urgent" ? "danger" : "info",
    title: "[Risk Monitor] 新規問い合わせが届きました",
    body: `*${inquiry.subject}*\n${inquiry.name} さんからの${typeLabels[inquiry.inquiry_type] || "問い合わせ"}です。`,
    fields: [
      { label: "ID", value: `#${inquiry.id}` },
      { label: "種別", value: typeLabels[inquiry.inquiry_type] || inquiry.inquiry_type },
      { label: "送信者", value: inquiry.name },
    ],
    url: `${baseUrl()}/admin/ops/inquiries?id=${inquiry.id}`,
  });
}

/**
 * スクレイピング失敗通知
 * @param {{ id: number, source_name: string, fail_count: number, error_summary?: string }} log
 */
export async function notifyScrapingFailed(log) {
  await dispatch({
    event: OPS_EVENT.SCRAPING_FAILED,
    level: "danger",
    title: `[Risk Monitor] スクレイピング失敗: ${log.source_name}`,
    body: `*${log.source_name}* の巡回でエラーが発生しました。${
      log.error_summary ? `\n> ${log.error_summary}` : ""
    }`,
    fields: [
      { label: "ログID", value: `#${log.id}` },
      { label: "取得元", value: log.source_name },
      { label: "失敗件数", value: `${log.fail_count} 件` },
    ],
    url: `${baseUrl()}/admin/ops/scraping`,
  });
}

/**
 * パトロール危険通知
 * @param {{ issues: { key: string, label: string, count: number }[] }} report
 */
export async function notifyPatrolDanger(report) {
  const dangerIssues = report.issues.filter((i) => i.count > 0);
  if (dangerIssues.length === 0) return;

  const totalCount = dangerIssues.reduce((sum, i) => sum + i.count, 0);
  const issueList = dangerIssues.map((i) => `• ${i.label}: ${i.count}件`).join("\n");

  await dispatch({
    event: OPS_EVENT.PATROL_DANGER,
    level: "warning",
    title: `[Risk Monitor] 品質パトロール: ${totalCount}件の問題を検出`,
    body: `以下の品質問題が検出されました。\n${issueList}`,
    fields: [
      { label: "問題種別数", value: `${dangerIssues.length} 種別` },
      { label: "合計件数", value: `${totalCount} 件` },
    ],
    url: `${baseUrl()}/admin/ops/patrol`,
  });
}
