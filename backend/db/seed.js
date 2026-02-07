/**
 * Seed script — populates ~24h of realistic sensor readings + daily summaries
 * Run: npm run seed (from root) or node db/seed.js (from backend/)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { getDb } = require('./init');

const db = getDb();

const DEVICE_ID = 'demo-device-001';
const USER_ID = 1;

function seed() {
  console.log('Seeding demo data...');

  // Clear existing readings for a clean reseed
  db.prepare('DELETE FROM readings WHERE device_id = ?').run(DEVICE_ID);
  db.prepare('DELETE FROM daily_summary WHERE user_id = ?').run(USER_ID);
  db.prepare('DELETE FROM recommendations_log WHERE user_id = ?').run(USER_ID);
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(USER_ID);

  // Generate 24h of readings (1 per minute = 1440 readings)
  const now = new Date();
  const insertReading = db.prepare(`
    INSERT INTO readings (device_id, ts, temp_C, humidity_RH, pressure_hPa, status_flags)
    VALUES (?, ?, ?, ?, ?, 'ok')
  `);

  const insertMany = db.transaction((readings) => {
    for (const r of readings) {
      insertReading.run(r.device_id, r.ts, r.temp_C, r.humidity_RH, r.pressure_hPa);
    }
  });

  const readings = [];
  for (let i = 1440; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60 * 1000);
    const hour = ts.getHours();

    // Simulate realistic indoor patterns
    // Temperature: 19-24°C, warmer during day, cooler at night
    const baseTemp = 21 + 2 * Math.sin((hour - 6) * Math.PI / 12);
    const temp_C = baseTemp + (Math.random() - 0.5) * 1.5;

    // Humidity: 45-75%, higher in morning (shower) and evening (cooking)
    let baseHumidity = 55;
    if (hour >= 7 && hour <= 8) baseHumidity = 68; // morning shower
    if (hour >= 18 && hour <= 19) baseHumidity = 65; // cooking
    if (hour >= 2 && hour <= 5) baseHumidity = 50; // dry at night
    const humidity_RH = baseHumidity + (Math.random() - 0.5) * 10;

    // Pressure: ~1013 hPa with minor fluctuation
    const pressure_hPa = 1013 + Math.sin(i / 200) * 3 + (Math.random() - 0.5) * 2;

    readings.push({
      device_id: DEVICE_ID,
      ts: ts.toISOString().replace('T', ' ').substring(0, 19),
      temp_C: Math.round(temp_C * 100) / 100,
      humidity_RH: Math.round(humidity_RH * 100) / 100,
      pressure_hPa: Math.round(pressure_hPa * 100) / 100,
    });
  }

  insertMany(readings);
  console.log(`Inserted ${readings.length} readings`);

  // Seed daily summaries for the past 30 days
  const insertSummary = db.prepare(`
    INSERT OR REPLACE INTO daily_summary (user_id, date, kwh_saved_est, dollars_saved_est, minutes_over_60, minutes_over_70, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const summaryTx = db.transaction((entries) => {
    for (const e of entries) {
      insertSummary.run(e.user_id, e.date, e.kwh_saved, e.dollars_saved, e.min60, e.min70, e.risk);
    }
  });

  const summaries = [];
  for (let d = 30; d >= 0; d--) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    const kwh_saved = 0.3 + Math.random() * 0.8;
    const dollars_saved = kwh_saved * (0.10 + Math.random() * 0.07);
    const min60 = 30 + Math.random() * 120;
    const min70 = Math.random() * 60;
    const risk = min70 > 40 ? 'MEDIUM' : min70 > 20 ? 'LOW' : 'LOW';

    summaries.push({
      user_id: USER_ID,
      date: dateStr,
      kwh_saved: Math.round(kwh_saved * 100) / 100,
      dollars_saved: Math.round(dollars_saved * 100) / 100,
      min60: Math.round(min60),
      min70: Math.round(min70),
      risk,
    });
  }

  summaryTx(summaries);
  console.log(`Inserted ${summaries.length} daily summaries`);

  // Seed some notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, ts, message_text, trigger_type)
    VALUES (?, ?, ?, ?)
  `);

  const notifs = [
    { ts: new Date(now.getTime() - 2 * 3600000).toISOString(), msg: 'Humidity has been above 65% for 2 hours. Consider opening a window to reduce mold risk.', type: 'mold_risk' },
    { ts: new Date(now.getTime() - 5 * 3600000).toISOString(), msg: 'Electricity is off-peak right now (8.7¢/kWh). Good time to adjust your thermostat if needed.', type: 'savings_opportunity' },
    { ts: new Date(now.getTime() - 8 * 3600000).toISOString(), msg: 'Outside temperature is dropping — close windows before bed to maintain comfort.', type: 'weather_alert' },
    { ts: new Date(now.getTime() - 24 * 3600000).toISOString(), msg: 'You saved $0.45 yesterday by ventilating during off-peak hours. Keep it up!', type: 'pattern' },
  ];

  for (const n of notifs) {
    insertNotif.run(USER_ID, n.ts, n.msg, n.type);
  }
  console.log(`Inserted ${notifs.length} notifications`);

  console.log('Seed complete!');
}

seed();
