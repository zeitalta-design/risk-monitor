/**
 * MOSHICOM 詳細再補完スクリプト
 *
 * source_site='moshicom' の大会に対して詳細ページを再取得し、
 * 不足項目（タイトル・開催日・場所・概要・画像・種目）を補完する。
 *
 * Usage:
 *   node scripts/refill-moshicom-details.js                    # 全件
 *   node scripts/refill-moshicom-details.js --limit 20         # 最大20件
 *   node scripts/refill-moshicom-details.js --only-missing      # 不足項目がある大会のみ
 *   node scripts/refill-moshicom-details.js --verbose           # 詳細ログ
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");
const DELAY_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    limit: parseInt(args[args.indexOf("--limit") + 1]) || 999,
    onlyMissing: args.includes("--only-missing"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

// 都道府県リスト（extractPrefecture で使用）
const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const REGION_MAP = {
  "北海道": "hokkaido",
  "青森県": "tohoku", "岩手県": "tohoku", "宮城県": "tohoku", "秋田県": "tohoku", "山形県": "tohoku", "福島県": "tohoku",
  "茨城県": "kanto", "栃木県": "kanto", "群馬県": "kanto", "埼玉県": "kanto", "千葉県": "kanto", "東京都": "kanto", "神奈川県": "kanto",
  "新潟県": "hokuriku", "富山県": "hokuriku", "石川県": "hokuriku", "福井県": "hokuriku",
  "山梨県": "koshinetsu", "長野県": "koshinetsu",
  "岐阜県": "tokai", "静岡県": "tokai", "愛知県": "tokai", "三重県": "tokai",
  "滋賀県": "kinki", "京都府": "kinki", "大阪府": "kinki", "兵庫県": "kinki", "奈良県": "kinki", "和歌山県": "kinki",
  "鳥取県": "chugoku", "島根県": "chugoku", "岡山県": "chugoku", "広島県": "chugoku", "山口県": "chugoku",
  "徳島県": "shikoku", "香川県": "shikoku", "愛媛県": "shikoku", "高知県": "shikoku",
  "福岡県": "kyushu", "佐賀県": "kyushu", "長崎県": "kyushu", "熊本県": "kyushu", "大分県": "kyushu", "宮崎県": "kyushu", "鹿児島県": "kyushu", "沖縄県": "kyushu",
};

function extractPrefectureFromDescription(text) {
  if (!text) return null;
  for (const p of PREFECTURES) {
    if (text.includes(p)) return p;
  }
  return null;
}

async function main() {
  const opts = parseArgs();
  // Dynamic import for ESM module
  const { fetchAndParseMoshicom } = await import("../web/lib/moshicom-fetcher.js");

  const db = getDb();
  const now = new Date().toISOString();

  // 対象大会を取得
  let whereClause = "WHERE source_site = 'moshicom'";
  if (opts.onlyMissing) {
    whereClause += " AND (event_date IS NULL OR event_date = '' OR title LIKE '(%' OR description IS NULL OR description = '')";
  }

  const events = db.prepare(
    `SELECT id, title, source_url, event_date, prefecture, city, venue_name, description, hero_image_url
     FROM events ${whereClause} ORDER BY id LIMIT ?`
  ).all(opts.limit);

  console.log("=== MOSHICOM Detail Refill ===");
  console.log(`  Target: ${events.length} events`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const stats = { title: 0, date: 0, prefecture: 0, description: 0, image: 0, races: 0 };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev.source_url) { skipped++; continue; }

    try {
      if (opts.verbose) process.stdout.write(`  [${i+1}/${events.length}] ${ev.id} ${ev.source_url}... `);

      const result = await fetchAndParseMoshicom(ev.source_url);
      const info = result?.eventInfo;
      const races = result?.races || [];

      if (!info) {
        if (opts.verbose) console.log("EMPTY");
        failed++;
        continue;
      }

      // 更新対象フィールドを構築
      const updates = {};
      const changes = [];

      // タイトル: 壊れたタイトル（括弧始まりや短すぎ）を上書き
      if (info.title && (
        !ev.title || ev.title.startsWith("(") || ev.title.length < 5
      )) {
        updates.title = info.title;
        updates.normalized_title = info.title.replace(/[　\s]+/g, " ").trim();
        changes.push("title");
        stats.title++;
      }

      // 開催日
      if (info.event_date && (!ev.event_date || ev.event_date === "")) {
        updates.event_date = info.event_date;
        updates.event_month = info.event_date.split("-")[1]?.replace(/^0/, "");
        changes.push("date");
        stats.date++;
      }

      // 都道府県（descriptionから再判定して正確に）
      const descText = info.description || "";
      const correctPref = extractPrefectureFromDescription(descText) || info.prefecture;
      if (correctPref && (!ev.prefecture || ev.prefecture === "")) {
        updates.prefecture = correctPref;
        updates.area_region = REGION_MAP[correctPref] || null;
        changes.push("prefecture");
        stats.prefecture++;
      }

      // 市区町村
      if (info.city && (!ev.city || ev.city === "")) {
        updates.city = info.city;
      }

      // 会場
      if (info.venue_name && (!ev.venue_name || ev.venue_name === "")) {
        updates.venue_name = info.venue_name;
      }

      // 説明
      if (info.description && (!ev.description || ev.description === "")) {
        updates.description = info.description;
        changes.push("description");
        stats.description++;
      }

      // 画像
      if (info.hero_image_url && (!ev.hero_image_url || ev.hero_image_url === "")) {
        updates.hero_image_url = info.hero_image_url;
        changes.push("image");
        stats.image++;
      }

      // 受付状況
      if (info.entry_status && info.entry_status !== "unknown") {
        updates.entry_status = info.entry_status;
      }

      // 申込期間
      if (info.entry_start_date) updates.entry_start_date = info.entry_start_date;
      if (info.entry_end_date) updates.entry_end_date = info.entry_end_date;

      // DB更新
      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map(k => `${k} = @${k}`);
        setClauses.push("updated_at = @now", "scraped_at = @now");

        db.prepare(
          `UPDATE events SET ${setClauses.join(", ")} WHERE id = @id`
        ).run({ ...updates, now, id: ev.id });
        updated++;
      } else {
        skipped++;
      }

      // 種目補完
      if (races.length > 0) {
        const hasRaces = db.prepare("SELECT COUNT(*) as c FROM event_races WHERE event_id = ?").get(ev.id).c;
        if (hasRaces === 0) {
          const insertRace = db.prepare(`
            INSERT INTO event_races (event_id, race_name, race_type, distance_km, fee_min, fee_max, capacity, time_limit, start_time, eligibility, sort_order, created_at, updated_at)
            VALUES (@event_id, @race_name, @race_type, @distance_km, @fee_min, @fee_max, @capacity, @time_limit, @start_time, @eligibility, @sort_order, @now, @now)
          `);
          for (const race of races) {
            try {
              insertRace.run({
                event_id: ev.id,
                race_name: race.race_name || "不明",
                race_type: race.race_type || null,
                distance_km: race.distance_km || null,
                fee_min: race.fee_min || null,
                fee_max: race.fee_max || null,
                capacity: race.capacity || null,
                time_limit: race.time_limit || null,
                start_time: race.start_time || null,
                eligibility: race.eligibility || null,
                sort_order: race.sort_order || 0,
                now,
              });
            } catch {}
          }
          stats.races++;
          if (!changes.includes("races")) changes.push(`races(${races.length})`);
        }
      }

      if (opts.verbose) console.log(changes.length > 0 ? changes.join(", ") : "no changes");
    } catch (err) {
      if (opts.verbose) console.log("ERROR:", err.message?.substring(0, 60));
      failed++;
    }

    if (i < events.length - 1) await sleep(DELAY_MS);
  }

  db.close();

  console.log("\n=== Summary ===");
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Title fixed: ${stats.title}`);
  console.log(`  Date fixed: ${stats.date}`);
  console.log(`  Prefecture fixed: ${stats.prefecture}`);
  console.log(`  Description added: ${stats.description}`);
  console.log(`  Image added: ${stats.image}`);
  console.log(`  Races added: ${stats.races}`);
  console.log("=== Done ===");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
