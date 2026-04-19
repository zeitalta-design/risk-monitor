/**
 * 認証ライブラリ
 * Cookie/Session ベースの認証基盤
 *
 * Phase229: 正式化
 * - セッション管理強化（secure切替・クリーンアップ）
 * - 監査ログ統合
 * - レート制限統合
 * - パスワード変更機能
 * - MFA拡張ポイント（将来用）
 */

import { getDb } from "./db";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit-log";
import {
  checkLoginAllowed,
  recordLoginFailure,
  resetLoginAttempts,
} from "./rate-limiter";

// --- 設定定数 ---
const SESSION_COOKIE = "mvp_session";
const SESSION_MAX_AGE_DAYS = 30;
const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * SESSION_SECRET を取得
 * 本番では instrumentation.js で起動時に検証済み
 * 開発時は固定フォールバックを使用
 */
function getSessionSecret() {
  return process.env.SESSION_SECRET || "dev-only-insecure-fallback-key-do-not-use-in-production";
}

/**
 * セッショントークンに HMAC 署名を付与
 * 形式: {token}.{signature}
 */
function signToken(token) {
  const hmac = crypto.createHmac("sha256", getSessionSecret());
  hmac.update(token);
  const signature = hmac.digest("hex").slice(0, 16); // 先頭16文字で十分
  return `${token}.${signature}`;
}

/**
 * 署名付きトークンを検証・分離
 * @returns {string|null} 署名が正しければ元のトークン、不正なら null
 */
function verifySignedToken(signedToken) {
  if (!signedToken || typeof signedToken !== "string") return null;

  const lastDot = signedToken.lastIndexOf(".");
  if (lastDot === -1) {
    // 署名なし旧形式 — 移行期は許容（開発環境のみ）
    if (!IS_PRODUCTION) return signedToken;
    return null;
  }

  const token = signedToken.slice(0, lastDot);
  const sig = signedToken.slice(lastDot + 1);

  const hmac = crypto.createHmac("sha256", getSessionSecret());
  hmac.update(token);
  const expected = hmac.digest("hex").slice(0, 16);

  // タイミング安全比較
  if (sig.length !== expected.length) return null;
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  return token;
}

// --- パスワード ---

/**
 * パスワードハッシュ生成
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * パスワード検証
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * パスワード強度バリデーション
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `パスワードは${PASSWORD_MIN_LENGTH}文字以上必要です`,
    };
  }
  return { valid: true, error: null };
}

// --- セッション ---

/**
 * セッショントークン生成（暗号論的に安全）
 */
function generateSessionToken() {
  return crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
}

/**
 * セッション作成
 * DB にはプレーントークンを保存し、Cookie には署名付きトークンを返す
 */
export function createSession(userId) {
  const db = getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  db.prepare(
    "INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);

  // Cookie に設定する値は署名付き
  const signedToken = signToken(token);
  return { token: signedToken, expiresAt };
}

/**
 * セッションCookieを設定
 */
export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

/**
 * セッションCookieを削除
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * 現在のユーザーを取得（nullならログインしていない）
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (!sessionCookie?.value) return null;

    // 署名検証 → プレーントークンを取り出す
    const token = verifySignedToken(sessionCookie.value);
    if (!token) return null;

    const db = getDb();
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.is_active,
                u.last_login_at, u.password_changed_at,
                u.is_pro, u.stripe_customer_id, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = ? AND u.is_active = 1`
      )
      .get(token);

    if (!row) return null;

    // 期限チェック
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    if (row.expires_at < now) {
      db.prepare("DELETE FROM sessions WHERE session_token = ?").run(token);
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      userKey: String(row.id),
      lastLoginAt: row.last_login_at,
      passwordChangedAt: row.password_changed_at,
      isPro: (row.is_pro || 0) === 1,
      stripeCustomerId: row.stripe_customer_id || null,
    };
  } catch {
    return null;
  }
}

/**
 * ログインユーザーの user_key を取得
 */
export async function getUserKeyFromSession() {
  const user = await getCurrentUser();
  return user ? user.userKey : null;
}

/**
 * admin ロール確認
 * @returns {object|null} admin ユーザーまたは null
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// --- 認証操作 ---

/**
 * ユーザー登録
 */
export async function signupUser({ email, password, name }) {
  const db = getDb();

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return { error: passwordCheck.error };
  }

  // 重複チェック
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')"
    )
    .run(email, passwordHash, name || "");

  const userId = result.lastInsertRowid;
  const session = createSession(Number(userId));
  await setSessionCookie(session.token);

  return {
    user: { id: Number(userId), email, name: name || "", role: "user" },
  };
}

