/**
 * Carbon Emissions Estimator for Goldilocks Kingston
 * 
 * Calculates CO2 emissions avoided by using smart ventilation
 * instead of HVAC (heating/cooling).
 * 
 * Sources:
 * - Ontario grid carbon intensity: ~25-40 g CO2/kWh (mostly nuclear/hydro)
 *   https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html
 * - Natural gas heating: ~180-200 g CO2/kWh thermal
 *   https://www.nrcan.gc.ca/energy/publications/efficiency/buildings/6561
 * - Kingston average home: ~5 tonnes CO2/year for heating
 *   City of Kingston Community Energy & Emissions Plan
 */

// Ontario electricity grid intensity (g CO2 / kWh)
// Low because Ontario is ~60% nuclear, ~25% hydro, ~10% gas
const GRID_INTENSITY_G_PER_KWH = 35;

// Canada national grid intensity (g CO2 / kWh) — used for national comparisons
// Source: Canada Energy Regulator
const CANADA_GRID_INTENSITY = 127.82;

// Natural gas heating intensity (g CO2 / kWh thermal equivalent)
// Most Kingston homes use gas furnaces
const GAS_HEAT_INTENSITY_G_PER_KWH = 185;

// Average furnace efficiency
const FURNACE_EFFICIENCY = 0.92;

// CO2 equivalence factors for user-friendly display
const EQUIVALENCES = {
  tree_kg_per_year: 22,        // 1 mature tree absorbs ~22 kg CO2/year
  driving_g_per_km: 170,       // Average car emits ~170 g CO2/km
  phone_charges_g: 8.22,       // ~8.22 g CO2 per phone charge
  shower_minutes_g_per_min: 90, // ~90 g CO2 per minute of hot water
  led_hours_g_per_hour: 0.35,  // ~0.35 g CO2 per LED bulb hour (Ontario grid)
};

// Kingston community scaling
const KINGSTON_HOUSEHOLDS = 60000;    // Approx households in Kingston CMA
const KINGSTON_POP = 136685;          // 2021 Census
const AVG_HOME_CO2_TONNES_YEAR = 5.0; // Average Kingston home heating CO2

/**
 * Calculate CO2 saved from a single ventilation decision
 * 
 * When Goldilocks recommends opening a window instead of running HVAC,
 * the avoided emissions depend on the heating source.
 * 
 * @param {Object} params
 * @param {number} params.kWh_avoided - kWh of HVAC energy not used
 * @param {string} params.mode - 'HEAT' or 'AC' 
 * @param {string} params.heating_source - 'gas', 'electric', 'heatpump'
 * @returns {{ co2_g: number, source: string }}
 */
function calculateAvoidedCO2({ kWh_avoided, mode = 'HEAT', heating_source = 'gas' }) {
  if (!kWh_avoided || kWh_avoided <= 0) return { co2_g: 0, source: heating_source };

  let co2_g = 0;

  if (mode === 'HEAT') {
    switch (heating_source) {
      case 'gas':
        // Gas furnace: account for furnace efficiency
        co2_g = (kWh_avoided / FURNACE_EFFICIENCY) * GAS_HEAT_INTENSITY_G_PER_KWH;
        break;
      case 'electric':
        co2_g = kWh_avoided * GRID_INTENSITY_G_PER_KWH;
        break;
      case 'heatpump':
        // Heat pump COP ~3, so grid emissions / COP
        co2_g = (kWh_avoided / 3) * GRID_INTENSITY_G_PER_KWH;
        break;
      default:
        co2_g = kWh_avoided * GAS_HEAT_INTENSITY_G_PER_KWH;
    }
  } else if (mode === 'AC') {
    // AC is always electric
    co2_g = kWh_avoided * GRID_INTENSITY_G_PER_KWH;
  }

  return {
    co2_g: Math.round(co2_g * 100) / 100,
    source: heating_source,
  };
}

/**
 * Convert CO2 grams into human-friendly equivalences
 * @param {number} co2_g - Total CO2 saved in grams
 * @returns {Object} Various equivalencies
 */
function getEquivalences(co2_g) {
  if (!co2_g || co2_g <= 0) {
    return {
      trees_equivalent: 0,
      km_not_driven: 0,
      phone_charges: 0,
      shower_minutes_saved: 0,
      led_bulb_hours: 0,
    };
  }

  return {
    trees_equivalent: Math.round((co2_g / 1000 / EQUIVALENCES.tree_kg_per_year) * 1000) / 1000,
    km_not_driven: Math.round((co2_g / EQUIVALENCES.driving_g_per_km) * 10) / 10,
    phone_charges: Math.round(co2_g / EQUIVALENCES.phone_charges_g),
    shower_minutes_saved: Math.round((co2_g / EQUIVALENCES.shower_minutes_g_per_min) * 10) / 10,
    led_bulb_hours: Math.round(co2_g / EQUIVALENCES.led_hours_g_per_hour),
  };
}

