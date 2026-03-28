/**
 * MOSHICOM 一覧データを SQLite へ upsert
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "..", "sql", "001_create_tables.sql");

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

function importEvents(events, options = {}) {
  const { onlyNew = false } = options;
  const db = getDb();
  const now = new Date().toISOString();

  const existingStmt = db.prepare(
    "SELECT id, source_event_id FROM events WHERE source_site = 'moshicom' AND source_event_id = ?"
  );

  const insertStmt = db.prepare(`
    INSERT INTO events (
      source_site, source_event_id, title, normalized_title,
      sport_type, sport_slug, area_region, prefecture, city, venue_name,
      event_date, event_month, entry_start_date, entry_end_date, entry_status,
      source_url, official_url, hero_image_url, description,
      is_active, scraped_at, created_at, updated_at
    ) VALUES (
      @source_site, @source_event_id, @title, @normalized_title,
      @sport_type, @sport_slug, @area_region, @prefecture, @city, @venue_name,
      @event_date, @event_month, @entry_start_date, @entry_end_date, @entry_status,
      @source_url, @official_url, @hero_image_url, @description,
      @is_active, @scraped_at, @created_at, @updated_at
    )
  `);

  const updateStmt = db.prepare(`
    UPDATE events SET
      title = @title,
      normalized_title = @normalized_title,
      sport_type = @sport_type,
      sport_slug = @sport_slug,
      area_region = @area_region,
      prefecture = COALESCE(@prefecture, prefecture),
      city = CASE WHEN @city IS NOT NULL AND @city != '' THEN @city ELSE city END,
      venue_name = CASE WHEN @venue_name IS NOT NULL AND @venue_name != '' THEN @venue_name ELSE venue_name END,
      event_date = COALESCE(@event_date, event_date),
      event_month = COALESCE(@event_month, event_month),
      entry_start_date = COALESCE(@entry_start_date, entry_start_date),
      entry_end_date = COALESCE(@entry_end_date, entry_end_date),
      entry_status = CASE WHEN @entry_status != 'unknown' THEN @entry_status ELSE entry_status END,
      source_url = @source_url,
      hero_image_url = COALESCE(@hero_image_url, hero_image_url),
      description = CASE WHEN @description IS NOT NULL AND @description != '' THEN @description ELSE description END,
      is_active = @is_active,
      scraped_at = @scraped_at,
      updated_at = @updated_at
    WHERE source_site = 'moshicom' AND source_event_id = @source_event_id
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const upsertAll = db.transaction(() => {
    for (const ev of events) {
      const row = {
        source_site: "moshicom",
        source_event_id: ev.source_event_id,
        title: ev.title,
        normalized_title: ev.normalized_title,
        sport_type: ev.sport_type || "marathon",
        sport_slug: ev.sport_slug || ev.sport_type || "marathon",
        area_region: ev.area_region || null,
        prefecture: ev.prefecture || null,
        city: ev.city || null,
        venue_name: ev.venue_name || null,
        event_date: ev.event_date || null,
        event_month: ev.event_month || null,
        entry_start_date: ev.entry_start_date || null,
        entry_end_date: ev.entry_end_date || null,
        entry_status: ev.entry_status || "unknown",
        source_url: ev.source_url || null,
        official_url: ev.official_url || null,
        hero_image_url: ev.hero_image_url || null,
        description: ev.description || null,
        is_active: 1,
        scraped_at: now,
        created_at: now,
        updated_at: now,
      };

      const existing = existingStmt.get(ev.source_event_id);
      if (existing) {
        if (onlyNew) { skipped++; continue; }
        updateStmt.run(row);
        updated++;
      } else {
        insertStmt.run(row);
        inserted++;
      }
    }
  });

  upsertAll();

  const total = db.prepare("SELECT COUNT(*) as c FROM events WHERE source_site = 'moshicom'").get().c;
  db.close();

  return { inserted, updated, skipped, total };
}

module.exports = { importEvents };
