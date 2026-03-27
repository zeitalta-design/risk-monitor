/**
 * ユーザーseedスクリプト
 *
 * 新規環境構築時に管理者アカウントを作成する。
 * パスワードは環境変数から受け取る（コードに平文を埋め込まない）。
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<strong-password> node scripts/seed-users.js
 *
 * 環境変数:
 *   ADMIN_EMAIL    (必須) 管理者メールアドレス
 *   ADMIN_PASSWORD (必須) 管理者パスワード（8文字以上推奨）
 *   ADMIN_NAME     (任意) 管理者表示名（デフォルト: "管理者"）
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const bcrypt = webRequire("bcryptjs");

// --- 環境変数チェック ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "管理者";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("ERROR: 環境変数 ADMIN_EMAIL と ADMIN_PASSWORD が必須です。");
  console.error("");
  console.error("Usage:");
  console.error(
    '  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD="<strong-password>" node scripts/seed-users.js'
  );
  console.error("");
  console.error("セキュリティのため、パスワードをコードに埋め込むことはできません。");
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 8) {
  console.error("ERROR: ADMIN_PASSWORD は8文字以上にしてください。");
  process.exit(1);
}

// --- DB接続 ---
const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

// --- 管理者ユーザー作成 ---
console.log("=== ユーザーseed ===\n");

const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(ADMIN_EMAIL);

if (existing) {
  console.log(`  スキップ: ${ADMIN_EMAIL} (既存 id=${existing.id})`);
} else {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')"
    )
    .run(ADMIN_EMAIL, hash, ADMIN_NAME);
  console.log(
    `  作成: ${ADMIN_EMAIL} (id=${result.lastInsertRowid}, role=admin)`
  );
}

// --- 旧 demo-user データ移行（既存環境との互換） ---
const adminUser = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(ADMIN_EMAIL);

if (adminUser) {
  const adminKey = String(adminUser.id);
  const tables = ["favorites", "saved_searches", "notification_settings"];
  for (const table of tables) {
    try {
      const updated = db
        .prepare(
          `UPDATE ${table} SET user_key = ? WHERE user_key = 'demo-user-1'`
        )
        .run(adminKey);
      if (updated.changes > 0) {
        console.log(
          `  移行: ${table} demo-user-1 → ${adminKey} (${updated.changes}件)`
        );
      }
    } catch {
      // テーブルが存在しない場合はスキップ
    }
  }
  try {
    const notifUpdated = db
      .prepare(
        "UPDATE notifications SET user_key = ? WHERE user_key = 'demo-user-1'"
      )
      .run(adminKey);
    if (notifUpdated.changes > 0) {
      console.log(
        `  移行: notifications demo-user-1 → ${adminKey} (${notifUpdated.changes}件)`
      );
    }
  } catch {
    // テーブルが存在しない場合はスキップ
  }
  try {
    const emailUpdated = db
      .prepare(
        "UPDATE email_jobs SET user_key = ? WHERE user_key = 'demo-user-1'"
      )
      .run(adminKey);
    if (emailUpdated.changes > 0) {
      console.log(
        `  移行: email_jobs demo-user-1 → ${adminKey} (${emailUpdated.changes}件)`
      );
    }
  } catch {
    // テーブルが存在しない場合はスキップ
  }
}

// --- 結果表示 ---
const allUsers = db.prepare("SELECT id, email, name, role FROM users").all();
console.log("\n--- 全ユーザー ---");
for (const u of allUsers) {
  console.log(`  #${u.id} ${u.email} (${u.name}) [${u.role}]`);
}

console.log("\n=== 完了 ===");
db.close();
