/**
 * RUNNET 一覧スクレイプ実行スクリプト（Phase 5: Cookie/セッション対応）
 *
 * Usage:
 *   node scripts/scrape-runnet-list.js                    # デフォルト 1〜3ページ
 *   node scripts/scrape-runnet-list.js --start 1 --end 10 # ページ範囲指定
 *   node scripts/scrape-runnet-list.js --pages 20         # 1〜20ページ
 *   node scripts/scrape-runnet-list.js --only-new         # DB未登録のみインポート
 *   node scripts/scrape-runnet-list.js --verbose          # 詳細ログ
 *   node scripts/scrape-runnet-list.js --max-events 100   # イベント数上限
 */

const { fetchPages } = require("../scraper/runnet/fetch-list");
const { parsePage } = require("../scraper/runnet/parse-list");
const { importEvents } = require("../scraper/runnet/import-list");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    startPage: 1,
    endPage: 3,
    verbose: false,
    onlyNew: false,
    maxEvents: null,
    cookie: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--start":
        options.startPage = parseInt(args[++i]) || 1;
        break;
      case "--end":
        options.endPage = parseInt(args[++i]) || 3;
        break;
      case "--pages": {
        const val = args[++i];
        options.endPage = (val === "all" || val === "0") ? 999 : (parseInt(val) || 3);
        options.startPage = 1;
        break;
      }
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--only-new":
        options.onlyNew = true;
        break;
      case "--max-events":
        options.maxEvents = parseInt(args[++i]) || null;
        break;
      case "--cookie":
        options.cookie = args[++i];
        break;
    }
  }

  // 後方互換: 位置引数 (startPage endPage)
  const positional = args.filter((a) => !a.startsWith("-") && !isNaN(a));
  if (positional.length >= 2 && !args.some((a) => a.startsWith("--start") || a.startsWith("--end") || a.startsWith("--pages"))) {
    options.startPage = parseInt(positional[0]) || 1;
    options.endPage = parseInt(positional[1]) || 3;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=== RUNNET List Scraper ===");
  console.log(`Pages: ${options.startPage} - ${options.endPage}`);
  if (options.onlyNew) console.log("Mode: only-new (skip existing events)");
  if (options.maxEvents) console.log(`Max events: ${options.maxEvents}`);
  if (options.verbose) console.log("Verbose: ON");
  console.log("");

  // 1. Fetch (new API returns { pages, stats })
  console.log("[1/3] Fetching HTML pages...");
  const { pages, stats: fetchStats } = await fetchPages({
    startPage: options.startPage,
    endPage: options.endPage,
    cookie: options.cookie,
    verbose: options.verbose,
  });

  console.log(`  Fetched: ${fetchStats.fetched}, Skipped: ${fetchStats.skipped}, Failed: ${fetchStats.failed}`);
  console.log(`  Cookie source: ${fetchStats.cookieSource}, Session: ${fetchStats.hasSession ? "YES" : "NO"}`);

  if (pages.length === 0) {
    console.error("No pages fetched. Aborting.");
    if (fetchStats.errors.length > 0) {
      console.error("  Errors:", fetchStats.errors);
    }
    process.exit(1);
  }

  // 2. Parse (adapt {page, html}[] → parsePage per page)
  console.log("\n[2/3] Parsing events...");
  const allEvents = [];
  const seen = new Set();

  for (const { page, html } of pages) {
    const pageEvents = parsePage(html);
    let added = 0;
    for (const ev of pageEvents) {
      if (seen.has(ev.source_event_id)) continue;
      seen.add(ev.source_event_id);
      allEvents.push(ev);
      added++;
    }
    if (options.verbose) {
      console.log(`  Page ${page}: ${pageEvents.length} parsed, ${added} unique`);
    }
  }

  console.log(`  Total unique events: ${allEvents.length}`);

  if (allEvents.length === 0) {
    console.error("No events parsed. Check HTML structure.");
    process.exit(1);
  }

  // maxEvents制限
  let eventsToImport = allEvents;
  if (options.maxEvents && allEvents.length > options.maxEvents) {
    eventsToImport = allEvents.slice(0, options.maxEvents);
    console.log(`  Truncated to ${options.maxEvents} events`);
  }

  // サンプル表示
  console.log("\n  Sample events:");
  eventsToImport.slice(0, 3).forEach((ev, i) => {
    console.log(`  [${i + 1}] ${ev.title} | ${ev.prefecture} | ${ev.event_date} | ${ev.entry_status}`);
  });

  // 3. Import
  console.log("\n[3/3] Importing to DB...");
  const result = importEvents(eventsToImport, { onlyNew: options.onlyNew });
  console.log(`  Inserted: ${result.inserted}, Updated: ${result.updated}`);
  if (options.onlyNew && result.skippedExisting) {
    console.log(`  Skipped (existing): ${result.skippedExisting}`);
  }
  console.log(`  Total RUNNET events in DB: ${result.total}`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
