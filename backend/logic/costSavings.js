/**
 * Cost & Savings Model (PRD Section 9.2)
 * 
 * Estimates 1-hour cost difference between HVAC vs natural ventilation
 * Room approximation: 4m × 3m × 2.5m = 30m³ (student room)
 */

/**
 * Estimate HVAC cost for the next hour
 * 
 * @param {Object} params
 * @param {number} params.Tin - Indoor temperature °C
 * @param {number} params.target - Target temperature °C
 * @param {number} params.price_cents_per_kWh - Current electricity rate
 * @param {number} params.kWh_per_degC - Energy per degree (default 0.1)
 * @param {number} params.ac_cop - AC coefficient of performance (default 3)
 * @returns {{ cost_heat: number, cost_ac: number, cost_window: number, savings: number, deltaT: number, kWh_room: number, mode: string }}
 */
function estimateCost({
  Tin,
  target,
  price_cents_per_kWh,
  kWh_per_degC = 0.1,
  ac_cop = 3.0,
}) {
  const deltaT = Math.abs(target - Tin);
  const kWh_room = kWh_per_degC * deltaT;

  // Heating cost (direct electric)
  const cost_heat = kWh_room * (price_cents_per_kWh / 100);

  // Cooling cost (with COP)
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
      kWh_per_degC,
      ac_cop,
      room_volume_m3: 30,
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