/**
 * Project long-term community impact if all Kingston households used Goldilocks
 * 
 * @param {Object} params
 * @param {number} params.user_co2_saved_g - This user's CO2 saved so far in grams
 * @param {number} params.days_tracked - Number of days tracking
 * @returns {Object} Projected community impact
 */
function getCommunityImpact({ user_co2_saved_g, days_tracked }) {
  if (!days_tracked || days_tracked <= 0 || !user_co2_saved_g) {
    return {
      daily_avg_g: 0,
      annual_user_kg: 0,
      annual_community_tonnes: 0,
      annual_community_trees: 0,
      pct_reduction: 0,
      kingston_households: KINGSTON_HOUSEHOLDS,
      kingston_population: KINGSTON_POP,
    };
  }

  const daily_avg_g = user_co2_saved_g / days_tracked;
  const annual_user_kg = (daily_avg_g * 365) / 1000;
  
  // If every household in Kingston saved the same
  const annual_community_tonnes = (annual_user_kg * KINGSTON_HOUSEHOLDS) / 1000;
  const annual_community_trees = Math.round(annual_community_tonnes * 1000 / EQUIVALENCES.tree_kg_per_year);
  
  // Percentage of Kingston's residential heating emissions
  const kingston_total_tonnes = AVG_HOME_CO2_TONNES_YEAR * KINGSTON_HOUSEHOLDS;
  const pct_reduction = (annual_community_tonnes / kingston_total_tonnes) * 100;

  return {
    daily_avg_g: Math.round(daily_avg_g * 10) / 10,
    annual_user_kg: Math.round(annual_user_kg * 10) / 10,
    annual_community_tonnes: Math.round(annual_community_tonnes),
    annual_community_trees: annual_community_trees,
    pct_reduction: Math.round(pct_reduction * 100) / 100,
    kingston_households: KINGSTON_HOUSEHOLDS,
    kingston_population: KINGSTON_POP,
  };
}

/**
 * Get generational impact projection
 * "What happens if we keep this up for 10, 25, 50 years?"
 * 
 * @param {number} annual_community_tonnes - Annual community CO2 reduction in tonnes
 * @returns {Array} Array of milestone projections
 */
function getGenerationalProjection(annual_community_tonnes) {
  const milestones = [1, 5, 10, 25, 50];
  
  return milestones.map(years => {
    const cumulative_tonnes = annual_community_tonnes * years;
    const trees_equivalent = Math.round(cumulative_tonnes * 1000 / EQUIVALENCES.tree_kg_per_year);
    const km_equivalent = Math.round(cumulative_tonnes * 1e6 / EQUIVALENCES.driving_g_per_km);
    
    return {
      years,
      label: years === 1 ? 'This Year' : `${years} Years`,
      cumulative_tonnes: Math.round(cumulative_tonnes),
      trees_equivalent,
      km_equivalent,
      description: getTimeframeDescription(years, cumulative_tonnes),
    };
  });
}

function getTimeframeDescription(years, tonnes) {
  if (years === 1) return `Year one: building momentum for Kingston's green future`;
  if (years === 5) return `Half a decade of cleaner air for Kingston families`;
  if (years === 10) return `A full decade — today's children grow up breathing cleaner`;
  if (years === 25) return `A generation of sustainable living, setting the standard`;
  if (years === 50) return `Two generations — a true Golden Age legacy for Kingston`;
  return '';
}

/**
 * Calculate carbon data for the daily summary
 * Called when daily_summary is updated
 * 
 * @param {number} kwh_saved - kWh saved that day  
 * @param {string} heating_source - 'gas', 'electric', 'heatpump'
 * @returns {{ co2_saved_g: number }}
 */
function dailyCarbonSavings(kwh_saved, heating_source = 'gas') {
  // Most savings in Kingston are from avoiding gas heating
  const result = calculateAvoidedCO2({
    kWh_avoided: kwh_saved || 0,
    mode: 'HEAT',
    heating_source,
  });
  return { co2_saved_g: result.co2_g };
}

module.exports = {
  calculateAvoidedCO2,
  getEquivalences,
  getCommunityImpact,
  getGenerationalProjection,
  dailyCarbonSavings,
  GRID_INTENSITY_G_PER_KWH,
  GAS_HEAT_INTENSITY_G_PER_KWH,
  KINGSTON_HOUSEHOLDS,
};
