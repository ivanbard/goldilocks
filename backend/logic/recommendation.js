/**
 * Recommendation Engine (PRD Section 9.1)
 * 
 * Produces: { state, confidence, reasons[] }
 * States: OPEN_WINDOW, USE_AC, USE_HEAT, DO_NOTHING
 */

const { isRainExpected } = require('./weather');

/**
 * Generate a ventilation/HVAC recommendation
 * 
 * @param {Object} params
 * @param {number} params.Tin - Indoor temperature °C
 * @param {number|null} params.RHin - Indoor humidity %RH (nullable)
 * @param {number} params.Tout - Outdoor temperature °C
 * @param {number} params.RHout - Outdoor humidity %RH
 * @param {number} params.comfort_min - Comfort band lower bound °C
 * @param {number} params.comfort_max - Comfort band upper bound °C
 * @param {number} params.price_cents_per_kWh - Current electricity rate
 * @param {string} params.periodLabel - Current rate period label
 * @param {Array} params.forecast - Weather forecast array
 * @param {string} params.moldRiskLevel - Current mold risk level (LOW/MEDIUM/HIGH)
 * @returns {{ state: string, confidence: string, reasons: string[] }}
 */
function getRecommendation({
  Tin, RHin, Tout, RHout,
  comfort_min = 20, comfort_max = 23,
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
  const target = (comfort_min + comfort_max) / 2;
  const isComfortable = Tin >= comfort_min && Tin <= comfort_max;
  const isTooHot = Tin > comfort_max;
  const isTooCold = Tin < comfort_min;

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
      return { state: 'OPEN_WINDOW', confidence: 'MEDIUM', reasons };
    }

    reasons.push(`Indoor temperature (${Tin.toFixed(1)}°C) is within your comfort zone (${comfort_min}–${comfort_max}°C)`);
    if (moldRiskLevel === 'MEDIUM') {
      reasons.push('Mold risk is moderate — monitor humidity');
    }
    return { state: 'DO_NOTHING', confidence: 'HIGH', reasons };
  }

  // 2. Mold risk is HIGH — prioritize ventilation if possible
  if (moldRiskLevel === 'HIGH' && outdoorDrier !== false && !rainComing) {
    reasons.push('Mold risk is HIGH — ventilation strongly recommended');
    if (outdoorDrier) reasons.push(`Outside air is drier (${RHout?.toFixed(0)}% vs ${RHin?.toFixed(0)}% inside)`);
    return { state: 'OPEN_WINDOW', confidence: 'HIGH', reasons };
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
      return { state: 'OPEN_WINDOW', confidence: outdoorDrier !== false ? 'HIGH' : 'MEDIUM', reasons };
    }

    // AC needed
    reasons.push(`Indoor temperature (${Tin.toFixed(1)}°C) is above comfort zone (${comfort_max}°C)`);
    reasons.push(`Outside (${Tout.toFixed(1)}°C) won't help cool down enough`);
    if (isExpensive) {
      reasons.push(`Electricity is ${periodLabel} (${price_cents_per_kWh}¢/kWh) — AC will be costly`);
    } else if (isCheap) {
      reasons.push(`Good news: electricity is cheap right now (${price_cents_per_kWh}¢/kWh)`);
    }
    return { state: 'USE_AC', confidence: 'HIGH', reasons };
  }

  // 4. Too cold
  if (isTooCold) {
    // Can outdoor air help? (unlikely if too cold, but check for edge cases)
    if (Tout > Tin && outdoorCloserToTarget && !rainComing) {
      const tempDiff = (Tout - Tin).toFixed(1);
      reasons.push(`Outside is ${tempDiff}°C warmer (${Tout.toFixed(1)}°C) than inside (${Tin.toFixed(1)}°C)`);
      if (isExpensive) reasons.push(`Electricity is ${periodLabel} — opening a window saves money`);
      return { state: 'OPEN_WINDOW', confidence: 'MEDIUM', reasons };
    }

    // Heat needed
    reasons.push(`Indoor temperature (${Tin.toFixed(1)}°C) is below comfort zone (${comfort_min}°C)`);
    reasons.push(`Outside (${Tout.toFixed(1)}°C) won't help warm up`);
    if (isExpensive) {
      reasons.push(`Electricity is ${periodLabel} (${price_cents_per_kWh}¢/kWh) — heating will be expensive`);
      // Bias toward waiting if close to off-peak
      reasons.push('Consider layering up if price drops soon');
    } else if (isCheap) {
      reasons.push(`Electricity is cheap right now (${price_cents_per_kWh}¢/kWh) — good time to heat`);
    }
    return { state: 'USE_HEAT', confidence: 'HIGH', reasons };
  }

  // Fallback
  reasons.push('Conditions are borderline — monitor for changes');
  return { state: 'DO_NOTHING', confidence: 'LOW', reasons };
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

module.exports = { getRecommendation, getRecommendationText };
