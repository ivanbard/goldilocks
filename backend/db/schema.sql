-- VentSmart Kingston Database Schema

-- Users table (PRD Section 12 + extended for LLM personalization)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postal_code TEXT DEFAULT 'K7L',
  plan_type TEXT DEFAULT 'TOU' CHECK(plan_type IN ('TOU', 'ULO', 'TIERED')),
  comfort_min REAL DEFAULT 20.0,
  comfort_max REAL DEFAULT 23.0,
  room_kwh_per_degC REAL DEFAULT 0.1,
  ac_cop REAL DEFAULT 3.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profile (extended info for LLM-driven notifications)
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  housing_type TEXT DEFAULT 'apartment' CHECK(housing_type IN ('dorm', 'apartment', 'house', 'basement', 'other')),
  floor_level INTEGER,
  known_issues_json TEXT DEFAULT '[]',
  lifestyle_notes TEXT DEFAULT '',
  notification_preferences_json TEXT DEFAULT '{"frequency":"normal","mold_alerts":true,"savings_tips":true,"weather_alerts":true}',
  quiet_hours_start TEXT DEFAULT '22:00',
  quiet_hours_end TEXT DEFAULT '07:00',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  location_name TEXT DEFAULT 'Main Room',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Readings time-series
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  temp_C REAL,
  humidity_RH REAL,
  pressure_hPa REAL,
  status_flags TEXT DEFAULT 'ok',
  FOREIGN KEY (device_id) REFERENCES devices(device_id)
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts);

-- Daily summary
CREATE TABLE IF NOT EXISTS daily_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  kwh_saved_est REAL DEFAULT 0,
  dollars_saved_est REAL DEFAULT 0,
  minutes_over_60 REAL DEFAULT 0,
  minutes_over_70 REAL DEFAULT 0,
  risk_level TEXT DEFAULT 'LOW' CHECK(risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, date)
);

-- Recommendations log
CREATE TABLE IF NOT EXISTS recommendations_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('OPEN_WINDOW', 'USE_AC', 'USE_HEAT', 'DO_NOTHING')),
  confidence TEXT DEFAULT 'MEDIUM' CHECK(confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  reasons_json TEXT DEFAULT '[]',
  inputs_json TEXT DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications (LLM-generated messages sent to users)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_text TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('mold_risk', 'savings_opportunity', 'weather_alert', 'pattern', 'general')),
  llm_prompt_summary TEXT,
  read_at DATETIME,
  dismissed_at DATETIME,
  acted_on INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User actions (tracks whether user followed recommendations)
CREATE TABLE IF NOT EXISTS user_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  action_type TEXT NOT NULL CHECK(action_type IN ('opened_window', 'turned_on_ac', 'turned_on_heat', 'dismissed', 'snoozed')),
  recommendation_id INTEGER,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (recommendation_id) REFERENCES recommendations_log(id)
);

-- LLM interaction logs (audit trail)
CREATE TABLE IF NOT EXISTS llm_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  prompt_hash TEXT,
  context_summary TEXT,
  response_text TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  notification_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id)
);
