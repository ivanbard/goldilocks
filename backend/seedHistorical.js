/**
 * One-time script: backfill ~1 day of realistic sensor readings
 * for the esp32-sensor-001 device + a daily_summary for yesterday.
 *
 * Run:  node backend/seedHistorical.js
 *
 * This does NOT delete any existing data — it only inserts readings
 * timestamped from 24h ago up to ~1h ago so they don't overlap with
 * your live real readings.
 */

const { getDb } = require('./db/init');

const DEVICE_ID = 'esp32-sensor-001';

function noise(scale) {
  return (Math.random() - 0.5) * 2 * scale;
}

function generateReading(tsMs) {
  const dt = new Date(tsMs);
  const hour = dt.getHours() + dt.getMinutes() / 60;

  // Realistic Kingston winter indoor temp curve
  // Cooler at night (~19-20°C), warmer during day (~21-23°C)
  const nightDip = hour >= 0 && hour < 7 ? -1.5 : 0;
  const dailyCycle = Math.sin((hour - 6) / 24 * 2 * Math.PI) * 1.2;
  const heatingCycle = Math.sin(tsMs / 1800_000) * 0.5; // furnace cycling
  const temp = 21.0 + dailyCycle + heatingCycle + nightDip + noise(0.2);

  // DHT11 humidity — realistic indoor winter (30-55%)
  const humBase = 42;
  const humDaily = -dailyCycle * 2.5; // inverse of temp
  const humidity = Math.max(28, Math.min(60,
    humBase + humDaily + noise(2) + Math.sin(tsMs / 3600_000) * 4
  ));

  return {
    ts: dt.toISOString().replace('T', ' ').slice(0, 19),
    device_id: DEVICE_ID,
    temp_C: Math.round(temp * 100) / 100,
    humidity_RH: Math.round(humidity * 10) / 10,
    pressure_hPa: null, // DHT11 has no barometer
    status_flags: 'backfill'
  };
}

function run() {
  const db = getDb();

  // Check what we already have
  const existing = db.prepare(
    `SELECT COUNT(*) as n FROM readings WHERE device_id = ?`
  ).get(DEVICE_ID);
  console.log(`Existing ESP32 readings: ${existing.n}`);

  // Generate readings from 25h ago to 1h ago (every 30s = 2880 readings)
  // Stop 1h ago so we don't collide with recent real readings
  const now = Date.now();
  const startMs = now - 25 * 3600_000;  // 25h ago
  const endMs   = now - 1 * 3600_000;   // 1h ago
  const stepMs  = 30_000;               // every 30s

  const readings = [];
  for (let t = startMs; t < endMs; t += stepMs) {
    readings.push(generateReading(t));
  }

  console.log(`Inserting ${readings.length} backfill readings (${DEVICE_ID})...`);

  const insert = db.prepare(
    `INSERT INTO readings (device_id, ts, temp_C, humidity_RH, pressure_hPa, status_flags)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const batch = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(r.device_id, r.ts, r.temp_C, r.humidity_RH, r.pressure_hPa, r.status_flags);
    }
  });
  batch(readings);

  // Also seed a daily_summary for yesterday
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (user) {
    const yesterday = new Date(now - 86400_000).toISOString().split('T')[0];
    const existingSummary = db.prepare(
      `SELECT COUNT(*) as n FROM daily_summary WHERE user_id = ? AND date = ?`
    ).get(user.id, yesterday);

    if (existingSummary.n === 0) {
      const kwhSaved = 0.85 + noise(0.2);
      const rate = 0.087;
      const dollarsSaved = Math.round(kwhSaved * rate * 100) / 100;
      const min60 = Math.round(35 + noise(15));
      const min70 = Math.round(Math.max(0, 3 + noise(4)));
      const co2 = Math.round(kwhSaved * 35 * 10) / 10;
      const risk = min70 > 15 ? 'HIGH' : min60 > 50 ? 'MEDIUM' : 'LOW';

      db.prepare(`
        INSERT INTO daily_summary (user_id, date, kwh_saved_est, dollars_saved_est, minutes_over_60, minutes_over_70, co2_saved_g, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, yesterday, Math.max(0, kwhSaved), Math.max(0, dollarsSaved), Math.max(0, min60), Math.max(0, min70), Math.max(0, co2), risk);
      console.log(`Seeded daily_summary for ${yesterday}`);
    } else {
      console.log(`Daily summary for ${yesterday} already exists — skipping`);
    }
  }

  // Verify
  const total = db.prepare(
    `SELECT COUNT(*) as n FROM readings WHERE device_id = ?`
  ).get(DEVICE_ID);
  console.log(`Done! Total ESP32 readings now: ${total.n}`);

  const range = db.prepare(
    `SELECT MIN(ts) as oldest, MAX(ts) as newest FROM readings WHERE device_id = ?`
  ).get(DEVICE_ID);
  console.log(`Range: ${range.oldest} → ${range.newest}`);
}

run();
