/**
 * Weather module — fetches current + forecast from OpenWeatherMap for Kingston, ON
 * Caches results for 10 minutes to avoid API rate limits
 */

const fetch = require('node-fetch');

const KINGSTON_LAT = 44.2312;
const KINGSTON_LON = -76.4860;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

let weatherCache = null;
let cacheTimestamp = 0;

/**
 * Fetch current weather + 3-hour forecast from OpenWeatherMap
 */
async function fetchWeather(apiKey) {
  const now = Date.now();

  // Return cached data if still fresh
  if (weatherCache && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return { ...weatherCache, cached: true };
  }

  if (!apiKey || apiKey === 'your_api_key_here') {
    // Return mock data when no API key configured
    return getMockWeather();
  }

  try {
    // Current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${KINGSTON_LAT}&lon=${KINGSTON_LON}&units=metric&appid=${apiKey}`;
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();

    // 5-day/3-hour forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${KINGSTON_LAT}&lon=${KINGSTON_LON}&units=metric&cnt=4&appid=${apiKey}`;
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
      location: 'Kingston, ON',
      cached: false,
      fetchedAt: new Date().toISOString(),
    };

    // Update cache
    weatherCache = result;
    cacheTimestamp = now;

    return result;
  } catch (err) {
    console.error('Weather API error:', err.message);
    // Return stale cache if available
    if (weatherCache) {
      return { ...weatherCache, cached: true, stale: true };
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
