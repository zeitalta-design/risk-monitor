#!/usr/bin/env node
/**
 * review待ち一括処理スクリプト
 *
 * Usage:
 *   node scripts/bulk-review.js status                        # 概要
 *   node scripts/bulk-review.js approve-trusted               # 信頼ソースの created を一括承認
 *   node scripts/bulk-review.js approve-domain <domain>       # ドメイン別一括承認
 *   node scripts/bulk-review.js clear-old-notifications [days] # 古い通知を既読化（デフォルト7日）
 *   node scripts/bulk-review.js summary                       # 圧縮後のサマリー
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (command === "status") {
    showStatus(db);
    return;
  }

  if (command === "approve-trusted") {
    approveTrusted(db);
    return;
  }

  if (command === "approve-domain") {
    const domain = args[1];
    if (!domain) { console.log("Usage: bulk-review.js approve-domain <domain-id>"); return; }
    approveDomain(db, domain);
    return;
  }

  if (command === "clear-old-notifications") {
    const days = parseInt(args[1] || "7");
    clearOldNotifications(db, days);
    return;
  }

  if (command === "summary") {
    showSummary(db);
    return;
  }

  console.log("Usage: bulk-review.js <status|approve-trusted|approve-domain|clear-old-notifications|summary>");
}

function showStatus(db) {
  console.log("\n=== review待ち状況 ===\n");

  const total = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
  console.log(`review待ち総件数: ${total}`);

  console.log("\nドメイン × change_type:");
  db.prepare(`
    SELECT domain_id, change_type, COUNT(*) as c
    FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL
    GROUP BY domain_id, change_type ORDER BY domain_id, c DESC
  `).all().forEach(r => console.log(`  ${r.domain_id} / ${r.change_type}: ${r.c}`));

  const notifs = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`\n未読通知: ${notifs}件`);

  console.log("\n信頼ソースからの created（一括承認候補）:");
  const trusted = db.prepare(`
    SELECT domain_id, COUNT(*) as c
    FROM change_logs
    WHERE requires_review = 1 AND reviewed_at IS NULL AND change_type = 'created'
    GROUP BY domain_id
  `).all();
  trusted.forEach(r => console.log(`  ${r.domain_id}: ${r.c}件`));
  const totalTrusted = trusted.reduce((s, r) => s + r.c, 0);
  console.log(`  合計: ${totalTrusted}件 → approve-trusted で一括承認可能`);
}

function approveTrusted(db) {
  console.log("\n=== 信頼ソースの created を一括承認 ===\n");

  // 公的ソース（消費者庁、さんぱいくん、国交省、自治体）からの新規作成は信頼性が高い
  const result = db.prepare(`
    UPDATE change_logs
    SET reviewed_at = datetime('now'), reviewed_by = 'bulk-approve-trusted'
    WHERE requires_review = 1 AND reviewed_at IS NULL AND change_type = 'created'
  `).run();

  console.log(`承認: ${result.changes}件`);

  // updated も承認（信頼ソースからの更新）
  const updated = db.prepare(`
    UPDATE change_logs
    SET reviewed_at = datetime('now'), reviewed_by = 'bulk-approve-trusted'
    WHERE requires_review = 1 AND reviewed_at IS NULL AND change_type = 'updated'
  `).run();
  console.log(`更新承認: ${updated.changes}件`);

  showSummary(db);
}

function approveDomain(db, domainId) {
  console.log(`\n=== ${domainId} の review を一括承認 ===\n`);

  const result = db.prepare(`
    UPDATE change_logs
    SET reviewed_at = datetime('now'), reviewed_by = 'bulk-approve-domain'
    WHERE requires_review = 1 AND reviewed_at IS NULL AND domain_id = ?
  `).run(domainId);

  console.log(`承認: ${result.changes}件`);
  showSummary(db);
}

function clearOldNotifications(db, days) {
  console.log(`\n=== ${days}日以上前の通知を既読化 ===\n`);

  const result = db.prepare(`
    UPDATE admin_notifications
    SET read_at = datetime('now')
    WHERE read_at IS NULL AND created_at < datetime('now', '-' || ? || ' days')
  `).run(days);

  console.log(`既読化: ${result.changes}件`);

  const remaining = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`残り未読: ${remaining}件`);
}

function showSummary(db) {
  console.log("\n=== 圧縮後サマリー ===");
  const reviewPending = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
  const reviewDone = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NOT NULL").get().c;
  const unreadNotifs = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`review待ち: ${reviewPending}件`);
  console.log(`review済み: ${reviewDone}件`);
  console.log(`未読通知: ${unreadNotifs}件`);
}

main().catch((err) => { console.error(err); process.exit(1); });
