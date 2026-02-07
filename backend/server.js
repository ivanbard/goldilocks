require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/init');
const { getCurrentRate, getFullSchedule } = require('./logic/electricityRates');
const { fetchWeather, isRainExpected } = require('./logic/weather');
const { getRecommendation, getRecommendationText } = require('./logic/recommendation');
const { estimateCost, calculatePeriodSavings } = require('./logic/costSavings');
const { computeMoldRisk } = require('./logic/moldRisk');
const { generateSuggestions } = require('./logic/llmSuggestions');
const { estimateIndoorHumidity } = require('./logic/humidityEstimator');
const { calculateAvoidedCO2, getEquivalences, getCommunityImpact, getGenerationalProjection, dailyCarbonSavings } = require('./logic/carbonEstimator');
const { chat: geminiChat, resetChat } = require('./logic/geminiChat');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize DB on startup
const db = getDb();
console.log('Database initialized');

// ============================================================
// API Routes
// ============================================================

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- POST /api/readings — Gateway posts sensor data ---
app.post('/api/readings', (req, res) => {
  try {
    const { device_id, temp_C, humidity_RH, pressure_hPa, status_flags } = req.body;

    if (!device_id || temp_C === undefined) {
      return res.status(400).json({ error: 'device_id and temp_C are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO readings (device_id, temp_C, humidity_RH, pressure_hPa, status_flags)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      device_id,
      temp_C,
      humidity_RH !== undefined ? humidity_RH : null,
      pressure_hPa !== undefined ? pressure_hPa : null,
      status_flags || 'ok'
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('POST /api/readings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/readings — Fetch time-series readings ---
app.get('/api/readings', (req, res) => {
  try {
    const { device_id, from, to, limit } = req.query;
    let query = 'SELECT * FROM readings WHERE 1=1';
    const params = [];

    if (device_id) {
      query += ' AND device_id = ?';
      params.push(device_id);
    }
    if (from) {
      query += ' AND ts >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND ts <= ?';
      params.push(to);
    }

    query += ' ORDER BY ts DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    } else {
      query += ' LIMIT 1440'; // default: 24h of 1-min readings
    }

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/readings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/dashboard — Main dashboard data ---
app.get('/api/dashboard', async (req, res) => {
  try {
    // Get demo user
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    // Get user profile
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);

    // Get device
    const device = db.prepare('SELECT * FROM devices WHERE user_id = ?').get(user.id);
    const deviceId = device ? device.device_id : 'demo-device-001';

    // Latest reading
    const latestReading = db.prepare(
      'SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1'
    ).get(deviceId);

    // Last 24h readings for mold risk
    const last24h = db.prepare(`
      SELECT * FROM readings 
      WHERE device_id = ? AND ts >= datetime('now', '-24 hours')
      ORDER BY ts ASC
    `).all(deviceId);

    // Outdoor weather (geocoded from user's postal code)
    const weather = await fetchWeather(process.env.OPENWEATHERMAP_API_KEY, user.postal_code);

    // Current electricity rate
    const rate = getCurrentRate(user.plan_type);

    // Indoor values (from latest reading or defaults)
    const Tin = latestReading ? latestReading.temp_C : 21;
    let RHin = latestReading ? latestReading.humidity_RH : null;
    const pressureIn = latestReading ? latestReading.pressure_hPa : null;

    // Outdoor values
    const Tout = weather.current.temp_C;
    const RHout = weather.current.humidity_RH;

    // Estimate indoor humidity if no sensor
    let humidityEstimate = null;
    if (RHin == null && Tout != null && RHout != null && Tin != null) {
      humidityEstimate = estimateIndoorHumidity(Tin, Tout, RHout);
      if (humidityEstimate.humidity_RH != null) {
        RHin = humidityEstimate.humidity_RH;
      }
    }

    // Mold risk
    const moldRisk = computeMoldRisk(last24h, 1);

    // Recommendation
    const recommendation = getRecommendation({
      Tin, RHin, Tout, RHout,
      comfort_min: user.comfort_min,
      comfort_max: user.comfort_max,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      periodLabel: rate.periodLabel,
      forecast: weather.forecast,
      moldRiskLevel: moldRisk.risk_level,
    });

    // Cost estimate
    const target = (user.comfort_min + user.comfort_max) / 2;
    const costEstimate = estimateCost({
      Tin,
      target,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      kWh_per_degC: user.room_kwh_per_degC,
      ac_cop: user.ac_cop,
    });

    // Log recommendation
    db.prepare(`
      INSERT INTO recommendations_log (user_id, state, confidence, reasons_json, inputs_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      user.id,
      recommendation.state,
      recommendation.confidence,
      JSON.stringify(recommendation.reasons),
      JSON.stringify({ Tin, RHin, Tout, RHout, rate: rate.price_cents_per_kWh })
    );

    // Today's savings from daily_summary
    const today = new Date().toISOString().split('T')[0];
    const todaySummary = db.prepare(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?'
    ).get(user.id, today);

    res.json({
      user: {
        id: user.id,
        plan_type: user.plan_type,
        comfort_min: user.comfort_min,
        comfort_max: user.comfort_max,
        postal_code: user.postal_code,
        housing_type: profile?.housing_type || 'apartment',
      },
      indoor: {
        temp_C: Tin,
        humidity_RH: RHin,
        humidity_estimated: humidityEstimate != null,
        humidity_confidence: humidityEstimate?.confidence || null,
        pressure_hPa: pressureIn,
        lastUpdated: latestReading?.ts || null,
        sensorOnline: !!latestReading,
      },
      outdoor: weather.current,
      weather: {
        forecast: weather.forecast,
        location: weather.location,
        cached: weather.cached,
        mock: weather.mock || false,
      },
      electricity: {
        ...rate,
        schedule: getFullSchedule(user.plan_type),
      },
      recommendation: {
        state: recommendation.state,
        confidence: recommendation.confidence,
        reasons: recommendation.reasons,
        text: getRecommendationText(recommendation.state),
      },
      costEstimate,
      moldRisk,
      todaySavings: todaySummary || { dollars_saved_est: 0, kwh_saved_est: 0 },
      readingsCount24h: last24h.length,
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/savings — Aggregated savings ---
app.get('/api/savings', (req, res) => {
  try {
    const { period } = req.query; // today, month, all
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    let dateFilter = '';
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    if (period === 'today') {
      dateFilter = ` AND date = '${today}'`;
    } else if (period === 'month') {
      dateFilter = ` AND date >= '${monthStart}'`;
    }
    // 'all' = no filter

    const summaries = db.prepare(`
      SELECT * FROM daily_summary WHERE user_id = ?${dateFilter} ORDER BY date DESC
    `).all(user.id);

    const totals = calculatePeriodSavings(summaries);

    res.json({
      period: period || 'all',
      ...totals,
      dailyBreakdown: summaries,
      assumptions: {
        kWh_per_degC: user.room_kwh_per_degC,
        ac_cop: user.ac_cop,
        room_volume_m3: 30,
      },
    });
  } catch (err) {
    console.error('GET /api/savings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/weather — Weather data ---
app.get('/api/weather', async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const weather = await fetchWeather(process.env.OPENWEATHERMAP_API_KEY, user?.postal_code);
    res.json(weather);
  } catch (err) {
    console.error('GET /api/weather error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/user — Get demo user ---
app.get('/api/user', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user?.id);
    res.json({ ...user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/user/preferences — Update user settings ---
app.post('/api/user/preferences', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    const {
      plan_type, comfort_min, comfort_max,
      room_kwh_per_degC, ac_cop, postal_code, heating_source,
      housing_type, floor_level, lifestyle_notes,
      notification_preferences_json, quiet_hours_start, quiet_hours_end,
    } = req.body;

    // Update users table
    if (plan_type || comfort_min || comfort_max || room_kwh_per_degC || ac_cop || postal_code || heating_source) {
      db.prepare(`
        UPDATE users SET
          plan_type = COALESCE(?, plan_type),
          comfort_min = COALESCE(?, comfort_min),
          comfort_max = COALESCE(?, comfort_max),
          room_kwh_per_degC = COALESCE(?, room_kwh_per_degC),
          ac_cop = COALESCE(?, ac_cop),
          postal_code = COALESCE(?, postal_code),
          heating_source = COALESCE(?, heating_source)
        WHERE id = ?
      `).run(plan_type, comfort_min, comfort_max, room_kwh_per_degC, ac_cop, postal_code, heating_source, user.id);
    }

    // Update profile table
    if (housing_type || floor_level || lifestyle_notes || notification_preferences_json || quiet_hours_start || quiet_hours_end) {
      db.prepare(`
        UPDATE user_profile SET
          housing_type = COALESCE(?, housing_type),
          floor_level = COALESCE(?, floor_level),
          lifestyle_notes = COALESCE(?, lifestyle_notes),
          notification_preferences_json = COALESCE(?, notification_preferences_json),
          quiet_hours_start = COALESCE(?, quiet_hours_start),
          quiet_hours_end = COALESCE(?, quiet_hours_end)
        WHERE user_id = ?
      `).run(housing_type, floor_level, lifestyle_notes, notification_preferences_json, quiet_hours_start, quiet_hours_end, user.id);
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const updatedProfile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);

    res.json({ success: true, user: { ...updatedUser, profile: updatedProfile } });
  } catch (err) {
    console.error('POST /api/user/preferences error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/notifications — Get user notifications ---
app.get('/api/notifications', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY ts DESC LIMIT 50
    `).all(user.id);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/notifications/:id/read — Mark notification as read ---
app.post('/api/notifications/:id/read', (req, res) => {
  try {
    db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/actions — Log a user action ---
app.post('/api/actions', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const { action_type, recommendation_id, notes } = req.body;

    db.prepare(`
      INSERT INTO user_actions (user_id, action_type, recommendation_id, notes)
      VALUES (?, ?, ?, ?)
    `).run(user.id, action_type, recommendation_id || null, notes || null);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/electricity/schedule --- 
app.get('/api/electricity/schedule', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const planType = req.query.plan || user?.plan_type || 'TOU';
    res.json(getFullSchedule(planType));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/carbon --- Carbon emissions impact data ---
app.get('/api/carbon', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    const today = new Date().toISOString().split('T')[0];

    // Get all daily summaries for carbon calculation
    const allSummaries = db.prepare(
      'SELECT * FROM daily_summary WHERE user_id = ? ORDER BY date ASC'
    ).all(user.id);

    // Calculate CO2 savings for each day
    const heatingSource = user.heating_source || 'gas';
    let totalCO2_g = 0;
    const dailyCarbon = allSummaries.map(day => {
      const carbon = dailyCarbonSavings(day.kwh_saved_est, heatingSource);
      totalCO2_g += carbon.co2_saved_g;
      return {
        date: day.date,
        kwh_saved: day.kwh_saved_est,
        co2_saved_g: carbon.co2_saved_g,
        cumulative_co2_g: Math.round(totalCO2_g * 100) / 100,
      };
    });

    // Today's carbon savings
    const todaySummary = allSummaries.find(s => s.date === today);
    const todayCarbon = todaySummary 
      ? dailyCarbonSavings(todaySummary.kwh_saved_est, heatingSource)
      : { co2_saved_g: 0 };

    // Equivalences for total
    const equivalences = getEquivalences(totalCO2_g);

    // Community impact projection
    const days_tracked = allSummaries.length || 1;
    const community = getCommunityImpact({ user_co2_saved_g: totalCO2_g, days_tracked });

    // Generational projection
    const generational = getGenerationalProjection(community.annual_community_tonnes);

    res.json({
      user_heating_source: heatingSource,
      today: {
        co2_saved_g: todayCarbon.co2_saved_g,
        kwh_saved: todaySummary?.kwh_saved_est || 0,
      },
      total: {
        co2_saved_g: Math.round(totalCO2_g * 100) / 100,
        co2_saved_kg: Math.round(totalCO2_g / 10) / 100,
        days_tracked,
      },
      equivalences,
      community,
      generational,
      dailyBreakdown: dailyCarbon,
    });
  } catch (err) {
    console.error('GET /api/carbon error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/suggestions/generate — Generate LLM-powered suggestions ---
app.post('/api/suggestions/generate', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key not configured in .env' });
    }

    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);
    const device = db.prepare('SELECT * FROM devices WHERE user_id = ?').get(user.id);
    const deviceId = device ? device.device_id : 'demo-device-001';

    // Get latest reading
    const latestReading = db.prepare(
      'SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1'
    ).get(deviceId);

    // Last 24h readings for mold risk
    const last24h = db.prepare(`
      SELECT * FROM readings
      WHERE device_id = ? AND ts >= datetime('now', '-24 hours')
      ORDER BY ts ASC
    `).all(deviceId);

    // Weather, rate, indoor values (geocoded from user's postal code)
    const weather = await fetchWeather(process.env.OPENWEATHERMAP_API_KEY, user.postal_code);
    const rate = getCurrentRate(user.plan_type);
    const Tin = latestReading ? latestReading.temp_C : 21;
    let RHin = latestReading ? latestReading.humidity_RH : null;
    const Tout = weather.current.temp_C;
    const RHout = weather.current.humidity_RH;

    // Estimate indoor humidity if no sensor
    if (RHin == null && Tout != null && RHout != null && Tin != null) {
      const est = estimateIndoorHumidity(Tin, Tout, RHout);
      if (est.humidity_RH != null) RHin = est.humidity_RH;
    }

    const moldRisk = computeMoldRisk(last24h, 1);
    const target = (user.comfort_min + user.comfort_max) / 2;

    const recommendation = getRecommendation({
      Tin, RHin, Tout, RHout,
      comfort_min: user.comfort_min, comfort_max: user.comfort_max,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      periodLabel: rate.periodLabel,
      forecast: weather.forecast,
      moldRiskLevel: moldRisk.risk_level,
    });

    const costEstimate = estimateCost({
      Tin, target,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      kWh_per_degC: user.room_kwh_per_degC,
      ac_cop: user.ac_cop,
    });

    const today = new Date().toISOString().split('T')[0];
    const todaySavings = db.prepare(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?'
    ).get(user.id, today);

    // Recent notifications to avoid repetition
    const recentNotifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY ts DESC LIMIT 5
    `).all(user.id);

    // Generate via LLM
    const result = await generateSuggestions({
      user, profile,
      indoor: { temp_C: Tin, humidity_RH: RHin },
      outdoor: weather.current,
      electricity: rate,
      recommendation: { ...recommendation, text: getRecommendationText(recommendation.state) },
      moldRisk,
      costEstimate,
      recentNotifications,
      todaySavings,
    }, apiKey);

    // Store suggestions as notifications + log LLM call
    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_id, message_text, trigger_type, llm_prompt_summary)
      VALUES (?, ?, ?, ?)
    `);
    const insertLog = db.prepare(`
      INSERT INTO llm_logs (user_id, prompt_hash, context_summary, response_text, model_used, tokens_used, notification_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const stored = [];
    for (const s of result.suggestions) {
      const notifResult = insertNotif.run(user.id, s.message, s.trigger_type, result.prompt_summary || '');
      const notifId = notifResult.lastInsertRowid;
      insertLog.run(
        user.id,
        null,
        result.prompt_summary || '',
        JSON.stringify(result.suggestions),
        result.model || 'unknown',
        result.tokens_used || 0,
        notifId
      );
      stored.push({ id: notifId, message: s.message, trigger_type: s.trigger_type });
    }

    res.json({
      success: true,
      suggestions: stored,
      model: result.model,
      tokens_used: result.tokens_used,
      error: result.error || null,
    });
  } catch (err) {
    console.error('POST /api/suggestions/generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Start server
// ============================================================

// --- POST /api/chat — Conversational AI chat powered by Gemini ---
app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key not configured' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) return res.status(404).json({ error: 'No user found' });

    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(user.id);
    const device = db.prepare('SELECT * FROM devices WHERE user_id = ?').get(user.id);
    const deviceId = device?.device_id || 'demo-device-001';

    // Gather full context
    const latestReading = db.prepare(
      'SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1'
    ).get(deviceId);

    const last24h = db.prepare(`
      SELECT * FROM readings
      WHERE device_id = ? AND ts >= datetime('now', '-24 hours')
      ORDER BY ts ASC
    `).all(deviceId);

    const weather = await fetchWeather(process.env.OPENWEATHERMAP_API_KEY, user.postal_code);
    const rate = getCurrentRate(user.plan_type);
    const Tin = latestReading?.temp_C ?? 21;
    let RHin = latestReading?.humidity_RH ?? null;
    const Tout = weather.current.temp_C;
    const RHout = weather.current.humidity_RH;

    if (RHin == null && Tout != null && RHout != null && Tin != null) {
      const est = estimateIndoorHumidity(Tin, Tout, RHout);
      if (est.humidity_RH != null) RHin = est.humidity_RH;
    }

    const moldRisk = computeMoldRisk(last24h, 1);
    const target = (user.comfort_min + user.comfort_max) / 2;

    const recommendation = getRecommendation({
      Tin, RHin, Tout, RHout,
      comfort_min: user.comfort_min, comfort_max: user.comfort_max,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      periodLabel: rate.periodLabel,
      forecast: weather.forecast,
      moldRiskLevel: moldRisk.risk_level,
    });

    const costEstimate = estimateCost({
      Tin, target,
      price_cents_per_kWh: rate.price_cents_per_kWh,
      kWh_per_degC: user.room_kwh_per_degC,
      ac_cop: user.ac_cop,
    });

    const today = new Date().toISOString().split('T')[0];
    const todaySavings = db.prepare(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?'
    ).get(user.id, today);

    // Get carbon data
    const allSummaries = db.prepare(
      'SELECT * FROM daily_summary WHERE user_id = ? ORDER BY date ASC'
    ).all(user.id);
    const heatingSource = user.heating_source || 'gas';
    let totalCO2 = 0;
    allSummaries.forEach(d => { totalCO2 += dailyCarbonSavings(d.kwh_saved_est, heatingSource).co2_saved_g; });
    const carbon = {
      total: { co2_saved_kg: Math.round(totalCO2 / 10) / 100, days_tracked: allSummaries.length },
      today: { co2_saved_g: todaySavings ? dailyCarbonSavings(todaySavings.kwh_saved_est, heatingSource).co2_saved_g : 0 },
      equivalences: getEquivalences(totalCO2),
      community: getCommunityImpact({ user_co2_saved_g: totalCO2, days_tracked: allSummaries.length }),
    };

    const result = await geminiChat(message.trim(), {
      user, profile,
      indoor: { temp_C: Tin, humidity_RH: RHin, humidity_estimated: latestReading?.humidity_RH == null, pressure_hPa: latestReading?.pressure_hPa },
      outdoor: weather.current,
      weather,
      electricity: rate,
      recommendation: { ...recommendation, text: getRecommendationText(recommendation.state) },
      moldRisk,
      costEstimate,
      todaySavings: todaySavings || { dollars_saved_est: 0, kwh_saved_est: 0 },
      carbon,
    }, apiKey);

    res.json(result);
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/chat/reset — Reset chat session ---
app.post('/api/chat/reset', (req, res) => {
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  resetChat(user?.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Goldilocks backend listening on http://localhost:${PORT}`);
});
