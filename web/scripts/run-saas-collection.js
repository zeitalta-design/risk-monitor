#!/usr/bin/env node
/**
 * SaaS比較ナビ 半自動収集スクリプト
 *
 * Usage:
 *   node scripts/run-saas-collection.js                     # 優先3カテゴリ全件
 *   node scripts/run-saas-collection.js --category crm      # CRMのみ
 *   node scripts/run-saas-collection.js --limit 5            # 5件のみ
 *   node scripts/run-saas-collection.js --status             # 収集状況確認
 */

async function main() {
  const args = process.argv.slice(2);
  const category = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
  const limit = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : 20;
  const statusOnly = args.includes("--status");

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (statusOnly) {
    showStatus(db);
    return;
  }

  const { collectSaasInfo, detectSaasChanges, getSaasCollectionTargets } = await import("../lib/core/automation/sources/saas-collector.js");

  const categories = category ? [category] : ["crm", "project", "accounting", "hr", "communication", "ma"];
  const targets = getSaasCollectionTargets(db, { categories, limit });

  console.log(`\n=== SaaS 半自動収集 (${targets.length}件) ===\n`);

  // sync_run 記録
  const runResult = db.prepare(`
    INSERT INTO sync_runs (domain_id, run_type, run_status, started_at, created_at)
    VALUES ('saas', 'collection', 'running', datetime('now'), datetime('now'))
  `).run();
  const runId = runResult.lastInsertRowid;

  let collected = 0, changed = 0, unchanged = 0, failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    process.stdout.write(`  [${i + 1}/${targets.length}] ${item.title}... `);

    const result = await collectSaasInfo(item);

    if (result.errors.length > 0) {
      console.log(`❌ ${result.errors[0]}`);
      failed++;
      continue;
    }

    collected++;

    // 差分検知
    const changes = detectSaasChanges(item, result.data);

    if (changes.length > 0) {
      console.log(`⚠️ ${changes.length}件の差分`);
      changes.forEach(c => console.log(`    ${c.field}: ${c.before} → ${c.after}`));

      // change_log に記録
      for (const c of changes) {
        db.prepare(`
          INSERT INTO change_logs (domain_id, sync_run_id, entity_type, entity_id, entity_slug,
            change_type, field_name, before_value, after_value, requires_review, created_at)
          VALUES ('saas', ?, 'saas_item', ?, ?, 'updated', ?, ?, ?, 1, datetime('now'))
        `).run(runId, item.id, item.slug, c.field, c.before, c.after);
      }
      changed++;
    } else {
      // 新規情報の補完（空フィールドのみ）
      let supplemented = 0;
      const ext = JSON.parse(item.extension_json || "{}");

      if (result.data.free_plan !== undefined && ext.free_plan === undefined) {
        ext.free_plan = result.data.free_plan;
        supplemented++;
      }
      if (result.data.trial !== undefined && ext.trial === undefined) {
        ext.trial = result.data.trial;
        supplemented++;
      }
      if (result.data.price_min && (!item.price_min || item.price_min === 0)) {
        db.prepare("UPDATE items SET price_min = ? WHERE id = ?").run(result.data.price_min, item.id);
        supplemented++;
      }
      if (result.data.price_max && (!item.price_max || item.price_max === 0)) {
        db.prepare("UPDATE items SET price_max = ? WHERE id = ?").run(result.data.price_max, item.id);
        supplemented++;
      }

      if (supplemented > 0) {
        db.prepare("UPDATE items SET extension_json = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(ext), item.id);
        console.log(`✅ +${supplemented}項目補完`);
      } else {
        console.log(`✓ unchanged`);
      }
      unchanged++;
    }
  }

  // sync_run 完了
  db.prepare(`
    UPDATE sync_runs SET run_status = 'completed', fetched_count = ?, created_count = 0,
      updated_count = ?, unchanged_count = ?, failed_count = ?, finished_at = datetime('now')
    WHERE id = ?
  `).run(targets.length, changed, unchanged, failed, runId);

  // 通知
  if (changed > 0) {
    db.prepare(`
      INSERT INTO admin_notifications (domain_id, notification_type, title, message, created_at)
      VALUES ('saas', 'warning', ?, ?, datetime('now'))
    `).run(
      `[saas] 収集完了: ${changed}件の差分検出`,
      `${targets.length}件中 差分${changed}件, 不変${unchanged}件, 失敗${failed}件`
    );
  }

  console.log(`\n=== 結果 (Run #${runId}) ===`);
  console.log(`収集: ${collected}件, 差分: ${changed}件, 不変: ${unchanged}件, 失敗: ${failed}件`);
}

function showStatus(db) {
  console.log("\n=== SaaS 収集状況 ===");
  const total = db.prepare("SELECT COUNT(*) as c FROM items WHERE is_published = 1").get().c;
  const withUrl = db.prepare("SELECT COUNT(*) as c FROM items WHERE is_published = 1 AND url IS NOT NULL AND url != ''").get().c;
  const withExt = db.prepare("SELECT COUNT(*) as c FROM items WHERE is_published = 1 AND extension_json IS NOT NULL AND extension_json != '{}'").get().c;

  console.log(`公開件数: ${total}`);
  console.log(`公式URL設定: ${withUrl}`);
  console.log(`extension_json あり: ${withExt}`);

  // 最新 sync_run
  const lastRun = db.prepare("SELECT * FROM sync_runs WHERE domain_id = 'saas' ORDER BY id DESC LIMIT 1").get();
  if (lastRun) {
    console.log(`\n最終収集: Run #${lastRun.id} (${lastRun.run_status}) ${lastRun.started_at}`);
    console.log(`  取得: ${lastRun.fetched_count}, 差分: ${lastRun.updated_count}, 不変: ${lastRun.unchanged_count}, 失敗: ${lastRun.failed_count}`);
  }

  // カテゴリ別
  console.log("\nカテゴリ別:");
  db.prepare("SELECT category, COUNT(*) as c FROM items WHERE is_published = 1 GROUP BY category ORDER BY c DESC").all()
    .forEach(r => console.log(`  ${r.category}: ${r.c}`));
}

main().catch(console.error);
