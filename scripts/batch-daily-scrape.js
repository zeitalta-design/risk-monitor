/**
 * 日次データ取り込みバッチ（統合版）
 *
 * 1. RUNNET一覧スクレイプ（20ページ）
 * 2. RUNNET詳細補完（未取得50件）
 * 3. MOSHICOM詳細補完（race未取得50件）
 * 4. SPORTS ENTRY一覧スクレイプ（10ページ）
 * 5. 暫定popularity_score再計算
 *
 * Usage:
 *   node scripts/batch-daily-scrape.js
 *   node scripts/batch-daily-scrape.js --dry-run    # 実行計画のみ表示
 *   node scripts/batch-daily-scrape.js --skip-list   # 一覧スキップ
 *   node scripts/batch-daily-scrape.js --pages 10    # ページ数指定（デフォルト20）
 *   node scripts/batch-daily-scrape.js --limit 30    # 詳細取得上限（デフォルト50）
 *
 * Cron設定例（毎日午前6時に実行）:
 *   0 6 * * * cd /path/to/sports-event-app && node scripts/batch-daily-scrape.js >> logs/batch.log 2>&1
 */

const { execSync } = require("child_process");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, skipList: false, pages: 20, limit: 50 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    if (args[i] === "--skip-list") opts.skipList = true;
    if (args[i] === "--pages" && args[i + 1]) opts.pages = parseInt(args[++i]);
    if (args[i] === "--limit" && args[i + 1]) opts.limit = parseInt(args[++i]);
  }
  return opts;
}

function run(label, cmd, opts) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] ${label}`);
  console.log(`  cmd: ${cmd}`);
  if (opts.dryRun) {
    console.log("  (dry-run: skipped)");
    return { success: true, output: "" };
  }
  try {
    const output = execSync(cmd, {
      cwd: path.join(__dirname, ".."),
      encoding: "utf-8",
      timeout: 600_000, // 10分
      stdio: ["ignore", "pipe", "pipe"],
    });
    // 最後の10行だけ表示
    const lines = output.trim().split("\n");
    const tail = lines.slice(-10).join("\n");
    console.log(tail);
    return { success: true, output };
  } catch (err) {
    console.error(`  ERROR: ${err.message?.substring(0, 200)}`);
    return { success: false, output: err.stderr || err.message };
  }
}

// ── Main ──
const opts = parseArgs();
const startTime = Date.now();

console.log("=== 日次データ取り込みバッチ ===");
console.log(`  日時: ${new Date().toISOString()}`);
console.log(`  pages: ${opts.pages}, limit: ${opts.limit}`);
if (opts.dryRun) console.log("  *** DRY RUN ***");

const results = [];

// Step 1: RUNNET一覧
if (!opts.skipList) {
  results.push(run(
    "Step 1/7: RUNNET一覧取り込み",
    `node scripts/scrape-runnet-list.js --pages ${opts.pages}`,
    opts
  ));
} else {
  console.log("\n[SKIP] RUNNET一覧");
}

// Step 2: RUNNET詳細
results.push(run(
  "Step 2/7: RUNNET詳細補完",
  `node scripts/scrape-runnet-detail.js --only-missing --limit ${opts.limit}`,
  opts
));

// Step 3: MOSHICOM一覧
results.push(run(
  "Step 3/7: MOSHICOM一覧取り込み",
  `node scripts/scrape-moshicom-list.js --pages all`,
  opts
));

// Step 4: MOSHICOM詳細
results.push(run(
  "Step 4/7: MOSHICOM詳細補完",
  `node scripts/scrape-moshicom-detail.js --only-missing-races --limit ${opts.limit}`,
  opts
));

// Step 5: SPORTS ENTRY一覧
results.push(run(
  "Step 5/7: SPORTS ENTRY一覧取り込み",
  `node scripts/scrape-sportsentry-list.js --pages all`,
  opts
));

// Step 6: popularity再計算
results.push(run(
  "Step 6/7: 暫定popularity_score再計算",
  `node scripts/calc-initial-popularity.js`,
  opts
));

// サマリー
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const ok = results.filter((r) => r.success).length;
const fail = results.filter((r) => !r.success).length;

console.log(`\n${"=".repeat(60)}`);
console.log(`=== バッチ完了 ===`);
console.log(`  所要時間: ${elapsed}秒`);
console.log(`  成功: ${ok}, 失敗: ${fail}`);
if (fail > 0) {
  console.log("  ⚠ 失敗あり — ログを確認してください");
  process.exitCode = 1;
}
console.log(`${"=".repeat(60)}`);
