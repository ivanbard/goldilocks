/**
 * Demo Simulator — generates realistic synthetic sensor readings,
 * 30 days of savings / carbon history, and sample notifications
 * when no Arduino is connected (e.g. for Devpost "try it out" link).
 *
 * Activate with DEMO_MODE=true in .env
 */

const { getDb } = require('../db/init');

const DEVICE_ID = 'demo-device-001';
const INTERVAL_MS = 30_000; // match real gateway cadence

// --- Tunable params ---
const BASE_TEMP = 21.2;
const TEMP_AMPLITUDE = 1.5;
const TEMP_NOISE = 0.15;
const BASE_PRESSURE = 1010;
const PRESSURE_DRIFT = 4;
const BASE_HUMIDITY = 45;
const HUMIDITY_AMPLITUDE = 12;

let pressureWalk = 0;
let timer = null;

function noise(scale) {
  return (Math.random() - 0.5) * 2 * scale;
}

function generateReading(hoursAgo = 0) {
  const now = Date.now() - hoursAgo * 3600_000;
  const hourOfDay = new Date(now).getHours() + new Date(now).getMinutes() / 60;

  const dailyCycle = Math.sin((hourOfDay - 6) / 24 * 2 * Math.PI) * TEMP_AMPLITUDE * 0.6;
  const heatingCycle = Math.sin(now / 1800_000) * TEMP_AMPLITUDE * 0.4;
  const temp = BASE_TEMP + dailyCycle + heatingCycle + noise(TEMP_NOISE);

  pressureWalk += noise(0.3);
  pressureWalk = Math.max(-PRESSURE_DRIFT, Math.min(PRESSURE_DRIFT, pressureWalk));
  const pressure = BASE_PRESSURE + pressureWalk;

  const humOffset = -dailyCycle * 3;
  const humidity = Math.max(25, Math.min(75,
    BASE_HUMIDITY + humOffset + noise(2) + Math.sin(now / 3600_000) * HUMIDITY_AMPLITUDE * 0.5
  ));

  return {
    ts: new Date(now).toISOString().replace('T', ' ').slice(0, 19),
    device_id: DEVICE_ID,
    temp_C: Math.round(temp * 100) / 100,
    humidity_RH: Math.round(humidity * 10) / 10,
    pressure_hPa: Math.round(pressure * 100) / 100,
    status_flags: 'demo'
  };
}

