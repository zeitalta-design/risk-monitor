/**
 * Docker ビルド時に SSG に必要な空 DB を初期化するスクリプト
 * 本番 DB のスキーマを再現し、空テーブルを作成する
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "risk-monitor.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    source_site TEXT, source_event_id TEXT, title TEXT, normalized_title TEXT,
    sport_type TEXT, sport_slug TEXT, area_region TEXT, prefecture TEXT, city TEXT,
    venue_name TEXT, event_date TEXT, event_month INTEGER,
    entry_start_date TEXT, entry_end_date TEXT, entry_status TEXT,
    source_url TEXT, official_url TEXT, hero_image_url TEXT, description TEXT,
    latitude REAL, longitude REAL, is_active INTEGER DEFAULT 1,
    scraped_at TEXT, created_at TEXT, updated_at TEXT,
    entry_signals_json TEXT, urgency_label TEXT, urgency_level TEXT,
    last_verified_at TEXT, monitor_error_count INTEGER DEFAULT 0,
    monitor_last_error TEXT,
    verification_conflict INTEGER DEFAULT 0, verification_conflict_level INTEGER DEFAULT 0,
    verification_conflict_summary TEXT, verification_conflict_updated_at TEXT,
    verification_status TEXT DEFAULT 'unverified',
    official_entry_status TEXT, official_entry_status_label TEXT, official_checked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS marathon_details (
    id INTEGER PRIMARY KEY, event_id INTEGER,
    course_type TEXT, course_description TEXT, elevation_gain INTEGER,
    aid_stations INTEGER, time_limit TEXT, capacity INTEGER,
    entry_fee_json TEXT, course_map_url TEXT, results_url TEXT,
    organizer TEXT, contact_info TEXT, detail_json TEXT,
    services_json TEXT, parking_info TEXT,
    registration_requirements_text TEXT, health_management_text TEXT, terms_text TEXT
  );
  CREATE TABLE IF NOT EXISTS event_races (
    id INTEGER PRIMARY KEY, event_id INTEGER,
    name TEXT, distance TEXT, distance_km REAL, race_type TEXT,
    entry_fee TEXT, capacity INTEGER, time_limit TEXT,
    category TEXT, note TEXT
  );
  CREATE TABLE IF NOT EXISTS event_tags (
    id INTEGER PRIMARY KEY, event_id INTEGER, tag TEXT
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY, user_id TEXT, event_id INTEGER,
    type TEXT, message TEXT, is_read INTEGER DEFAULT 0, created_at TEXT,
    read_at TEXT, link_url TEXT
  );
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY, user_id TEXT, event_id INTEGER, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, query_json TEXT,
    notify_enabled INTEGER DEFAULT 0, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT,
    name TEXT, role TEXT DEFAULT 'user', created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS event_placements (
    id INTEGER PRIMARY KEY, event_id INTEGER, placement_type TEXT,
    position INTEGER, start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 1,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS event_impressions (
    id INTEGER PRIMARY KEY, event_id INTEGER, placement_type TEXT,
    impression_date TEXT, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS nyusatsu_results (
    id INTEGER PRIMARY KEY, nyusatsu_item_id INTEGER, slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL, issuer_name TEXT, winner_name TEXT,
    winner_corporate_number TEXT, award_amount INTEGER, award_date TEXT,
    num_bidders INTEGER, award_rate REAL, budget_amount INTEGER,
    category TEXT, target_area TEXT, bidding_method TEXT,
    result_url TEXT, source_name TEXT, source_url TEXT, summary TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.close();
console.log("Build DB initialized (Docker build mode)");
