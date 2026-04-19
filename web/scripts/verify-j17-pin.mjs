#!/usr/bin/env node
/**
 * Phase J-17 動作確認スクリプト（Turso）
 *
 * 目的:
 *   - pinDeal / unpinDeal の冪等性と戻り値
 *   - listSavedDeals の並び順（pin 済みが先頭）
 *   - 未保存 slug の pin が not_saved になる
 *   - 既存 saveDeal / unsaveDeal に影響がない
 *
 * 使い方:
 *   node scripts/verify-j17-pin.mjs
 *   node scripts/verify-j17-pin.mjs --cleanup  # テストデータだけ削除
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const repo = await import("../lib/repositories/saved-deals.js");

const db = getDb();
const TEST_USER_ID = 999999;

function cleanup() {
  const n = db.prepare("DELETE FROM saved_deals WHERE user_id = ?").run(TEST_USER_ID).changes || 0;
  console.log(`  cleanup: saved_deals=${n}`);
}

if (process.argv.includes("--cleanup")) { cleanup(); process.exit(0); }

console.log("═══ Phase J-17 動作確認 ═══\n");

function assert(cond, msg) { if (!cond) { console.error("  ✗", msg); throw new Error(msg); } else { console.log("  ✓", msg); } }

try {
  cleanup();

  const items = db.prepare(
    `SELECT slug, status FROM nyusatsu_items WHERE is_published = 1 LIMIT 3`
  ).all();
  assert(items.length >= 3, "テスト用 nyusatsu_items が 3 件以上ある");
  const [a, b, c] = items;

  // ── Step 1: 保存（従来どおり）──
  //   created_at の順序は a < b < c（INSERT 順）を作るため間を空ける。
  //   ただし datetime('now') 精度は秒なので sleep を入れる。
  repo.saveDeal(TEST_USER_ID, a.slug, a.status ?? null);
  await new Promise((r) => setTimeout(r, 1100));
  repo.saveDeal(TEST_USER_ID, b.slug, b.status ?? null);
  await new Promise((r) => setTimeout(r, 1100));
  repo.saveDeal(TEST_USER_ID, c.slug, c.status ?? null);
  console.log("[step1] 3 件保存");

  let list = repo.listSavedDeals({ userId: TEST_USER_ID });
  assert(list.total === 3, "保存 3 件");
  assert(list.items.length === 3, "一覧 3 件");
  // 初期並び: 全部 is_pinned=0 → created_at DESC なので c, b, a の順
  assert(list.items[0].deal_slug === c.slug, "初期先頭は最新保存 c");
  assert(list.items[2].deal_slug === a.slug, "初期末尾は最古保存 a");
  assert(list.items.every((x) => (x.is_pinned || 0) === 0), "初期は全て is_pinned=0");

  // ── Step 2: a を pin → 先頭に来る ──
  let r1 = repo.pinDeal(TEST_USER_ID, a.slug);
  assert(r1.action === "pinned", `pinDeal a: action=pinned (got=${r1.action})`);

  // 冪等
  r1 = repo.pinDeal(TEST_USER_ID, a.slug);
  assert(r1.action === "already_pinned", `pinDeal a 再: already_pinned (got=${r1.action})`);

  list = repo.listSavedDeals({ userId: TEST_USER_ID });
  console.log("[step2] pin 後の順序:", list.items.map((x) => `${x.deal_slug}(pin=${x.is_pinned})`).join(" > "));
  assert(list.items[0].deal_slug === a.slug, "pin した a が先頭");
  assert(list.items[0].is_pinned === 1, "a.is_pinned = 1");
  assert(list.items[1].deal_slug === c.slug && list.items[1].is_pinned === 0, "2 番目は c (pin=0)");
  assert(list.items[2].deal_slug === b.slug && list.items[2].is_pinned === 0, "3 番目は b (pin=0)");

  // ── Step 3: b も pin → pin 同士は created_at DESC ──
  const r2 = repo.pinDeal(TEST_USER_ID, b.slug);
  assert(r2.action === "pinned", "pinDeal b: pinned");
  list = repo.listSavedDeals({ userId: TEST_USER_ID });
  console.log("[step3] 2 件 pin 後:", list.items.map((x) => `${x.deal_slug}(pin=${x.is_pinned})`).join(" > "));
  assert(list.items[0].deal_slug === b.slug, "pin 同士で新しい b が先頭");
  assert(list.items[1].deal_slug === a.slug, "pin 同士で古い a が 2 番目");
  assert(list.items[2].deal_slug === c.slug, "非 pin の c は最後");

  // ── Step 4: unpin ──
  const r3 = repo.unpinDeal(TEST_USER_ID, b.slug);
  assert(r3.action === "unpinned", "unpinDeal b: unpinned");
  const r4 = repo.unpinDeal(TEST_USER_ID, b.slug);
  assert(r4.action === "already_unpinned", `unpinDeal b 再: already_unpinned (got=${r4.action})`);
  list = repo.listSavedDeals({ userId: TEST_USER_ID });
  assert(list.items[0].deal_slug === a.slug, "unpin 後: a が先頭（唯一の pin）");

  // ── Step 5: 未保存 slug への pin/unpin は not_saved ──
  const nope = repo.pinDeal(TEST_USER_ID, "does-not-exist-slug-zzz");
  assert(nope.action === "not_saved", "未保存 slug への pin: not_saved");
  const nope2 = repo.unpinDeal(TEST_USER_ID, "does-not-exist-slug-zzz");
  assert(nope2.action === "not_saved", "未保存 slug への unpin: not_saved");

  // ── Step 6: unsave で pin ごと消える（現行仕様）──
  repo.unsaveDeal(TEST_USER_ID, a.slug);
  list = repo.listSavedDeals({ userId: TEST_USER_ID });
  assert(list.total === 2, "unsave 後 total=2");
  assert(list.items.every((x) => x.deal_slug !== a.slug), "a は一覧から消えた");
  assert(list.items[0].deal_slug === c.slug, "残り 2 件の先頭は最新 c（pin なし）");

  // ── Step 7: 再保存すると pin はリセット（DEFAULT 0）──
  //   既存行は INSERT OR IGNORE で無視、ここは新規行なので pin=0 で入る。
  repo.saveDeal(TEST_USER_ID, a.slug, a.status ?? null);
  list = repo.listSavedDeals({ userId: TEST_USER_ID });
  const aAgain = list.items.find((x) => x.deal_slug === a.slug);
  assert(aAgain && (aAgain.is_pinned || 0) === 0, "再保存した a は is_pinned=0");

  console.log("\n═══ 全チェック通過 ✓ ═══");
} finally {
  cleanup();
}
