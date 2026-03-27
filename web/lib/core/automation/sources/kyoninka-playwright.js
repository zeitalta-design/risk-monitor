/**
 * kyoninka Playwright Source — 国交省建設業者検索（ブラウザ自動操作）
 *
 * Playwright で検索フォームを操作し、結果テーブルから事業者情報を取得する。
 * ページネーション対応: 複数ページ取得可能。
 */

/**
 * Playwright で国交省建設業者を検索・取得
 * @param {Object} options
 * @param {string} options.kenCode - 都道府県コード（デフォルト: "13" 東京都）
 * @param {number} options.maxPages - 最大取得ページ数（デフォルト: 3）
 * @param {number} options.timeout - タイムアウト ms（デフォルト: 20000）
 * @returns {{ items: Array, registrations: Array, errors: string[], totalFetched: number }}
 */
export async function fetchKyoninkaWithPlaywright({ kenCode = "13", maxPages = 5, timeout = 30000 } = {}) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return { items: [], registrations: [], errors: ["Playwright未インストール"], totalFetched: 0 };
  }

  const { chromium } = playwright;
  let browser;
  const allItems = [];
  const allRegistrations = [];
  const errors = [];
  const seenSlugs = new Set();

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    // Step 1: 検索ページにアクセス
    await page.goto("https://etsuran2.mlit.go.jp/TAKKEN/kensetuKensaku.do?outPutKbn=1", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Step 2: 都道府県を選択 + 表示件数を最大に
    await page.selectOption("select[name='kenCode']", kenCode).catch(() => {});
    // dispCount を最大（50件/ページ等）に変更
    try {
      const dispOptions = await page.$$eval("select[name='dispCount'] option", opts => opts.map(o => o.value));
      const maxDisp = dispOptions[dispOptions.length - 1] || "10";
      await page.selectOption("select[name='dispCount']", maxDisp);
    } catch { /* dispCount がない場合は無視 */ }

    // Step 3: 検索実行
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout }).catch(() => {}),
      page.evaluate(() => js_Search("0")),
    ]);
    await page.waitForTimeout(1500);

    // Step 4: 複数ページ取得
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const hasResults = bodyText.includes("許可番号") || bodyText.includes("商号");

      if (!hasResults) {
        if (pageNum === 1) errors.push("検索結果なし");
        break;
      }

      // テーブル行を抽出
      const rows = await page.$$eval("table tr", trs =>
        trs.map(tr => Array.from(tr.querySelectorAll("td, th")).map(c => c.textContent?.trim() || ""))
          .filter(cells => cells.length >= 4)
      );

      // データ行をフィルタ: [No, 許可行政庁, 許可番号, 商号又は名称, 代表者名, ...]
      const dataRows = rows.filter(cells =>
        cells.length >= 4 && /^\d+$/.test(cells[0].trim())
      );

      if (dataRows.length === 0) break;

      for (const row of dataRows) {
        const entityName = row[3] || "";
        const authority = row[1] || "";
        const regNumber = row[2] || "";
        const prefecture = authority || "不明";

        if (!entityName || entityName.length < 2) continue;

        const slug = (prefecture + "-" + entityName)
          .replace(/[（）()【】\[\]\s株式会社有限会社合同会社]/g, "-")
          .replace(/-+/g, "-").replace(/^-|-$/g, "")
          .toLowerCase().substring(0, 80);

        if (!slug || seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);

        allItems.push({
          slug,
          entity_name: entityName,
          normalized_name: entityName,
          prefecture,
          entity_status: "active",
          primary_license_family: "construction",
          source_name: "国土交通省建設業者検索(Playwright)",
        });

        if (regNumber) {
          allRegistrations.push({
            _entity_slug: slug,
            license_family: "construction",
            license_type: "general_construction",
            registration_number: regNumber,
            authority_name: authority,
            prefecture,
            registration_status: "active",
            disciplinary_flag: 0,
            source_name: "国土交通省建設業者検索(Playwright)",
          });
        }
      }

      // 次ページへ遷移（pageListNo1 を使用）
      if (pageNum < maxPages) {
        try {
          const nextPage = pageNum + 1;
          const totalPages = await page.$eval("select[name='pageListNo1']", sel => sel.options.length).catch(() => 1);
          if (nextPage > totalPages) break;

          await page.selectOption("select[name='pageListNo1']", String(nextPage));
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle", timeout }).catch(() => {}),
            page.evaluate(() => js_Search("selectPage")),
          ]);
          await page.waitForTimeout(1500);
        } catch {
          break;
        }
      }
    }
  } catch (err) {
    errors.push(err.message);
  } finally {
    if (browser) await browser.close();
  }

  return {
    items: allItems,
    registrations: allRegistrations,
    errors,
    totalFetched: allItems.length,
  };
}
