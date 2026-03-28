/**
 * MOSHICOM 大会一覧ページ取得
 */

const https = require("https");

const BASE_URL = "https://moshicom.com/search";
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      urlStr,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

/**
 * 一覧ページを取得
 * @param {number} page
 * @param {object} options - tag: 検索タグ, perPage: 表示件数
 */
async function fetchPage(page = 1, options = {}) {
  const { tag = "マラソン", perPage = 100 } = options;
  const params = new URLSearchParams({
    tag,
    page: String(page),
    per: String(perPage),
  });
  const url = `${BASE_URL}?${params}`;
  const result = await fetchUrl(url);
  return { html: result.data, status: result.status, url };
}

/**
 * 複数ページを順次取得（終端まで巡回）
 */
async function fetchPages(startPage = 1, endPage = 999, options = {}) {
  const { verbose = false, tag = "マラソン" } = options;
  const pages = [];
  let failed = 0;
  let stoppedReason = "completed";

  for (let p = startPage; p <= endPage; p++) {
    try {
      const result = await fetchPage(p, { tag });
      if (result.status === 200 && result.html.length > 3000) {
        // イベントが含まれているか簡易チェック
        if (!result.html.includes("event_list") && !result.html.includes("eventList") && p > 1) {
          if (verbose) console.log(`  Page ${p}: no events found, stopping`);
          stoppedReason = "no_events";
          break;
        }
        pages.push({ page: p, html: result.html });
        if (verbose) console.log(`  Page ${p} OK (${result.html.length} bytes)`);
      } else {
        if (verbose) console.log(`  Page ${p} SKIP (status=${result.status}, size=${result.html.length})`);
        if (result.html.length < 3000 || result.status === 404) {
          stoppedReason = "end_of_pages";
          break;
        }
        failed++;
      }
    } catch (err) {
      if (verbose) console.log(`  Page ${p} ERROR: ${err.message}`);
      failed++;
      if (failed >= 3) {
        stoppedReason = "too_many_errors";
        break;
      }
    }
    if (p < endPage) await sleep(DELAY_MS);
  }

  if (pages.length > 0 && stoppedReason === "completed" && pages.length >= endPage - startPage + 1) {
    stoppedReason = "page_limit_reached";
  }

  return { pages, fetched: pages.length, failed, stoppedReason };
}

module.exports = { fetchPage, fetchPages, fetchUrl };
