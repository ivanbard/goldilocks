/**
 * Condition Monitor — watches sensor data & weather, then auto-creates
 * notifications when the user should take action (open window, adjust
 * heat, etc.). Runs on a timer independent of the demo simulator.
 *
 * Works in both real and demo mode.
 */

const { getDb } = require('../db/init');
const { getRecommendation, getRecommendationText, getComfortBand } = require('./recommendation');
const { computeMoldRisk } = require('./moldRisk');
const { fetchWeather } = require('./weather');
const { getCurrentRate } = require('./electricityRates');
const { estimateIndoorHumidity } = require('./humidityEstimator');

const CHECK_INTERVAL_MS = 5 * 60_000; // every 5 minutes
let timer = null;
let lastState = null;       // track previous recommendation to avoid spam
let lastMoldAlert = 0;      // timestamp of last mold notification

const MOLD_ALERT_COOLDOWN = 60 * 60_000; // 1 hour between mold alerts

function createNotification(db, userId, message, triggerType, summary) {
  db.prepare(`
    INSERT INTO notifications (user_id, message_text, trigger_type, llm_prompt_summary)
    VALUES (?, ?, ?, ?)
  `).run(userId, message, triggerType, summary);
  console.log(`[Monitor] 🔔 ${triggerType}: ${message.slice(0, 60)}...`);
}

