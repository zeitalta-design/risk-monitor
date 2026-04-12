import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";
import { extractRequestInfo } from "@/lib/audit-log";
import { getTransporter } from "@/lib/email-sender";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/request-password-reset
 * パスワードリセットメール送信
 * body: { email }
 *
 * セキュリティ: 存在しないメールでも同一レスポンスを返す
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = extractRequestInfo(request);

    const result = requestPasswordReset({ email, ipAddress, userAgent });

    // トークンが返ってきた場合のみメール送信（ユーザーが存在する）
    if (result.token) {
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";
      const resetUrl = `${baseUrl}/reset-password?token=${result.token}`;

      try {
        const { transporter, info } = await getTransporter();
        const from = process.env.MAIL_FROM || "Risk Monitor <noreply@taikainavi.jp>";

        const mailResult = await transporter.sendMail({
          from,
          to: email,
          subject: "【Risk Monitor】パスワードリセットのご案内",
          text: buildResetEmailText(resetUrl),
        });

        // Ethereal の場合はプレビューURL（開発用ログ）
        if (info.type === "ethereal") {
          const previewUrl = nodemailer.getTestMessageUrl(mailResult);
          if (previewUrl) {
            console.log("[password-reset] Ethereal preview:", previewUrl);
          }
        }
      } catch (err) {
        // メール送信失敗してもレスポンスは同じ（情報漏洩防止）
        console.error("[password-reset] email send failed:", err.message);
      }
    }

    // 常に同一レスポンス
    return NextResponse.json({
      success: true,
      message:
        "ご登録のメールアドレス宛にパスワードリセットの案内を送信しました。メールをご確認ください。",
    });
  } catch (error) {
    console.error("[password-reset] request error:", error.message);
    return NextResponse.json(
      { error: "リクエストの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

/**
 * リセットメール本文
 */
function buildResetEmailText(resetUrl) {
  return `Risk Monitorをご利用いただきありがとうございます。

パスワードリセットのリクエストを受け付けました。
下記のURLにアクセスして、新しいパスワードを設定してください。

${resetUrl}

このリンクの有効期限は15分間です。
期限が切れた場合は、再度パスワードリセットを申請してください。

心当たりのない場合は、このメールを無視してください。
アカウントのパスワードは変更されません。

---
Risk Monitor - スポーツ大会検索・通知サービス
`;
}
