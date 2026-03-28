/**
 * Sports Entry 大会一覧ページ取得
 */

const http = require("http");
const https = require("https");

const BASE_URL = "https://www.sportsentry.ne.jp/events/search";
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * URLを取得（リダイレクト対応）
 */
function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith("https") ? https : http;
    const req = mod.get(
      urlStr,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
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
 * @param {number} page - ページ番号
 * @param {object} options - sp_genre: 1=マラソン・ランニング
 * @returns {Promise<{html: string, status: number}>}
 */
async function fetchPage(page = 1, options = {}) {
  const { genre = 1 } = options;
  const params = new URLSearchParams({
    sp_genre: String(genre),
    s_search: "1",
    page: String(page),
  });
  const url = `${BASE_URL}?${params}`;
  const result = await fetchUrl(url);
  return { html: result.data, status: result.status };
}

/**
 * 複数ページを順次取得
 * @param {number} startPage
 * @param {number} endPage
 * @param {object} options
 * @returns {Promise<{pages: Array<{page: number, html: string}>, fetched: number, failed: number}>}
 */
async function fetchPages(startPage = 1, endPage = 3, options = {}) {
  const { verbose = false, genre = 1 } = options;
  const pages = [];
  let failed = 0;
  let stoppedReason = "completed";
  let prevEventIds = null;

  for (let p = startPage; p <= endPage; p++) {
    try {
      const result = await fetchPage(p, { genre });
      if (result.status === 200 && result.html.length > 5000) {
        // 重複ページ検出: 前ページと同じイベントIDなら終端
        const currentIds = (result.html.match(/\/event\/t\/(\d+)/g) || []).sort().join(",");
        if (prevEventIds && currentIds === prevEventIds) {
          if (verbose) console.log(`  Page ${p}: duplicate of previous page, stopping`);
          stoppedReason = "duplicate_page";
          break;
        }
        prevEventIds = currentIds;

        pages.push({ page: p, html: result.html });
        if (verbose) console.log(`  Page ${p} OK (${result.html.length} bytes)`);
      } else {
        if (verbose) console.log(`  Page ${p} SKIP (status=${result.status}, size=${result.html.length})`);
        if (result.html.length < 5000) {
          stoppedReason = "empty_page";
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

  if (stoppedReason === "completed" && pages.length >= endPage - startPage + 1) {
    stoppedReason = "page_limit_reached";
  }

  return { pages, fetched: pages.length, failed, stoppedReason };
}

module.exports = { fetchPage, fetchPages, fetchUrl };
