/**
 * Humidity Estimator — approximates indoor relative humidity
 * when no humidity sensor is available.
 *
 * Method: Uses the Magnus formula for saturation vapor pressure.
 * Assumes indoor absolute humidity ≈ outdoor absolute humidity
 * (valid when air exchange dominates over internal moisture sources).
 *
 * When outdoor air at (T_out, RH_out) enters and warms/cools to T_in,
 * the relative humidity changes because warmer air holds more moisture.
 *
 * Formula:
 *   e_sat(T) = 6.112 * exp((17.67 * T) / (T + 243.5))  [hPa]
 *   e_actual = RH_out/100 * e_sat(T_out)
 *   RH_in ≈ (e_actual / e_sat(T_in)) * 100
 *
 * This gives a lower bound for indoor RH (doesn't account for
 * cooking, breathing, showers adding moisture indoors).
 */

/**
 * Saturation vapor pressure using Magnus formula
 * @param {number} tempC - Temperature in Celsius
 * @returns {number} Saturation vapor pressure in hPa
 */
function saturationVaporPressure(tempC) {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/**
 * Estimate indoor relative humidity from outdoor weather + indoor temperature
 *
 * @param {number} indoorTempC - Indoor temperature (from Arduino)
 * @param {number} outdoorTempC - Outdoor temperature (from weather API)
 * @param {number} outdoorRH - Outdoor relative humidity % (from weather API)
 * @param {object} [options] - Optional adjustments
 * @param {number} [options.moistureBoostPct=8] - Extra RH% to add for indoor moisture sources
 *    (cooking, breathing, showers). Typical range: 5-15%.
 * @returns {{ humidity_RH: number, confidence: string, method: string }} Estimated indoor RH
 */
function estimateIndoorHumidity(indoorTempC, outdoorTempC, outdoorRH, options = {}) {
  // Validate inputs
  if (indoorTempC == null || outdoorTempC == null || outdoorRH == null) {
    return { humidity_RH: null, confidence: 'NONE', method: 'missing_data' };
  }

  if (isNaN(indoorTempC) || isNaN(outdoorTempC) || isNaN(outdoorRH)) {
    return { humidity_RH: null, confidence: 'NONE', method: 'invalid_data' };
  }

  const moistureBoost = options.moistureBoostPct ?? 8;

  // Calculate actual vapor pressure from outdoor conditions
  const eSatOut = saturationVaporPressure(outdoorTempC);
  const eActual = (outdoorRH / 100) * eSatOut;

  // Calculate what RH that moisture level gives at indoor temp
  const eSatIn = saturationVaporPressure(indoorTempC);
  let estimatedRH = (eActual / eSatIn) * 100;

  // Add moisture boost for indoor sources (people, cooking, etc.)
  estimatedRH += moistureBoost;

  // Clamp to 0-100
  estimatedRH = Math.max(0, Math.min(100, estimatedRH));

  // Confidence assessment
  const deltaT = Math.abs(indoorTempC - outdoorTempC);
  let confidence;
  if (deltaT < 5) {
    confidence = 'HIGH';   // Small temp diff → estimate is quite reliable
  } else if (deltaT < 15) {
    confidence = 'MEDIUM'; // Moderate diff → reasonable estimate
  } else {
    confidence = 'LOW';    // Large diff → more uncertainty from moisture sources
  }

  return {
    humidity_RH: Math.round(estimatedRH * 10) / 10,
    confidence,
    method: 'magnus_estimate',
    details: {
      outdoorTempC,
      outdoorRH,
      indoorTempC,
      eSatOutdoor: Math.round(eSatOut * 100) / 100,
      eSatIndoor: Math.round(eSatIn * 100) / 100,
      eActual: Math.round(eActual * 100) / 100,
      baseEstimate: Math.round((eActual / eSatIn) * 10000) / 100,
      moistureBoostPct: moistureBoost,
    },
  };
}

module.exports = { estimateIndoorHumidity, saturationVaporPressure };
