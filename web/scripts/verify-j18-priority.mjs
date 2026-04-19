#!/usr/bin/env node
/**
 * Phase J-18 動作確認スクリプト
 *
 * 目的:
 *   - computeSavedDealPriority が仕様どおり score / label / reasons を出す
 *   - sortSavedDealsByPriority で pin が絶対的に先頭、期限切れ/終了は末尾、
 *     中間は priority_score DESC で並ぶ
 *   - listSavedDeals (Turso 実 DB 越し) が priority を含むレスポンスを返す
 *
 * 使い方:
 *   node scripts/verify-j18-priority.mjs
 *   node scripts/verify-j18-priority.mjs --cleanup
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
const { computeSavedDealPriority, sortSavedDealsByPriority, jstToday } =
  await import("../lib/saved-deals-priority.js");
const { getDb } = await import("../lib/db.js");
const repo = await import("../lib/repositories/saved-deals.js");

const db = getDb();
const TEST_USER_ID = 999999;

function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); throw new Error(msg); }
  console.log("  ✓", msg);
}
function cleanup() {
  const n = db.prepare("DELETE FROM saved_deals WHERE user_id = ?").run(TEST_USER_ID).changes || 0;
  console.log(`  cleanup: saved_deals=${n}`);
}
if (process.argv.includes("--cleanup")) { cleanup(); process.exit(0); }

console.log("═══ Phase J-18 動作確認 ═══\n");

// ── Part A: computeSavedDealPriority の単体ケース ──
const today = "2026-04-19";

console.log("[A-1] open × 締切2日後 × 予算1.5億 → 高 / 締切が近い");
{
  const r = computeSavedDealPriority(
    { is_pinned: 0, status: "open", deadline: "2026-04-21", budget_amount: 150_000_000 },
    { todayYmd: today },
  );
  // base = open(+10) + ≤3日(+30) + 1億以上(+5) = 45
  assert(r.priority_score === 45, `score=${r.priority_score} 期待 45`);
  assert(r.priority_label === "高", `label=${r.priority_label}`);
  assert(r.priority_reasons[0] === "締切が近い", `reason0=${r.priority_reasons[0]}`);
  assert(r.priority_reasons.length <= 2, "reasons ≤ 2");
}

console.log("\n[A-2] open × 締切20日後 × 予算小 → 中 / reasons 空");
{
  const r = computeSavedDealPriority(
    { is_pinned: 0, status: "open", deadline: "2026-05-09", budget_amount: 500_000 },
    { todayYmd: today },
  );
  // base = open(+10) + 15〜30日(+0) = 10
  assert(r.priority_score === 10, `score=${r.priority_score} 期待 10`);
  assert(r.priority_label === "中", `label=${r.priority_label}`);
  assert(r.priority_reasons.length === 0, "reasons empty");
}

console.log("\n[A-3] closed × 終了 → 低 / 終了済み");
{
  const r = computeSavedDealPriority(
    { is_pinned: 0, status: "closed", deadline: "2026-03-01", budget_amount: 1_000_000 },
    { todayYmd: today },
  );
  // base = closed(-20) + 過去(-10) = -30
  assert(r.priority_label === "低", `label=${r.priority_label}`);
  assert(r.priority_reasons.includes("期限切れ") || r.priority_reasons.includes("終了済み"),
    "reasons に 期限切れ or 終了済み");
}

console.log("\n[A-4] upcoming × deadline なし → 低 or 中, 公告予定");
{
  const r = computeSavedDealPriority(
    { is_pinned: 0, status: "upcoming", deadline: null, budget_amount: null },
    { todayYmd: today },
  );
  // base = upcoming(+3) = 3 → 低（5 未満）
  assert(r.priority_label === "低", `label=${r.priority_label}`);
  assert(r.priority_reasons.includes("公告予定"), "公告予定 含む");
}

console.log("\n[A-5] pin × closed → 高（pin 勝ち） / ピン留め + 終了済み");
{
  const r = computeSavedDealPriority(
    { is_pinned: 1, status: "closed", deadline: "2026-03-01", budget_amount: null },
    { todayYmd: today },
  );
  assert(r.priority_score > 9000, `pin score ${r.priority_score} > 9000`);
  assert(r.priority_label === "高", "pin は label 高");
  assert(r.priority_reasons[0] === "ピン留め", "reason 先頭は ピン留め");
}

console.log("\n[A-6] 期限切れ open → 低 / 期限切れ");
{
  const r = computeSavedDealPriority(
    { is_pinned: 0, status: "open", deadline: "2026-04-10", budget_amount: null },
    { todayYmd: today },
  );
  assert(r.priority_label === "低", `label=${r.priority_label}`);
  assert(r.priority_reasons[0] === "期限切れ", `reason0=${r.priority_reasons[0]}`);
}

// ── Part B: ソート ──
console.log("\n[B] sortSavedDealsByPriority の並び");
{
  const rows = [
    // closed: 低優先
    { saved_id: 1, deal_slug: "closed-item",   is_pinned: 0, status: "closed",   deadline: "2026-03-01", budget_amount: null, saved_at: "2026-04-19 10:00:00" },
    // 締切近い: 高優先
    { saved_id: 2, deal_slug: "hot",           is_pinned: 0, status: "open",     deadline: "2026-04-20", budget_amount: null, saved_at: "2026-04-19 10:00:00" },
    // pin 済み closed: 絶対先頭
    { saved_id: 3, deal_slug: "pinned-closed", is_pinned: 1, status: "closed",   deadline: "2026-03-01", budget_amount: null, saved_at: "2026-04-19 10:00:00" },
    // 普通 open 20日後: 中
    { saved_id: 4, deal_slug: "mid",           is_pinned: 0, status: "open",     deadline: "2026-05-09", budget_amount: null, saved_at: "2026-04-19 10:00:00" },
  ].map((r) => ({ ...r, ...computeSavedDealPriority(r, { todayYmd: today }) }));

  sortSavedDealsByPriority(rows);
  const order = rows.map((r) => r.deal_slug);
  console.log("    order:", order.join(" > "));
  assert(order[0] === "pinned-closed", "pin 済みが先頭");
  assert(order[1] === "hot",            "次に 締切近い open");
  assert(order[2] === "mid",            "次に 通常 open");
  assert(order[3] === "closed-item",    "末尾は closed");
}

// ── Part C: listSavedDeals (Turso 実 DB) ──
console.log("\n[C] listSavedDeals レスポンスに priority が載っている");
try {
  cleanup();
  const items = db.prepare(
    `SELECT slug, status FROM nyusatsu_items WHERE is_published = 1 LIMIT 2`,
  ).all();
  assert(items.length >= 2, "nyusatsu_items 2 件以上");
  const [a, b] = items;

  repo.saveDeal(TEST_USER_ID, a.slug, a.status ?? null);
  repo.saveDeal(TEST_USER_ID, b.slug, b.status ?? null);
  repo.pinDeal(TEST_USER_ID, b.slug);

  const list = repo.listSavedDeals({ userId: TEST_USER_ID });
  assert(list.total === 2, "total=2");
  assert(list.items.length === 2, "items=2");
  assert(list.items[0].deal_slug === b.slug, "pin した b が先頭");
  for (const it of list.items) {
    assert(typeof it.priority_score === "number", `${it.deal_slug}: priority_score 数値`);
    assert(["高", "中", "低"].includes(it.priority_label), `${it.deal_slug}: label 正しい`);
    assert(Array.isArray(it.priority_reasons), `${it.deal_slug}: reasons 配列`);
  }
} finally {
  cleanup();
}

console.log("\n═══ 全チェック通過 ✓ ═══");
