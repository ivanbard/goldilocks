/**
 * Timezone utilities for EST (Eastern Standard Time)
 * Kingston, Ontario is in EST/EDT (America/Toronto)
 */

/**
 * Get current date/time in EST timezone
 * @returns {Date} Date object adjusted to EST
 */
function getESTDate() {
  // Create date in EST/EDT (America/Toronto)
  const now = new Date();
  const estString = now.toLocaleString('en-US', { timeZone: 'America/Toronto' });
  return new Date(estString);
}

/**
 * Convert any date to EST
 * @param {Date|string|number} date - Date to convert
 * @returns {Date} Date object in EST
 */
function toEST(date) {
  const d = new Date(date);
  const estString = d.toLocaleString('en-US', { timeZone: 'America/Toronto' });
  return new Date(estString);
}

module.exports = { getESTDate, toEST };