// ── Seed 24 h of sensor readings ──────────────────────────────
function seedReadings() {
  const db = getDb();
  const existing = db.prepare(
    `SELECT COUNT(*) as n FROM readings WHERE device_id = ? AND ts >= datetime('now', '-24 hours')`
  ).get(DEVICE_ID);

  if (existing.n > 100) {
    console.log(`[Demo] ${existing.n} readings already — skipping sensor seed`);
    return;
  }

  console.log('[Demo] Seeding 24 h of sensor readings...');
  const insert = db.prepare(
    `INSERT INTO readings (device_id, ts, temp_C, humidity_RH, pressure_hPa, status_flags)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const batch = db.transaction((rows) => {
    for (const r of rows) insert.run(r.device_id, r.ts, r.temp_C, r.humidity_RH, r.pressure_hPa, r.status_flags);
  });

  const readings = [];
  for (let i = 2880; i >= 1; i--) readings.push(generateReading(i * 30 / 3600));
  batch(readings);
  console.log(`[Demo] Seeded ${readings.length} sensor readings`);
}

// ── Seed 30 days of daily_summary (savings + carbon page) ─────
function seedDailySummaries() {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return;

  const existing = db.prepare(
    `SELECT COUNT(*) as n FROM daily_summary WHERE user_id = ?`
  ).get(user.id);

  if (existing.n >= 20) {
    console.log(`[Demo] ${existing.n} summaries already — skipping`);
    return;
  }

  console.log('[Demo] Seeding 30 days of daily summaries...');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO daily_summary
      (user_id, date, kwh_saved_est, dollars_saved_est, minutes_over_60, minutes_over_70, co2_saved_g, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });

  const rows = [];
  for (let d = 30; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400_000).toISOString().split('T')[0];
    // Vary savings realistically — weekdays save more (people home less)
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseKwh = isWeekend ? 0.4 : 0.9;
    const kwhSaved = Math.round((baseKwh + noise(0.35)) * 1000) / 1000;
    const rate = 0.087 + noise(0.03); // avg $/kWh
    const dollarsSaved = Math.round(kwhSaved * rate * 100) / 100;
    const min60 = Math.round(Math.max(0, 40 + noise(30)));
    const min70 = Math.round(Math.max(0, 5 + noise(8)));
    const co2 = Math.round(kwhSaved * 35 * 10) / 10; // Ontario grid 35 g/kWh
    const risk = min70 > 15 ? 'HIGH' : min60 > 50 ? 'MEDIUM' : 'LOW';
    rows.push([user.id, date, Math.max(0, kwhSaved), Math.max(0, dollarsSaved), min60, min70, Math.max(0, co2), risk]);
  }
  batch(rows);
  console.log(`[Demo] Seeded ${rows.length} daily summaries`);
}

// ── Seed sample notifications ─────────────────────────────────
function seedNotifications() {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return;

  const existing = db.prepare(
    `SELECT COUNT(*) as n FROM notifications WHERE user_id = ?`
  ).get(user.id);

  if (existing.n >= 3) {
    console.log(`[Demo] ${existing.n} notifications already — skipping`);
    return;
  }

  console.log('[Demo] Seeding sample notifications...');
  const insert = db.prepare(`
    INSERT INTO notifications (user_id, ts, message_text, trigger_type, llm_prompt_summary)
    VALUES (?, datetime('now', ?), ?, ?, ?)
  `);

  const samples = [
    ['-2 hours',  '🌡️ Indoor temperature dropped to 19.5°C — your heating may need adjustment. The outdoor temp is -15°C so keep windows closed.', 'weather_alert', 'temp drop below comfort'],
    ['-4 hours',  '💧 Humidity has been above 60% for 3 hours today. Consider opening a window briefly when outdoor air is drier to reduce mold risk.', 'mold_risk', 'sustained high humidity'],
    ['-6 hours',  '💰 Electricity is currently Off-Peak (8.7¢/kWh) — great time to run your dryer or dishwasher! Peak rates start at 11 AM.', 'savings_opportunity', 'off-peak window'],
    ['-1 day',    '📊 You saved 0.87 kWh yesterday by following ventilation recommendations — that\'s 30g of CO₂ avoided, equivalent to not driving 120m!', 'pattern', 'daily savings recap'],
    ['-2 days',   '🍄 Mold risk was elevated yesterday (4.2 hours above 60% humidity). Today looks drier — try ventilating between 2-4 PM when humidity outside is lowest.', 'mold_risk', 'mold risk trend'],
    ['-3 days',   '⛈️ Rain expected this afternoon — close windows by 1 PM. A dry window opens tonight after 8 PM for ventilation.', 'weather_alert', 'rain forecast'],
  ];

  for (const [offset, msg, trigger, summary] of samples) {
    insert.run(user.id, offset, msg, trigger, summary);
  }
  console.log(`[Demo] Seeded ${samples.length} notifications`);
}

// ── Live insert ───────────────────────────────────────────────
function insertLive() {
  const db = getDb();
  const r = generateReading(0);
  db.prepare(
    `INSERT INTO readings (device_id, ts, temp_C, humidity_RH, pressure_hPa, status_flags)
     VALUES (?, datetime('now'), ?, ?, ?, ?)`
  ).run(r.device_id, r.temp_C, r.humidity_RH, r.pressure_hPa, r.status_flags);
}

function start() {
  console.log('[Demo] Simulator active — synthetic sensor data every 30 s');
  seedReadings();
  seedDailySummaries();
  seedNotifications();
  insertLive();
  timer = setInterval(insertLive, INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  console.log('[Demo] Simulator stopped');
}

module.exports = { start, stop };
