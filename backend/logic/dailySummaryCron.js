/**
 * Daily Summary Cron — computes real savings/mold stats from sensor readings
 * and writes a daily_summary row. Runs at midnight and also on startup
 * (to fill today's partial summary).
 *
 * Updates every hour so the dashboard always has fresh todaySavings.
 */

const { getDb } = require('../db/init');
const { estimateCost } = require('./costSavings');
const { getCurrentRate } = require('./electricityRates');
const { dailyCarbonSavings } = require('./carbonEstimator');

const UPDATE_INTERVAL_MS = 60 * 60_000; // update every hour
let timer = null;

/**
 * Compute and upsert a daily_summary for a given date.
 */
function computeSummary(dateStr) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return;

  const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);
  const housingType = profile?.housing_type || 'apartment';

  // Get all devices for this user
  const devices = db.prepare('SELECT device_id FROM devices WHERE user_id = ?').all(user.id);
  const deviceIds = devices.map(d => d.device_id);
  if (deviceIds.length === 0) deviceIds.push('demo-device-001');

  // Get all readings for this date across all devices
  const placeholders = deviceIds.map(() => '?').join(',');
  const readings = db.prepare(`
    SELECT * FROM readings
    WHERE device_id IN (${placeholders})
      AND date(ts) = ?
    ORDER BY ts ASC
  `).all(...deviceIds, dateStr);

  if (readings.length === 0) return;

  // --- Compute humidity stats ---
  let minutesOver60 = 0;
  let minutesOver70 = 0;
  const intervalMin = 0.5; // readings every ~30s

  for (const r of readings) {
    if (r.humidity_RH != null) {
      if (r.humidity_RH > 70) minutesOver70 += intervalMin;
      else if (r.humidity_RH > 60) minutesOver60 += intervalMin;
    }
  }
  minutesOver60 = Math.round(minutesOver60 + minutesOver70); // over60 includes over70
  minutesOver70 = Math.round(minutesOver70);

  // --- Compute energy savings ---
  // Savings = sum of hourly estimates where opening a window avoided HVAC
  // Simplified: for each reading outside comfort zone, estimate the kWh that
  // would have been used and credit savings when outdoor temp was favorable
  const target = (user.comfort_min + user.comfort_max) / 2;
  let totalKwhSaved = 0;
  const hoursPerReading = 30 / 3600; // each reading represents ~30s

  for (const r of readings) {
    if (r.temp_C == null) continue;
    const deltaT = Math.abs(r.temp_C - target);
    if (deltaT < 0.5) continue; // within comfort, no HVAC needed

    const cost = estimateCost({
      Tin: r.temp_C,
      target,
      price_cents_per_kWh: 10, // dummy, we only need kWh
      housing_type: housingType,
    });

    // Credit savings proportional to time slice
    totalKwhSaved += cost.kWh_room * hoursPerReading;
  }

  totalKwhSaved = Math.round(totalKwhSaved * 1000) / 1000;

  // --- Dollar savings ---
  const avgRate = getCurrentRate(user.plan_type);
  const dollarsSaved = Math.round(totalKwhSaved * (avgRate.price_cents_per_kWh / 100) * 100) / 100;

  // --- CO2 savings ---
  const heatingSource = user.heating_source || 'gas';
  const carbon = dailyCarbonSavings(totalKwhSaved, heatingSource);
  const co2SavedG = Math.round(carbon.co2_saved_g * 10) / 10;

  // --- Risk level ---
  const riskLevel = minutesOver70 > 30 ? 'HIGH' : minutesOver60 > 60 ? 'MEDIUM' : 'LOW';

  // --- Upsert ---
  db.prepare(`
    INSERT INTO daily_summary (user_id, date, kwh_saved_est, dollars_saved_est, minutes_over_60, minutes_over_70, co2_saved_g, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      kwh_saved_est = excluded.kwh_saved_est,
      dollars_saved_est = excluded.dollars_saved_est,
      minutes_over_60 = excluded.minutes_over_60,
      minutes_over_70 = excluded.minutes_over_70,
      co2_saved_g = excluded.co2_saved_g,
      risk_level = excluded.risk_level
  `).run(user.id, dateStr, totalKwhSaved, dollarsSaved, minutesOver60, minutesOver70, co2SavedG, riskLevel);

  console.log(`[Cron] Summary for ${dateStr}: ${totalKwhSaved} kWh, $${dollarsSaved}, ${co2SavedG}g CO2, ${readings.length} readings, risk=${riskLevel}`);
}

function runUpdate() {
  try {
    // Update today's summary
    const today = new Date().toISOString().split('T')[0];
    computeSummary(today);

    // Also update yesterday if it hasn't been finalized
    const yesterday = new Date(Date.now() - 86400_000).toISOString().split('T')[0];
    computeSummary(yesterday);
  } catch (err) {
    console.error('[Cron] Daily summary error:', err.message);
  }
}

function start() {
  console.log('[Cron] Daily summary updater active — runs every hour');
  // First run after 10s (let DB init finish)
  setTimeout(() => {
    runUpdate();
    timer = setInterval(runUpdate, UPDATE_INTERVAL_MS);
  }, 10_000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, computeSummary };
