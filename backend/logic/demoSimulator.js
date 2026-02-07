/**
 * Demo Simulator — generates realistic synthetic sensor readings
 * when no Arduino is connected (e.g. for Devpost "try it out" link).
 *
 * Activate with DEMO_MODE=true in .env
 */

const { getDb } = require('../db/init');

const DEVICE_ID = 'demo-device-001';
const INTERVAL_MS = 30_000; // match real gateway cadence

// --- Tunable params ---
const BASE_TEMP = 21.2;        // °C — typical indoor
const TEMP_AMPLITUDE = 1.5;    // °C — slow sinusoidal drift (heating cycles)
const TEMP_NOISE = 0.15;       // °C — sensor noise
const BASE_PRESSURE = 1010;    // hPa
const PRESSURE_DRIFT = 4;      // hPa — slow random walk bounds
const BASE_HUMIDITY = 45;      // %RH — mid-range
const HUMIDITY_AMPLITUDE = 12; // %RH — drift range

let pressureWalk = 0;
let timer = null;

function noise(scale) {
  return (Math.random() - 0.5) * 2 * scale;
}

function generateReading(hoursAgo = 0) {
  const now = Date.now() - hoursAgo * 3600_000;
  const hourOfDay = new Date(now).getHours() + new Date(now).getMinutes() / 60;

  // Temperature: sinusoidal daily pattern — cooler at night, warmer mid-day
  const dailyCycle = Math.sin((hourOfDay - 6) / 24 * 2 * Math.PI) * TEMP_AMPLITUDE * 0.6;
  const heatingCycle = Math.sin(now / 1800_000) * TEMP_AMPLITUDE * 0.4;
  const temp = BASE_TEMP + dailyCycle + heatingCycle + noise(TEMP_NOISE);

  // Pressure: slow random walk
  pressureWalk += noise(0.3);
  pressureWalk = Math.max(-PRESSURE_DRIFT, Math.min(PRESSURE_DRIFT, pressureWalk));
  const pressure = BASE_PRESSURE + pressureWalk;

  // Humidity: inverse to temp (cooler → higher RH) + slow drift
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

/**
 * Backfill 24 h of synthetic data so charts & mold risk
 * have content on first load.
 */
function seedHistory() {
  const db = getDb();
  const existing = db.prepare(
    `SELECT COUNT(*) as n FROM readings WHERE device_id = ? AND ts >= datetime('now', '-24 hours')`
  ).get(DEVICE_ID);

  if (existing.n > 100) {
    console.log(`[Demo] ${existing.n} readings already in last 24 h — skipping seed`);
    return;
  }

  console.log('[Demo] Seeding 24 h of synthetic sensor history...');
  const insert = db.prepare(
    `INSERT INTO readings (device_id, ts, temp_C, humidity_RH, pressure_hPa, status_flags)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const batchInsert = db.transaction((readings) => {
    for (const r of readings) {
      insert.run(r.device_id, r.ts, r.temp_C, r.humidity_RH, r.pressure_hPa, r.status_flags);
    }
  });

  // One reading every 30 s for 24 h = 2880 rows
  const readings = [];
  for (let i = 2880; i >= 1; i--) {
    readings.push(generateReading(i * 30 / 3600));
  }
  batchInsert(readings);
  console.log(`[Demo] Seeded ${readings.length} readings`);
}

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
  seedHistory();
  insertLive();
  timer = setInterval(insertLive, INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  console.log('[Demo] Simulator stopped');
}

module.exports = { start, stop };
