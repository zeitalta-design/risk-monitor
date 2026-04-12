const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

console.log("=== Risk Monitor Seed Data ===");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// スキーマ適用
const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

// サンプル大会データ
const sampleEvents = [
  {
    source_site: "runnet",
    source_event_id: "DEMO001",
    title: "東京マラソン2026",
    normalized_title: "東京マラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "kanto",
    prefecture: "東京都",
    city: "新宿区",
    venue_name: "東京都庁前",
    event_date: "2026-03-01",
    event_month: "3",
    entry_start_date: "2025-08-01",
    entry_end_date: "2025-09-30",
    entry_status: "closed",
    source_url: "https://runnet.jp/entry/demo001",
    official_url: "https://www.marathon.tokyo/",
    description: "国内最大級の市民マラソン大会。都庁前をスタートし、東京の名所を駆け抜ける42.195kmのフルマラソン。",
    is_active: 1,
    races: [
      { race_name: "マラソン", race_type: "full", distance_km: 42.195, fee_min: 16500, fee_max: 16500, capacity: 38000, time_limit: "7時間", start_time: "09:10" },
      { race_name: "10kmの部", race_type: "10k", distance_km: 10, fee_min: 5600, fee_max: 5600, capacity: 500, time_limit: "1時間40分", start_time: "09:15" },
    ],
  },
  {
    source_site: "runnet",
    source_event_id: "DEMO002",
    title: "大阪マラソン2026",
    normalized_title: "大阪マラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "kinki",
    prefecture: "大阪府",
    city: "大阪市",
    venue_name: "大阪城公園",
    event_date: "2026-11-29",
    event_month: "11",
    entry_start_date: "2026-04-01",
    entry_end_date: "2026-06-30",
    entry_status: "upcoming",
    source_url: "https://runnet.jp/entry/demo002",
    official_url: "https://www.osaka-marathon.com/",
    description: "御堂筋を駆け抜ける大阪のビッグマラソン。大阪城公園をフィニッシュとする都市型マラソン。",
    is_active: 1,
    races: [
      { race_name: "マラソン", race_type: "full", distance_km: 42.195, fee_min: 15000, fee_max: 15000, capacity: 32000, time_limit: "7時間", start_time: "09:00" },
    ],
  },
  {
    source_site: "runnet",
    source_event_id: "DEMO003",
    title: "湘南国際マラソン2026",
    normalized_title: "湘南国際マラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "kanto",
    prefecture: "神奈川県",
    city: "大磯町",
    venue_name: "大磯プリンスホテル",
    event_date: "2026-12-06",
    event_month: "12",
    entry_start_date: "2026-06-01",
    entry_end_date: "2026-08-31",
    entry_status: "upcoming",
    source_url: "https://runnet.jp/entry/demo003",
    description: "湘南の海岸線を走る爽快なマラソン。相模湾を望む美しいコース。",
    is_active: 1,
    races: [
      { race_name: "フルマラソン", race_type: "full", distance_km: 42.195, fee_min: 12000, fee_max: 12000, capacity: 20000, time_limit: "6時間30分", start_time: "09:00" },
      { race_name: "ハーフマラソン", race_type: "half", distance_km: 21.0975, fee_min: 8000, fee_max: 8000, capacity: 5000, time_limit: "3時間", start_time: "09:30" },
      { race_name: "10km", race_type: "10k", distance_km: 10, fee_min: 5000, fee_max: 5000, capacity: 3000, time_limit: "1時間30分", start_time: "10:00" },
    ],
  },
  {
    source_site: "runnet",
    source_event_id: "DEMO004",
    title: "名古屋ウィメンズマラソン2026",
    normalized_title: "名古屋ウィメンズマラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "chubu",
    prefecture: "愛知県",
    city: "名古屋市",
    venue_name: "バンテリンドーム ナゴヤ",
    event_date: "2026-03-08",
    event_month: "3",
    entry_start_date: "2025-09-01",
    entry_end_date: "2025-11-30",
    entry_status: "closed",
    source_url: "https://runnet.jp/entry/demo004",
    official_url: "https://womens-marathon.nagoya/",
    description: "世界最大の女性限定マラソン。ナゴヤドームをフィニッシュとし、完走者にはティファニーのペンダントが贈られる。",
    is_active: 1,
    races: [
      { race_name: "マラソン", race_type: "full", distance_km: 42.195, fee_min: 15000, fee_max: 15000, capacity: 20000, time_limit: "7時間", start_time: "09:10" },
    ],
  },
  {
    source_site: "runnet",
    source_event_id: "DEMO005",
    title: "北海道マラソン2026",
    normalized_title: "北海道マラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "hokkaido",
    prefecture: "北海道",
    city: "札幌市",
    venue_name: "大通公園",
    event_date: "2026-08-30",
    event_month: "8",
    entry_start_date: "2026-04-01",
    entry_end_date: "2026-06-15",
    entry_status: "open",
    source_url: "https://runnet.jp/entry/demo005",
    official_url: "https://hokkaido-marathon.com/",
    description: "夏の北海道を舞台にしたフルマラソン。大通公園を発着とし、豊平川沿いの涼しいコースを走る。",
    is_active: 1,
    races: [
      { race_name: "フルマラソン", race_type: "full", distance_km: 42.195, fee_min: 12000, fee_max: 12000, capacity: 15000, time_limit: "5時間", start_time: "08:30" },
    ],
  },
  {
    source_site: "runnet",
    source_event_id: "DEMO006",
    title: "福岡マラソン2026",
    normalized_title: "福岡マラソン2026",
    sport_type: "marathon",
    sport_slug: "marathon",
    area_region: "kyushu",
    prefecture: "福岡県",
    city: "福岡市",
    venue_name: "天神中央公園",
    event_date: "2026-11-08",
    event_month: "11",
    entry_start_date: "2026-05-01",
    entry_end_date: "2026-07-31",
    entry_status: "open",
    source_url: "https://runnet.jp/entry/demo006",
    description: "天神をスタートし、糸島方面の海岸線を走るマラソン。美しい博多湾の景色が楽しめる。",
    is_active: 1,
    races: [
      { race_name: "フルマラソン", race_type: "full", distance_km: 42.195, fee_min: 13000, fee_max: 13000, capacity: 12000, time_limit: "7時間", start_time: "08:20" },
      { race_name: "ファンラン (5.2km)", race_type: "fun", distance_km: 5.2, fee_min: 3000, fee_max: 3000, capacity: 2000, time_limit: null, start_time: "08:40" },
    ],
  },
];

