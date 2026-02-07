/**
 * Weather module — fetches current + forecast from OpenWeatherMap
 * Geocodes user's postal code to lat/lon for location-accurate weather.
 * Falls back to Kingston city center if geocoding fails.
 * Caches results for 10 minutes to avoid API rate limits.
 */

const fetch = require('node-fetch');

// Fallback: Kingston city center
const KINGSTON_LAT = 44.2312;
const KINGSTON_LON = -76.4860;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Caches keyed by postal code
const weatherCaches = {};    // { postalCode: { data, timestamp } }
const geocodeCache = {};     // { postalCode: { lat, lon, locationName } }

/**
 * Geocode a Canadian postal code to lat/lon via OpenWeatherMap
 * Caches results permanently (postal codes don't move)
 */
async function geocodePostalCode(postalCode, apiKey) {
  if (!postalCode) return { lat: KINGSTON_LAT, lon: KINGSTON_LON, locationName: 'Kingston, ON' };

  // Normalize: uppercase, trim, take first 3 chars (FSA) for broader match
  const normalized = postalCode.trim().toUpperCase().replace(/\s/g, '');

  if (geocodeCache[normalized]) {
    return geocodeCache[normalized];
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/zip?zip=${normalized},CA&appid=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.lat && data.lon) {
      const result = {
        lat: data.lat,
        lon: data.lon,
        locationName: data.name ? `${data.name}, ${data.country || 'CA'}` : `${normalized}, CA`,
      };
      geocodeCache[normalized] = result;
      console.log(`Geocoded ${normalized} → ${result.lat}, ${result.lon} (${result.locationName})`);
      return result;
    }

    // If full code fails, try FSA (first 3 chars) via direct geocoding
    if (normalized.length > 3) {
      const fsa = normalized.substring(0, 3);
      const fsaUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${fsa},CA&limit=1&appid=${apiKey}`;
      const fsaRes = await fetch(fsaUrl);
      const fsaData = await fsaRes.json();

      if (Array.isArray(fsaData) && fsaData.length > 0 && fsaData[0].lat) {
        const result = {
          lat: fsaData[0].lat,
          lon: fsaData[0].lon,
          locationName: fsaData[0].name ? `${fsaData[0].name}, ${fsaData[0].state || 'ON'}` : `${fsa}, CA`,
        };
        geocodeCache[normalized] = result;
        console.log(`Geocoded FSA ${fsa} → ${result.lat}, ${result.lon} (${result.locationName})`);
        return result;
      }
    }
  } catch (err) {
    console.warn('Geocoding error for', normalized, ':', err.message);
  }

  // Fallback to Kingston
  console.warn(`Geocoding failed for ${normalized}, using Kingston default`);
  const fallback = { lat: KINGSTON_LAT, lon: KINGSTON_LON, locationName: 'Kingston, ON' };
  geocodeCache[normalized] = fallback;
  return fallback;
}

/**
 * Fetch current weather + 3-hour forecast from OpenWeatherMap
 * @param {string} apiKey - OpenWeatherMap API key
 * @param {string} postalCode - Canadian postal code (e.g., 'K7L 3N6' or 'K7L')
 */
async function fetchWeather(apiKey, postalCode) {
  const cacheKey = (postalCode || 'default').trim().toUpperCase().replace(/\s/g, '');
  const now = Date.now();

  // Return cached data if still fresh
  const cached = weatherCaches[cacheKey];
  if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
    return { ...cached.data, cached: true };
  }

  if (!apiKey || apiKey === 'your_api_key_here') {
    return getMockWeather();
  }

  // Geocode postal code to coordinates
  const { lat, lon, locationName } = await geocodePostalCode(postalCode, apiKey);

  try {
    // Current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();

    // Check for API errors (invalid key, rate limit, etc.)
    if (currentData.cod && currentData.cod !== 200) {
      console.warn('OpenWeatherMap API error:', currentData.message || currentData.cod);
      return getMockWeather();
    }

    // 5-day/3-hour forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=4&appid=${apiKey}`;
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    const result = {
      current: {
        temp_C: currentData.main?.temp,
        humidity_RH: currentData.main?.humidity,
        pressure_hPa: currentData.main?.pressure,
        description: currentData.weather?.[0]?.description || '',
        icon: currentData.weather?.[0]?.icon || '',
        wind_speed_ms: currentData.wind?.speed,
        feels_like_C: currentData.main?.feels_like,
      },
      forecast: (forecastData.list || []).map(f => ({
        dt: f.dt,
        dt_txt: f.dt_txt,
        temp_C: f.main?.temp,
        humidity_RH: f.main?.humidity,
        description: f.weather?.[0]?.description || '',
        icon: f.weather?.[0]?.icon || '',
        pop: f.pop || 0, // probability of precipitation (0-1)
      })),
      location: locationName,
      cached: false,
      postalCode: postalCode || null,
      fetchedAt: new Date().toISOString(),
    };

    // Update cache
    weatherCaches[cacheKey] = { data: result, timestamp: now };

    return result;
  } catch (err) {
    console.error('Weather API error:', err.message);
    // Return stale cache if available
    const stale = weatherCaches[cacheKey];
    if (stale) {
      return { ...stale.data, cached: true, stale: true };
    }
    return getMockWeather();
  }
}

/**
 * Mock weather for development/demo when no API key is set
 */
function getMockWeather() {
  const hour = new Date().getHours();
  // Simulate realistic Kingston weather
  const baseTemp = hour >= 6 && hour <= 18 ? 5 : -2; // daytime vs nighttime
  return {
    current: {
      temp_C: baseTemp + Math.random() * 4 - 2,
      humidity_RH: 55 + Math.random() * 20,
      pressure_hPa: 1013 + Math.random() * 10 - 5,
      description: 'partly cloudy',
      icon: '02d',
      wind_speed_ms: 3 + Math.random() * 5,
      feels_like_C: baseTemp - 3,
    },
    forecast: [
      { dt: Math.floor(Date.now() / 1000) + 10800, dt_txt: '', temp_C: baseTemp + 1, humidity_RH: 50, description: 'cloudy', icon: '04d', pop: 0.1 },
      { dt: Math.floor(Date.now() / 1000) + 21600, dt_txt: '', temp_C: baseTemp + 2, humidity_RH: 48, description: 'clear sky', icon: '01d', pop: 0.0 },
      { dt: Math.floor(Date.now() / 1000) + 32400, dt_txt: '', temp_C: baseTemp - 1, humidity_RH: 60, description: 'light rain', icon: '10d', pop: 0.6 },
    ],
    location: 'Kingston, ON (mock)',
    cached: false,
    mock: true,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Check if rain is expected in the next forecast periods
 */
function isRainExpected(forecast) {
  if (!forecast || !forecast.length) return false;
  return forecast.some(f => f.pop > 0.4 || (f.description && f.description.includes('rain')));
}

module.exports = { fetchWeather, isRainExpected };