/**
 * ログイン（レート制限・監査ログ統合）
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */
export async function loginUser({ email, password, ipAddress, userAgent }) {
  const db = getDb();

  // レート制限チェック
  const rateCheck = checkLoginAllowed(email);
  if (!rateCheck.allowed) {
    writeAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      targetType: "user",
      details: { email, reason: "rate_limited" },
      ipAddress,
      userAgent,
    });
    return {
      error: "ログイン試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。",
    };
  }

  const user = db
    .prepare(
      "SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = ?"
    )
    .get(email);

  if (!user) {
    // .env 管理者認証: DB にユーザーが見つからない場合、ADMIN_EMAIL/PASSWORD と照合
    const envResult = tryEnvAdminLogin(email, password);
    if (envResult) {
      // .env 一致 → DB にユーザーを自動作成し、そのレコードで通常ログインを続行
      const newUser = db
        .prepare("SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = ?")
        .get(email);
      if (newUser && newUser.is_active) {
        resetLoginAttempts(email);
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, newUser.id);
        const session = createSession(newUser.id);
        await setSessionCookie(session.token);
        writeAuditLog({
          userId: newUser.id,
          action: AUDIT_ACTIONS.LOGIN_SUCCESS,
          targetType: "user",
          targetId: String(newUser.id),
          details: { method: "env_admin" },
          ipAddress,
          userAgent,
        });
        return {
          user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
        };
      }
    }

    recordLoginFailure(email);
    writeAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      targetType: "user",
      details: { email, reason: "user_not_found" },
      ipAddress,
      userAgent,
    });
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  if (!user.is_active) {
    writeAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      targetType: "user",
      targetId: String(user.id),
      details: { reason: "account_inactive" },
      ipAddress,
      userAgent,
    });
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const result = recordLoginFailure(email);
    writeAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      targetType: "user",
      targetId: String(user.id),
      details: {
        reason: "wrong_password",
        ...(result.locked ? { locked_until: result.lockedUntil } : {}),
      },
      ipAddress,
      userAgent,
    });
    if (result.locked) {
      return {
        error: "ログイン試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。",
      };
    }
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // 成功 → レート制限リセット
  resetLoginAttempts(email);

  // last_login_at 更新
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, user.id);

  const session = createSession(user.id);
  await setSessionCookie(session.token);

  writeAuditLog({
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    targetType: "user",
    targetId: String(user.id),
    ipAddress,
    userAgent,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/**
 * ログアウト（監査ログ付き）
 */
export async function logoutUser() {
  let userId = null;
  try {
    const user = await getCurrentUser();
    userId = user?.id || null;

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (sessionCookie?.value) {
      const token = verifySignedToken(sessionCookie.value);
      if (token) {
        const db = getDb();
        db.prepare("DELETE FROM sessions WHERE session_token = ?").run(token);
      }
    }
  } catch {}
  await clearSessionCookie();

  if (userId) {
    writeAuditLog({
      userId,
      action: AUDIT_ACTIONS.LOGOUT,
      targetType: "user",
      targetId: String(userId),
    });
  }
}

/**
 * パスワード変更
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.currentPassword
 * @param {string} params.newPassword
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {{ success: boolean, error?: string }}
 */
export async function changePassword({
  userId,
  currentPassword,
  newPassword,
  ipAddress,
  userAgent,
}) {
  const db = getDb();

  // バリデーション
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.error };
  }

  // ユーザー取得
  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1")
    .get(userId);
  if (!user) {
    return { success: false, error: "ユーザーが見つかりません" };
  }

  // 現在パスワード照合
  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return { success: false, error: "現在のパスワードが正しくありません" };
  }

  // 新旧一致チェック
  if (currentPassword === newPassword) {
    return {
      success: false,
      error: "新しいパスワードは現在のパスワードと異なるものにしてください",
    };
  }

  // 更新
  const newHash = await hashPassword(newPassword);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  db.prepare(
    "UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?"
  ).run(newHash, now, userId);

  writeAuditLog({
    userId,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    targetType: "user",
    targetId: String(userId),
    ipAddress,
    userAgent,
  });

  return { success: true };
}

/**
 * 期限切れセッションのクリーンアップ
 * cron や手動で呼ぶ土台
 */
export function cleanupExpiredSessions() {
  try {
    const db = getDb();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const result = db
      .prepare("DELETE FROM sessions WHERE expires_at < ?")
      .run(now);

    if (result.changes > 0) {
      writeAuditLog({
        action: AUDIT_ACTIONS.SESSION_CLEANUP,
        details: { deleted_count: result.changes },
      });
    }

    return { deleted: result.changes };
  } catch (err) {
    console.error("[auth] session cleanup failed:", err.message);
    return { deleted: 0, error: err.message };
  }
}