// INSERT
const insertEvent = db.prepare(`
  INSERT OR REPLACE INTO events (
    source_site, source_event_id, title, normalized_title,
    sport_type, sport_slug, area_region, prefecture, city, venue_name,
    event_date, event_month, entry_start_date, entry_end_date, entry_status,
    source_url, official_url, description, is_active
  ) VALUES (
    @source_site, @source_event_id, @title, @normalized_title,
    @sport_type, @sport_slug, @area_region, @prefecture, @city, @venue_name,
    @event_date, @event_month, @entry_start_date, @entry_end_date, @entry_status,
    @source_url, @official_url, @description, @is_active
  )
`);

const insertRace = db.prepare(`
  INSERT INTO event_races (
    event_id, race_name, race_type, distance_km,
    fee_min, fee_max, capacity, time_limit, start_time, sort_order
  ) VALUES (
    @event_id, @race_name, @race_type, @distance_km,
    @fee_min, @fee_max, @capacity, @time_limit, @start_time, @sort_order
  )
`);

const seedAll = db.transaction(() => {
  db.exec("DELETE FROM event_races");
  db.exec("DELETE FROM events");

  for (const ev of sampleEvents) {
    const { races, ...eventData } = ev;
    // Ensure all named parameters have values
    eventData.official_url = eventData.official_url || null;
    const info = insertEvent.run(eventData);
    const eventId = Number(info.lastInsertRowid);

    if (races) {
      races.forEach((race, i) => {
        insertRace.run({
          event_id: eventId,
          race_name: race.race_name,
          race_type: race.race_type || null,
          distance_km: race.distance_km || null,
          fee_min: race.fee_min || null,
          fee_max: race.fee_max || null,
          capacity: race.capacity || null,
          time_limit: race.time_limit || null,
          start_time: race.start_time || null,
          sort_order: i,
        });
      });
    }
  }
});

seedAll();

const count = db.prepare("SELECT COUNT(*) as c FROM events").get();
const raceCount = db.prepare("SELECT COUNT(*) as c FROM event_races").get();
console.log(`Seeded ${count.c} events, ${raceCount.c} races.`);

db.close();
console.log("Done.");
