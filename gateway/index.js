/**
 * VentSmart Gateway — reads Arduino serial output, posts to backend API
 * 
 * Arduino output format: T=<temp>,P=<pressure>,Tbaro=<baroTemp>
 * Optional future: T=<temp>,P=<pressure>,Tbaro=<baroTemp>,H=<humidity>
 * 
 * Aggregates readings over SEND_INTERVAL and posts average to backend.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch');

const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD) || 115200;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const DEVICE_ID = process.env.DEVICE_ID || 'demo-device-001';
const SEND_INTERVAL_MS = 30 * 1000; // 30 seconds

// Buffer for accumulating readings
let readingBuffer = [];

/**
 * Parse Arduino serial line: T=22.45,P=1013.25,Tbaro=23.10[,H=55.3]
 */
function parseLine(line) {
  const parts = {};
  const pairs = line.trim().split(',');

  for (const pair of pairs) {
    const [key, val] = pair.split('=');
    if (key && val) {
      parts[key.trim()] = parseFloat(val.trim());
    }
  }

  return {
    temp_C: isNaN(parts['T']) ? null : parts['T'],
    pressure_hPa: isNaN(parts['P']) ? null : parts['P'],
    temp_baro_C: isNaN(parts['Tbaro']) ? null : parts['Tbaro'],
    humidity_RH: isNaN(parts['H']) ? null : parts['H'],
  };
}

/**
 * Average the buffered readings and post to backend
 */
async function sendAggregatedReading() {
  if (readingBuffer.length === 0) {
    console.log(`[${new Date().toISOString()}] No readings to send`);
    return;
  }

  const count = readingBuffer.length;
  const avg = {
    temp_C: 0,
    humidity_RH: null,
    pressure_hPa: 0,
  };

  let humidityCount = 0;

  for (const r of readingBuffer) {
    if (r.temp_C !== null) avg.temp_C += r.temp_C;
    if (r.pressure_hPa !== null) avg.pressure_hPa += r.pressure_hPa;
    if (r.humidity_RH !== null) {
      avg.humidity_RH = (avg.humidity_RH || 0) + r.humidity_RH;
      humidityCount++;
    }
  }

  avg.temp_C = Math.round((avg.temp_C / count) * 100) / 100;
  avg.pressure_hPa = Math.round((avg.pressure_hPa / count) * 100) / 100;
  if (humidityCount > 0) {
    avg.humidity_RH = Math.round((avg.humidity_RH / humidityCount) * 100) / 100;
  }

  // Clear buffer
  readingBuffer = [];

  const payload = {
    device_id: DEVICE_ID,
    temp_C: avg.temp_C,
    humidity_RH: avg.humidity_RH,
    pressure_hPa: avg.pressure_hPa,
    status_flags: 'ok',
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`[${new Date().toISOString()}] Sent avg of ${count} readings → id=${data.id} | T=${payload.temp_C}°C P=${payload.pressure_hPa}hPa H=${payload.humidity_RH ?? 'N/A'}%`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send reading:`, err.message);
  }
}

/**
 * List available serial ports (helpful for finding the right one)
 */
async function listPorts() {
  const ports = await SerialPort.list();
  console.log('Available serial ports:');
  for (const p of ports) {
    console.log(`  ${p.path} — ${p.manufacturer || 'unknown'} (${p.pnpId || ''})`);
  }
  return ports;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('VentSmart Gateway starting...');
  console.log(`Serial: ${SERIAL_PORT} @ ${SERIAL_BAUD} baud`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`Send interval: ${SEND_INTERVAL_MS / 1000}s`);
  console.log('');

  await listPorts();
  console.log('');

  let port;
  try {
    port = new SerialPort({
      path: SERIAL_PORT,
      baudRate: SERIAL_BAUD,
    });
  } catch (err) {
    console.error(`Cannot open ${SERIAL_PORT}: ${err.message}`);
    console.error('Check SERIAL_PORT in .env and ensure Arduino is connected.');
    process.exit(1);
  }

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  port.on('open', () => {
    console.log(`Serial port ${SERIAL_PORT} opened`);
  });

  parser.on('data', (line) => {
    // Skip non-data lines (e.g., "Sensors ready")
    if (!line.includes('T=')) return;

    const reading = parseLine(line);

    // Basic validation
    if (reading.temp_C !== null && (reading.temp_C < -40 || reading.temp_C > 80)) {
      console.warn(`Invalid temp: ${reading.temp_C}°C — skipping`);
      return;
    }

    readingBuffer.push(reading);
  });

  port.on('error', (err) => {
    console.error('Serial port error:', err.message);
  });

  port.on('close', () => {
    console.log('Serial port closed — attempting reconnect in 5s...');
    setTimeout(main, 5000);
  });

  // Send aggregated readings at interval
  setInterval(sendAggregatedReading, SEND_INTERVAL_MS);

  console.log('Gateway running. Waiting for data...');
}

main().catch(console.error);
