/**
 * Mold Risk Model (PRD Section 9.3)
 * 
 * Computes risk level (LOW/MEDIUM/HIGH), risk score 0-100,
 * and explanation from last 24h humidity readings.
 */

/**
 * Compute mold risk from humidity readings
 * 
 * @param {Array<{ts: string, humidity_RH: number|null}>} readings - Last 24h readings
 * @param {number} intervalMinutes - Expected interval between readings (default 1)
 * @returns {{ risk_level: string, risk_score: number, explanation: string, stats: Object }}
 */
function computeMoldRisk(readings, intervalMinutes = 1) {
  // Filter to readings with valid humidity
  const validReadings = readings.filter(r => r.humidity_RH !== null && r.humidity_RH !== undefined);

  if (validReadings.length === 0) {
    return {
      risk_level: 'UNKNOWN',
      risk_score: 0,
      explanation: 'No humidity data available — connect a humidity sensor to enable mold risk tracking.',
      stats: { minutes_over_60: 0, minutes_over_70: 0, minutes_60_70: 0, max_consecutive_over_70: 0, readingCount: 0 },
    };
  }

  // Calculate time-based metrics
  let minutes_over_60 = 0;
  let minutes_over_70 = 0;
  let minutes_60_70 = 0;
  let consecutive_over_70 = 0;
  let max_consecutive_over_70 = 0;
  let current_humidity = validReadings[validReadings.length - 1].humidity_RH;

  for (const reading of validReadings) {
    const rh = reading.humidity_RH;

    if (rh > 70) {
      minutes_over_70 += intervalMinutes;
      minutes_over_60 += intervalMinutes;
      consecutive_over_70 += intervalMinutes;
      max_consecutive_over_70 = Math.max(max_consecutive_over_70, consecutive_over_70);
    } else if (rh > 60) {
      minutes_over_60 += intervalMinutes;
      minutes_60_70 += intervalMinutes;
      consecutive_over_70 = 0;
    } else {
      consecutive_over_70 = 0;
    }
  }

  const stats = {
    minutes_over_60,
    minutes_over_70,
    minutes_60_70,
    max_consecutive_over_70,
    current_humidity,
    readingCount: validReadings.length,
  };

  // Determine risk level (PRD thresholds)
  let risk_level = 'LOW';
  let risk_score = 0;
  let explanation = '';

  // HIGH: >70% for >3 hours cumulative/day OR >90 min consecutive
  if (minutes_over_70 > 180 || max_consecutive_over_70 > 90) {
    risk_level = 'HIGH';
    risk_score = Math.min(100, 60 + Math.round((minutes_over_70 / 360) * 40));

    const hours_over_70 = (minutes_over_70 / 60).toFixed(1);
    explanation = `⚠️ Humidity has been above 70% for ${hours_over_70} hours today.`;

    if (max_consecutive_over_70 > 90) {
      const consec_hours = (max_consecutive_over_70 / 60).toFixed(1);
      explanation += ` Peak continuous stretch: ${consec_hours} hours.`;
    }
    explanation += ' Mold can begin growing in these conditions. Ventilate immediately if possible.';
  }
  // MEDIUM: 60-70% for more than 60 min/day
  else if (minutes_over_60 > 60) {
    risk_level = 'MEDIUM';
    risk_score = Math.min(59, 25 + Math.round((minutes_over_60 / 240) * 35));

    const hours_over_60 = (minutes_over_60 / 60).toFixed(1);
    explanation = `Humidity has been above 60% for ${hours_over_60} hours today. Monitor and ventilate when outdoor air is drier.`;
  }
  // LOW
  else {
    risk_level = 'LOW';
    risk_score = Math.min(24, Math.round((minutes_over_60 / 60) * 24));
    explanation = 'Humidity levels are within safe range. No mold risk detected.';
  }

  return { risk_level, risk_score, explanation, stats };
}

module.exports = { computeMoldRisk };
