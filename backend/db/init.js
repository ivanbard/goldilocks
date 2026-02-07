const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'goldilocks.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Seed demo user if none exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    db.prepare(`
      INSERT INTO users (postal_code, plan_type, comfort_min, comfort_max, room_kwh_per_degC, ac_cop)
      VALUES ('K7L', 'TOU', 20.0, 23.0, 0.1, 3.0)
    `).run();

    const userId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    db.prepare(`
      INSERT INTO user_profile (user_id, housing_type, floor_level, lifestyle_notes)
      VALUES (?, 'apartment', 2, '')
    `).run(userId);

    db.prepare(`
      INSERT INTO devices (device_id, user_id, location_name)
      VALUES ('demo-device-001', ?, 'Main Room')
    `).run(userId);

    console.log('Seeded demo user (id=' + userId + ') + device');
  }

  // Migration: add co2_saved_g column if missing
  try {
    db.prepare('SELECT co2_saved_g FROM daily_summary LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE daily_summary ADD COLUMN co2_saved_g REAL DEFAULT 0');
    console.log('Migrated: added co2_saved_g to daily_summary');
  }

  // Migration: add heating_source column to users if missing
  try {
    db.prepare('SELECT heating_source FROM users LIMIT 1').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN heating_source TEXT DEFAULT 'gas'");
    console.log('Migrated: added heating_source to users');
  }
}

module.exports = { getDb, DB_PATH };