async function checkConditions() {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return;

    const device = db.prepare('SELECT * FROM devices WHERE user_id = ?').get(user.id);
    const deviceId = device ? device.device_id : 'demo-device-001';

    const latest = db.prepare(
      'SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1'
    ).get(deviceId);
    if (!latest) return;

    const last24h = db.prepare(`
      SELECT * FROM readings WHERE device_id = ? AND ts >= datetime('now', '-24 hours') ORDER BY ts ASC
    `).all(deviceId);

    // Respect quiet hours
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);
    if (profile?.quiet_hours_start && profile?.quiet_hours_end) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm >= profile.quiet_hours_start || hhmm < profile.quiet_hours_end) {
        return; // silent during quiet hours
      }
    }

    // Get weather
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return;
    const weather = await fetchWeather(apiKey, user.postal_code);
    const rate = getCurrentRate(user.plan_type);

    const Tin = latest.temp_C;
    let RHin = latest.humidity_RH;
    const Tout = weather.current.temp_C;
    const RHout = weather.current.humidity_RH;

    if (RHin == null && Tout != null && RHout != null && Tin != null) {
      const est = estimateIndoorHumidity(Tin, Tout, RHout);
      if (est.humidity_RH != null) RHin = est.humidity_RH;
    }

    const moldRisk = computeMoldRisk(last24h, 1);
    const band = getComfortBand({
      comfort_min: user.comfort_min,
      comfort_max: user.comfort_max,
      comfort_min_night: user.comfort_min_night,
      comfort_max_night: user.comfort_max_night,
    });

    const rec = getRecommendation({
      Tin, RHin, Tout, RHout,
      comfort_min: band.min,
      comfort_max: band.max,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      periodLabel: rate.periodLabel,
      forecast: weather.forecast,
      moldRiskLevel: moldRisk.risk_level,
    });

    // ── State change notifications ────────────────────────────
    if (lastState && rec.state !== lastState) {
      const text = getRecommendationText(rec.state);
      const reasons = rec.reasons.join('. ');

      const messages = {
        OPEN_WINDOW: `🪟 Time to open a window! ${reasons}`,
        CLOSE_WINDOW: `🚪 Close your windows — ${reasons}`,
        USE_AC: `❄️ Consider turning on your AC. ${reasons}`,
        USE_HEAT: `🔥 Your space is getting cold — turn up the heat. ${reasons}`,
        DO_NOTHING: `✅ You're back in the comfort zone. ${reasons}`,
      };

      const triggerTypes = {
        OPEN_WINDOW: 'weather_alert',
        CLOSE_WINDOW: 'weather_alert',
        USE_AC: 'savings_opportunity',
        USE_HEAT: 'savings_opportunity',
        DO_NOTHING: 'general',
      };

      const msg = messages[rec.state] || `${text} — ${reasons}`;
      createNotification(db, user.id, msg, triggerTypes[rec.state] || 'general', `state changed: ${lastState} → ${rec.state}`);
    }
    lastState = rec.state;

    // ── Mold risk escalation ──────────────────────────────────
    if (moldRisk.risk_level === 'HIGH' && Date.now() - lastMoldAlert > MOLD_ALERT_COOLDOWN) {
      createNotification(
        db, user.id,
        `🍄 Mold risk is HIGH — humidity has been above 70% for ${moldRisk.stats.minutes_over_70} minutes today. ${RHout < RHin ? 'Outdoor air is drier — open a window to ventilate.' : 'Keep windows closed — outdoor humidity is also high.'}`,
        'mold_risk',
        `mold risk HIGH, RH in=${RHin?.toFixed(0)}% out=${RHout}%`
      );
      lastMoldAlert = Date.now();
    }

    // ── Temperature alerts ────────────────────────────────────
    if (Tin < band.min - 2) {
      // Check we haven't sent a temp alert in the last 30 min
      const recent = db.prepare(`
        SELECT COUNT(*) as n FROM notifications
        WHERE user_id = ? AND trigger_type = 'weather_alert'
          AND ts >= datetime('now', '-30 minutes')
          AND message_text LIKE '%cold%'
      `).get(user.id);
      if (recent.n === 0) {
        createNotification(
          db, user.id,
          `🥶 Indoor temperature is ${Tin.toFixed(1)}°C — that's ${(band.min - Tin).toFixed(1)}° below your ${band.period === 'night' ? 'nighttime' : 'daytime'} comfort zone. Consider turning up the heat.`,
          'weather_alert',
          `temp ${Tin}°C below comfort ${band.min}°C`
        );
      }
    } else if (Tin > band.max + 2) {
      const recent = db.prepare(`
        SELECT COUNT(*) as n FROM notifications
        WHERE user_id = ? AND trigger_type = 'weather_alert'
          AND ts >= datetime('now', '-30 minutes')
          AND message_text LIKE '%warm%'
      `).get(user.id);
      if (recent.n === 0) {
        createNotification(
          db, user.id,
          `🥵 Indoor temperature is ${Tin.toFixed(1)}°C — that's ${(Tin - band.max).toFixed(1)}° above your comfort zone. ${Tout < Tin ? 'It\'s cooler outside — try opening a window!' : 'Close blinds and use AC if available.'}`,
          'weather_alert',
          `temp ${Tin}°C above comfort ${band.max}°C`
        );
      }
    }

    // ── Electricity rate change tip ───────────────────────────
    const hour = new Date().getHours();
    // Alert at transition hours (7 AM on-peak start, 7 PM off-peak start)
    if (hour === 7 || hour === 19) {
      const min = new Date().getMinutes();
      if (min < 5) { // only in first 5 min of the hour
        const recent = db.prepare(`
          SELECT COUNT(*) as n FROM notifications
          WHERE user_id = ? AND trigger_type = 'savings_opportunity'
            AND ts >= datetime('now', '-1 hour')
        `).get(user.id);
        if (recent.n === 0) {
          if (hour === 7) {
            createNotification(
              db, user.id,
              `⚡ Peak electricity hours starting soon — rates going up to ${rate.price_cents_per_kWh}¢/kWh. Reduce heavy appliance use until 7 PM if possible.`,
              'savings_opportunity',
              'peak hours starting'
            );
          } else {
            createNotification(
              db, user.id,
              `💚 Off-peak electricity just started (${rate.price_cents_per_kWh}¢/kWh). Good time to run laundry, dishwasher, or charge EVs!`,
              'savings_opportunity',
              'off-peak hours starting'
            );
          }
        }
      }
    }

  } catch (err) {
    console.error('[Monitor] Error checking conditions:', err.message);
  }
}

function start() {
  console.log('[Monitor] Condition monitor active — checking every 5 min');
  // First check after 30s (let readings populate first)
  setTimeout(() => {
    checkConditions();
    timer = setInterval(checkConditions, CHECK_INTERVAL_MS);
  }, 30_000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop };
