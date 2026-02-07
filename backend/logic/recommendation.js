/**
 * Recommendation Engine
 * 
 * Produces: { state, confidence, reasons[], proactive_tip }
 * States: OPEN_WINDOW, USE_AC, USE_HEAT, DO_NOTHING
 */

const { isRainExpected } = require('./weather');

/**
 * Check if a dry/favorable window is coming in the forecast
 */
function getForecastTip(forecast) {
  if (!forecast || forecast.length === 0) return null;

  // Look for rain coming soon
  const rainSoon = forecast.find((f, i) => i < 3 && f.pop > 0.4);
  if (rainSoon) {
    const hrs = Math.ceil((new Date(rainSoon.dt_txt) - Date.now()) / 3600000);
    return `🌧️ Rain expected in ~${Math.max(1, hrs)}h — ventilate now while it's still dry.`;
  }

  // Look for a dry+mild window coming
  const mildWindow = forecast.find((f, i) => i < 4 && f.humidity_RH < 55 && f.temp_C > 5 && f.temp_C < 28);
  if (mildWindow) {
    const time = new Date(mildWindow.dt_txt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `🪟 Good ventilation window coming at ~${time} (${mildWindow.temp_C.toFixed(0)}°C, ${mildWindow.humidity_RH}% RH).`;
  }

  return null;
}

/**
 * Get the right comfort band based on time of day
 */
function getComfortBand({ comfort_min, comfort_max, comfort_min_night, comfort_max_night }) {
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 7;
  if (isNight && comfort_min_night != null && comfort_max_night != null) {
    return { min: comfort_min_night, max: comfort_max_night, period: 'night' };
  }
  return { min: comfort_min, max: comfort_max, period: 'day' };
}

/**
 * Generate a ventilation/HVAC recommendation
 */
function getRecommendation({
  Tin, RHin, Tout, RHout,
  comfort_min = 20, comfort_max = 23,
  comfort_min_night, comfort_max_night,
  price_cents_per_kWh = 10, periodLabel = '',
  forecast = [],
  moldRiskLevel = 'LOW',
}) {
  // Ensure numeric safety
  Tin = typeof Tin === 'number' && !isNaN(Tin) ? Tin : 21;
  Tout = typeof Tout === 'number' && !isNaN(Tout) ? Tout : 10;
  RHin = (typeof RHin === 'number' && !isNaN(RHin)) ? RHin : null;
  RHout = (typeof RHout === 'number' && !isNaN(RHout)) ? RHout : null;
  price_cents_per_kWh = typeof price_cents_per_kWh === 'number' ? price_cents_per_kWh : 10;

  const reasons = [];

  // Use day/night comfort band
  const band = getComfortBand({ comfort_min, comfort_max, comfort_min_night, comfort_max_night });
  const effectiveMin = band.min;
  const effectiveMax = band.max;
  const target = (effectiveMin + effectiveMax) / 2;
  const isComfortable = Tin >= effectiveMin && Tin <= effectiveMax;
  const isTooHot = Tin > effectiveMax;
  const isTooCold = Tin < effectiveMin;

  // Determine if outdoor air helps
  const outdoorCloserToTarget = Math.abs(Tout - target) < Math.abs(Tin - target);
  const outdoorDrier = RHin !== null && RHout !== null ? RHout < RHin : null;
  const rainComing = isRainExpected(forecast);

  // Price sensitivity thresholds
  const isExpensive = price_cents_per_kWh >= 15; // on-peak territory
  const isCheap = price_cents_per_kWh <= 5;      // ULO overnight

  // ---- Decision Logic ----

  // 1. Comfort check — if comfortable and no mold risk, do nothing
  if (isComfortable && moldRiskLevel !== 'HIGH') {
    // But still check if we should ventilate for humidity
    if (RHin !== null && RHin > 60 && outdoorDrier && !rainComing) {
      reasons.push(`Indoor humidity is ${RHin.toFixed(0)}% — ventilating to reduce mold risk`);
      reasons.push(`Outside is drier at ${RHout.toFixed(0)}%`);
      if (rainComing) reasons.push('Note: rain expected soon');
      return { state: 'OPEN_WINDOW', confidence: 'MEDIUM', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
    }
    reasons.push(`Temperature is in your comfort zone (${effectiveMin}–${effectiveMax}°C)`);
    if (moldRiskLevel === 'MEDIUM') {
      reasons.push('Mold risk is moderate — monitor humidity');
    }
    return { state: 'DO_NOTHING', confidence: 'HIGH', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
  }

  // 2. Mold risk is HIGH — prioritize ventilation if possible
  if (moldRiskLevel === 'HIGH' && outdoorDrier !== false && !rainComing) {
    reasons.push('Mold risk is HIGH — ventilation strongly recommended');
    if (outdoorDrier) reasons.push(`Outside air is drier (${RHout?.toFixed(0)}% vs ${RHin?.toFixed(0)}% inside)`);
    return { state: 'OPEN_WINDOW', confidence: 'HIGH', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
  }

  // 3. Too hot
  if (isTooHot) {
    // Can outdoor air help?
    if (Tout < Tin && outdoorCloserToTarget && !rainComing) {
      const tempDiff = (Tin - Tout).toFixed(1);
      reasons.push(`It's ${tempDiff}°C cooler outside (${Tout.toFixed(1)}°C) than inside (${Tin.toFixed(1)}°C)`);
      if (outdoorDrier) reasons.push(`Outside is also drier (${RHout?.toFixed(0)}% vs ${RHin?.toFixed(0)}%)`);
      if (isExpensive) reasons.push(`Electricity is ${periodLabel} right now (${price_cents_per_kWh}¢/kWh) — save by opening a window`);
      if (rainComing) reasons.push('Note: rain expected in the forecast');
      return { state: 'OPEN_WINDOW', confidence: outdoorDrier !== false ? 'HIGH' : 'MEDIUM', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
    }

    // AC needed
    reasons.push(`Indoor temperature (${Tin.toFixed(1)}°C) is above comfort zone (${effectiveMax}°C)`);
    reasons.push(`Outside (${Tout.toFixed(1)}°C) won't help cool down enough`);
    if (isExpensive) {
      reasons.push(`Electricity is ${periodLabel} (${price_cents_per_kWh}¢/kWh) — AC will be costly`);
    } else if (isCheap) {
      reasons.push(`Good news: electricity is cheap right now (${price_cents_per_kWh}¢/kWh)`);
    }
    return { state: 'USE_AC', confidence: 'HIGH', reasons, proactive_tip: getForecastTip(forecast), humidity_tip: RHin > 60 ? `💧 Indoor humidity is ${RHin.toFixed(0)}% — AC is less effective above 60%. Ventilate first if possible.` : null, comfort_period: band.period };
  }

  // 4. Too cold
  if (isTooCold) {
    // Can outdoor air help? (unlikely if too cold, but check for edge cases)
    if (Tout > Tin && outdoorCloserToTarget && !rainComing) {
      const tempDiff = (Tout - Tin).toFixed(1);
      reasons.push(`Outside is ${tempDiff}°C warmer (${Tout.toFixed(1)}°C) than inside (${Tin.toFixed(1)}°C)`);
      if (isExpensive) reasons.push(`Electricity is ${periodLabel} — opening a window saves money`);
      return { state: 'OPEN_WINDOW', confidence: 'MEDIUM', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
    }

    // Heat needed
    reasons.push(`Indoor temperature (${Tin.toFixed(1)}°C) is below comfort zone (${effectiveMin}°C)`);
    reasons.push(`Outside (${Tout.toFixed(1)}°C) won't help warm up`);
    if (isExpensive) {
      reasons.push(`Electricity is ${periodLabel} (${price_cents_per_kWh}¢/kWh) — heating will be expensive`);
      // Bias toward waiting if close to off-peak
      reasons.push('Consider layering up if price drops soon');
    } else if (isCheap) {
      reasons.push(`Electricity is cheap right now (${price_cents_per_kWh}¢/kWh) — good time to heat`);
    }
    return { state: 'USE_HEAT', confidence: 'HIGH', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
  }

  // Fallback
  reasons.push('Conditions are borderline — monitor for changes');
  return { state: 'DO_NOTHING', confidence: 'LOW', reasons, proactive_tip: getForecastTip(forecast), comfort_period: band.period };
}

/**
 * Human-readable recommendation text
 */
function getRecommendationText(state) {
  const texts = {
    OPEN_WINDOW: '🪟 Open your window to save money and improve air quality.',
    USE_AC: '❄️ Use your AC — outside air won\'t help right now.',
    USE_HEAT: '🔥 Turn on heating — it\'s too cold to ventilate.',
    DO_NOTHING: '✅ You\'re comfortable! No action needed right now.',
  };
  return texts[state] || texts.DO_NOTHING;
}

module.exports = { getRecommendation, getRecommendationText, getComfortBand, getForecastTip };
