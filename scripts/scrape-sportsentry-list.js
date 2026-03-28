/**
 * Sports Entry 一覧スクレイプ実行スクリプト
 *
 * Usage:
 *   node scripts/scrape-sportsentry-list.js                  # デフォルト 1〜5ページ
 *   node scripts/scrape-sportsentry-list.js --pages 10       # 1〜10ページ
 *   node scripts/scrape-sportsentry-list.js --only-new       # DB未登録のみ
 *   node scripts/scrape-sportsentry-list.js --verbose        # 詳細ログ
 *   node scripts/scrape-sportsentry-list.js --genre 1        # 1=マラソン(default)
 */

const { fetchPages } = require("../scraper/sportsentry/fetch-list");
const { parsePage, deduplicateEvents } = require("../scraper/sportsentry/parse-list");
const { importEvents } = require("../scraper/sportsentry/import-list");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    startPage: 1,
    endPage: 5,
    verbose: false,
    onlyNew: false,
    genre: 1,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--pages": {
        const val = args[++i];
        options.endPage = (val === "all" || val === "0") ? 999 : (parseInt(val) || 5);
        break;
      }
      case "--start":
        options.startPage = parseInt(args[++i]) || 1;
        break;
      case "--end":
        options.endPage = parseInt(args[++i]) || 5;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--only-new":
        options.onlyNew = true;
        break;
      case "--genre":
        options.genre = parseInt(args[++i]) || 1;
        break;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=== Sports Entry List Scraper ===");
  console.log(`Pages: ${options.startPage} - ${options.endPage}`);
  if (options.verbose) console.log("Verbose: ON");

  // [1/3] Fetch
  console.log("\n[1/3] Fetching HTML pages...");
  const { pages, fetched, failed, stoppedReason } = await fetchPages(
    options.startPage,
    options.endPage,
    { verbose: options.verbose, genre: options.genre }
  );
  console.log(`  Fetched: ${fetched}, Failed: ${failed}, Stopped: ${stoppedReason || "completed"}`);

  if (fetched === 0) {
    console.log("  No pages fetched. Exiting.");
    return;
  }

  // [2/3] Parse
  console.log("\n[2/3] Parsing events...");
  let allEvents = [];
  for (const { page, html } of pages) {
    const events = parsePage(html);
    allEvents.push(...events);
    if (options.verbose) console.log(`  Page ${page}: ${events.length} parsed`);
  }
  allEvents = deduplicateEvents(allEvents);
  console.log(`  Total unique events: ${allEvents.length}`);

  if (allEvents.length > 0) {
    console.log("\n  Sample events:");
    allEvents.slice(0, 3).forEach((e, i) => {
      console.log(`  [${i + 1}] ${e.title} | ${e.prefecture || "?"} | ${e.event_date || "?"} | ${e.entry_status}`);
    });
  }

  // [3/3] Import
  console.log("\n[3/3] Importing to DB...");
  const result = importEvents(allEvents, { onlyNew: options.onlyNew });
  console.log(`  Inserted: ${result.inserted}, Updated: ${result.updated}`);
  if (result.skipped > 0) console.log(`  Skipped (existing): ${result.skipped}`);
  console.log(`  Total Sports Entry events in DB: ${result.total}`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
