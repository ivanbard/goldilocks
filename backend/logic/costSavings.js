/**
 * Cost & Savings Model
 * 
 * Uses physics-based formula from project spec:
 *   kWh per °C = k × 0.000335 × V / COP
 * where:
 *   k = furnishing factor (3=light, 5=typical dorm, 9=concrete)
 *   V = room volume in m³
 *   COP = coefficient of performance (1 for heating, 2.5 for cooling, 3 for heat pump)
 * 
 * Room approximation: 4m × 3m × 2.5m = 30m³ (student room)
 */

// Housing type to volume and furnishing factor mapping
const HOUSING_PROFILES = {
  dorm:      { volume: 30, k: 5 },
  apartment: { volume: 45, k: 5 },
  house:     { volume: 80, k: 7 },
  basement:  { volume: 35, k: 7 },
  other:     { volume: 40, k: 5 },
};

/**
 * Calculate kWh per °C using physics formula: k × 0.000335 × V
 */
function kWhPerDegC(housing_type = 'apartment') {
  const profile = HOUSING_PROFILES[housing_type] || HOUSING_PROFILES.apartment;
  return profile.k * 0.000335 * profile.volume;
}

/**
 * Estimate HVAC cost for the next hour
 */
function estimateCost({
  Tin,
  target,
  price_cents_per_kWh,
  kWh_per_degC,
  ac_cop = 2.5,
  housing_type = 'apartment',
}) {
  // Use physics formula if no explicit override
  const effectiveKwh = kWh_per_degC || kWhPerDegC(housing_type);
  const deltaT = Math.abs(target - Tin);
  const kWh_room = effectiveKwh * deltaT;

  // Heating cost (direct electric / furnace equivalent)
  const cost_heat = kWh_room * (price_cents_per_kWh / 100);

  // Cooling cost (with COP — AC more efficient per kWh but humidity matters)
  const kWh_elec_ac = kWh_room / ac_cop;
  const cost_ac = kWh_elec_ac * (price_cents_per_kWh / 100);

  // Ventilation cost
  const cost_window = 0;

  // Determine the relevant HVAC mode
  const needsCooling = Tin > target;
  const needsHeating = Tin < target;
  const hvac_cost = needsCooling ? cost_ac : needsHeating ? cost_heat : 0;
  const mode = needsCooling ? 'AC' : needsHeating ? 'HEAT' : 'NONE';

  // Savings = HVAC cost - window cost
  const savings = hvac_cost - cost_window;

  return {
    cost_heat: Math.round(cost_heat * 10000) / 10000,
    cost_ac: Math.round(cost_ac * 10000) / 10000,
    cost_window,
    hvac_cost: Math.round(hvac_cost * 10000) / 10000,
    savings: Math.round(savings * 10000) / 10000,
    deltaT: Math.round(deltaT * 10) / 10,
    kWh_room: Math.round(kWh_room * 1000) / 1000,
    mode,
    assumptions: {
      kWh_per_degC: Math.round(effectiveKwh * 10000) / 10000,
      ac_cop,
      room_volume_m3: (HOUSING_PROFILES[housing_type] || HOUSING_PROFILES.apartment).volume,
      furnishing_factor: (HOUSING_PROFILES[housing_type] || HOUSING_PROFILES.apartment).k,
      formula: 'k × 0.000335 × V',
    },
  };
}

/**
 * Aggregate daily savings from recommendations log
 */
function calculatePeriodSavings(dailySummaries) {
  const total = {
    dollars_saved: 0,
    kwh_saved: 0,
    days: dailySummaries.length,
  };

  for (const day of dailySummaries) {
    total.dollars_saved += day.dollars_saved_est || 0;
    total.kwh_saved += day.kwh_saved_est || 0;
  }

  total.dollars_saved = Math.round(total.dollars_saved * 100) / 100;
  total.kwh_saved = Math.round(total.kwh_saved * 100) / 100;

  return total;
}

module.exports = { estimateCost, calculatePeriodSavings };
