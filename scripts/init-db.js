const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

console.log("=== Risk Monitor DB Initialization ===");
console.log("DB Path:", DB_PATH);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

console.log("Tables created successfully.");

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).all();
console.log("\nTables:");
tables.forEach((t) => console.log(`  - ${t.name}`));

db.close();
console.log("\nDone.");