// --- パスワードリセット ---

const RESET_TOKEN_EXPIRY_MINUTES = 15;

/**
 * リセットトークン生成（暗号論的に安全な64文字hex）
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * パスワードリセット要求
 * メールが存在してもしなくても同じレスポンスを返す（情報漏洩防止）
 * @param {object} params
 * @param {string} params.email
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {{ success: boolean, token?: string, userId?: number }}
 *   token は呼び出し側がメール送信に使う（レスポンスには含めない）
 */
export function requestPasswordReset({ email, ipAddress, userAgent }) {
  const db = getDb();

  const user = db
    .prepare("SELECT id, email, is_active FROM users WHERE email = ? AND is_active = 1")
    .get(email);

  if (!user) {
    // ユーザーが存在しなくても監査ログだけ記録して成功扱い
    writeAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      targetType: "user",
      details: { email, result: "user_not_found" },
      ipAddress,
      userAgent,
    });
    return { success: true };
  }

  // 既存の未使用トークンを無効化（同一ユーザーの二重発行防止）
  db.prepare(
    `UPDATE password_reset_tokens
     SET used_at = datetime('now')
     WHERE user_id = ? AND used_at IS NULL`
  ).run(user.id);

  // トークン生成・保存
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`
  ).run(user.id, token, expiresAt);

  writeAuditLog({
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    targetType: "user",
    targetId: String(user.id),
    details: { email },
    ipAddress,
    userAgent,
  });

  return { success: true, token, userId: user.id };
}

/**
 * パスワードリセット実行
 * @param {object} params
 * @param {string} params.token - リセットトークン
 * @param {string} params.newPassword - 新しいパスワード
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {{ success: boolean, error?: string }}
 */
export async function resetPasswordWithToken({
  token,
  newPassword,
  ipAddress,
  userAgent,
}) {
  const db = getDb();

  // バリデーション
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.error };
  }

  // トークン検証
  const row = db
    .prepare(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.is_active
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = ?`
    )
    .get(token);

  if (!row) {
    return {
      success: false,
      error: "無効なリセットリンクです。再度パスワードリセットを申請してください。",
    };
  }

  // 使用済みチェック
  if (row.used_at) {
    return {
      success: false,
      error: "このリセットリンクは既に使用されています。再度申請してください。",
    };
  }

  // 期限チェック
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (row.expires_at < now) {
    return {
      success: false,
      error: "リセットリンクの有効期限が切れています。再度申請してください。",
    };
  }

  // アカウント有効性チェック
  if (!row.is_active) {
    return {
      success: false,
      error: "このアカウントは現在無効です。",
    };
  }

  // パスワード更新
  const newHash = await hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?"
  ).run(newHash, now, row.user_id);

  // トークンを使用済みに
  db.prepare(
    "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?"
  ).run(now, row.id);

  // 既存セッションを全て無効化（セキュリティ：リセット後は再ログイン必須）
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);

  writeAuditLog({
    userId: row.user_id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
    targetType: "user",
    targetId: String(row.user_id),
    ipAddress,
    userAgent,
  });

  return { success: true };
}

// --- .env 管理者ログイン ---

/**
 * .env の ADMIN_EMAIL / ADMIN_PASSWORD と照合し、一致すればDBにユーザーを作成/更新する。
 * DB操作には admin-seed.js を再利用する。
 * @returns {boolean} 一致してDB作成/更新に成功した場合 true
 */
function tryEnvAdminLogin(email, password) {
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;

  // .env 未設定 or 不一致 → false
  if (!envEmail || !envPassword) return false;
  if (email !== envEmail || password !== envPassword) return false;

  // 一致 → seedAdmin で DB にユーザーを作成/昇格
  try {
    // Dynamic import を避けるため、直接 DB 操作する
    const db = getDb();
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      db.prepare("UPDATE users SET password_hash = ?, role = 'admin', is_active = 1 WHERE id = ?")
        .run(hash, existing.id);
    } else {
      db.prepare("INSERT INTO users (email, password_hash, name, role, is_active) VALUES (?, ?, ?, 'admin', 1)")
        .run(email, hash, "管理者");
    }
    console.log("[auth] .env 管理者としてログイン: DB ユーザーを作成/更新しました");
    return true;
  } catch (err) {
    console.error("[auth] .env 管理者の DB 作成に失敗:", err.message);
    return false;
  }
}

// --- エクスポート定数 ---
export const AUTH_CONFIG = {
  passwordMinLength: PASSWORD_MIN_LENGTH,
  sessionMaxAgeDays: SESSION_MAX_AGE_DAYS,
  resetTokenExpiryMinutes: RESET_TOKEN_EXPIRY_MINUTES,
};
