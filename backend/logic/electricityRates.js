/**
 * Ontario Electricity Rate Tables — Utilities Kingston (OEB Nov 1, 2025)
 * Source: Utilities Kingston website
 * Supports: TOU, ULO, Tiered
 * 
 * Seasons:
 *   Winter: Nov 1 – Apr 30
 *   Summer: May 1 – Oct 31
 *
 * Note: TOU rates (¢/kWh) are the same year-round; only the
 *       peak/mid-peak TIME WINDOWS swap between seasons.
 *       ULO rates are consistent year-round.
 */

// TOU rates (cents per kWh) — effective Nov 1, 2025
const TOU_RATES = {
  winter: {
    // Winter: Nov 1 – Apr 30
    // Peak demand shifts to morning & early evening (heating)
    weekday: [
      { start: 0,  end: 7,  rate: 9.8,  label: 'Off-Peak' },
      { start: 7,  end: 11, rate: 20.3, label: 'On-Peak' },
      { start: 11, end: 17, rate: 15.7, label: 'Mid-Peak' },
      { start: 17, end: 19, rate: 20.3, label: 'On-Peak' },
      { start: 19, end: 24, rate: 9.8,  label: 'Off-Peak' },
    ],
    // Weekends & holidays: all off-peak
    weekend: [
      { start: 0, end: 24, rate: 9.8, label: 'Off-Peak' },
    ],
  },
  summer: {
    // Summer: May 1 – Oct 31
    // Peak demand shifts to midday (cooling/AC)
    weekday: [
      { start: 0,  end: 7,  rate: 9.8,  label: 'Off-Peak' },
      { start: 7,  end: 11, rate: 15.7, label: 'Mid-Peak' },
      { start: 11, end: 17, rate: 20.3, label: 'On-Peak' },
      { start: 17, end: 19, rate: 15.7, label: 'Mid-Peak' },
      { start: 19, end: 24, rate: 9.8,  label: 'Off-Peak' },
    ],
    weekend: [
      { start: 0, end: 24, rate: 9.8, label: 'Off-Peak' },
    ],
  },
};

// ULO rates (cents per kWh) — Ultra-Low Overnight
// Consistent rates year-round per Utilities Kingston
const ULO_RATES = {
  winter: {
    weekday: [
      { start: 0,  end: 7,  rate: 3.9,  label: 'Ultra-Low Overnight' },
      { start: 7,  end: 16, rate: 15.7, label: 'Mid-Peak' },
      { start: 16, end: 21, rate: 39.1, label: 'On-Peak' },
      { start: 21, end: 23, rate: 15.7, label: 'Mid-Peak' },
      { start: 23, end: 24, rate: 3.9,  label: 'Ultra-Low Overnight' },
    ],
    weekend: [
      { start: 0,  end: 7,  rate: 3.9,  label: 'Ultra-Low Overnight' },
      { start: 7,  end: 23, rate: 9.8,  label: 'Weekend Off-Peak' },
      { start: 23, end: 24, rate: 3.9,  label: 'Ultra-Low Overnight' },
    ],
  },
  summer: {
    weekday: [
      { start: 0,  end: 7,  rate: 3.9,  label: 'Ultra-Low Overnight' },
      { start: 7,  end: 16, rate: 15.7, label: 'Mid-Peak' },
      { start: 16, end: 21, rate: 39.1, label: 'On-Peak' },
      { start: 21, end: 23, rate: 15.7, label: 'Mid-Peak' },
      { start: 23, end: 24, rate: 3.9,  label: 'Ultra-Low Overnight' },
    ],
    weekend: [
      { start: 0,  end: 7,  rate: 3.9,  label: 'Ultra-Low Overnight' },
      { start: 7,  end: 23, rate: 9.8,  label: 'Weekend Off-Peak' },
      { start: 23, end: 24, rate: 3.9,  label: 'Ultra-Low Overnight' },
    ],
  },
};

// Tiered rates (cents per kWh)
const TIERED_RATES = {
  winter: {
    tier1_threshold_kWh: 1000, // per month
    tier1_rate: 10.3,
    tier2_rate: 12.5,
  },
  summer: {
    tier1_threshold_kWh: 600, // per month
    tier1_rate: 10.3,
    tier2_rate: 12.5,
  },
};

/**
 * Get the current season based on date
 */
function getSeason(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  // Winter: Nov 1 – Apr 30, Summer: May 1 – Oct 31
  return (month >= 5 && month <= 10) ? 'summer' : 'winter';
}

/**
 * Check if a date is a weekend (Sat/Sun)
 */
function isWeekend(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Get the current TOU or ULO rate for a given time
 */
function getTimeOfUseRate(planRates, date = new Date()) {
  const season = getSeason(date);
  const dayType = isWeekend(date) ? 'weekend' : 'weekday';
  const hour = date.getHours();
  const schedule = planRates[season][dayType];

  for (const period of schedule) {
    if (hour >= period.start && hour < period.end) {
      return {
        price_cents_per_kWh: period.rate,
        periodLabel: period.label,
      };
    }
  }
  // Fallback
  return { price_cents_per_kWh: schedule[0].rate, periodLabel: schedule[0].label };
}

/**
 * Get current electricity rate based on plan type
 * @param {string} planType - 'TOU', 'ULO', or 'TIERED'
 * @param {Date} date - current date/time
 * @returns {{ price_cents_per_kWh: number, periodLabel: string, planType: string, season: string }}
 */
function getCurrentRate(planType = 'TOU', date = new Date()) {
  const season = getSeason(date);

  if (planType === 'TOU') {
    const { price_cents_per_kWh, periodLabel } = getTimeOfUseRate(TOU_RATES, date);
    return { price_cents_per_kWh, periodLabel, planType: 'TOU', season };
  }

  if (planType === 'ULO') {
    const { price_cents_per_kWh, periodLabel } = getTimeOfUseRate(ULO_RATES, date);
    return { price_cents_per_kWh, periodLabel, planType: 'ULO', season };
  }

  if (planType === 'TIERED') {
    // Tiered doesn't vary by time of day — use tier1 as the "current" rate
    // (tier2 kicks in when monthly usage exceeds threshold)
    const tierData = TIERED_RATES[season];
    return {
      price_cents_per_kWh: tierData.tier1_rate,
      periodLabel: `Tier 1 (up to ${tierData.tier1_threshold_kWh} kWh/mo)`,
      planType: 'TIERED',
      season,
      tier2_rate: tierData.tier2_rate,
      tier1_threshold_kWh: tierData.tier1_threshold_kWh,
    };
  }

  // Default to TOU
  return getCurrentRate('TOU', date);
}

/**
 * Get the full schedule for display purposes
 */
function getFullSchedule(planType = 'TOU', date = new Date()) {
  const season = getSeason(date);
  if (planType === 'TIERED') {
    return { planType, season, tiers: TIERED_RATES[season] };
  }
  const rates = planType === 'ULO' ? ULO_RATES : TOU_RATES;
  return {
    planType,
    season,
    weekday: rates[season].weekday,
    weekend: rates[season].weekend,
  };
}

module.exports = { getCurrentRate, getFullSchedule, getSeason, isWeekend };
