/**
 * Goldilocks — ESP32 WiFi Sensor Node
 * 
 * Reads DHT11 temp + humidity, POSTs directly to the backend API
 * over WiFi every 30 seconds. No gateway needed.
 * 
 * Wiring:
 *   DHT11 Signal → GPIO 2
 *   DHT11 VCC   → 3.3V (or 5V if your board has it)
 *   DHT11 GND   → GND
 * 
 * Board setup in Arduino IDE:
 *   1. File → Preferences → Additional Board Manager URLs:
 *      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *   2. Tools → Board → Boards Manager → search "esp32" → install "esp32 by Espressif"
 *   3. Tools → Board → ESP32 Dev Module (or your specific board)
 *   4. Tools → Port → (your ESP32 COM port)
 * 
 * Libraries needed:
 *   - DHT sensor library by Adafruit (same as before)
 *   - Adafruit Unified Sensor
 *   - HTTPClient and WiFi are built into ESP32 core (no install needed)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ─── Configuration ───────────────────────────────────────────
const char* WIFI_SSID     = "Distributel15145";
const char* WIFI_PASSWORD = "5gq69or7t392";

// For local dev, use your computer's local IP (not localhost — ESP32 is a separate device)
// For deployed backend, use the Railway URL
const char* BACKEND_URL   = "http://192.168.68.65:3001/api/readings";

const char* DEVICE_ID     = "esp32-sensor-001";
const int   SEND_INTERVAL = 30000; // 30 seconds

#define DHTPIN  2       // GPIO2 — data pin
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// ─── WiFi connection ─────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connection failed — will retry...");
  }
}

// ─── POST reading to backend ─────────────────────────────────
void sendReading(float tempC, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected — reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload — same format the gateway uses
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"temp_C\":" + String(tempC, 2) + ",";
  payload += "\"humidity_RH\":" + String(humidity, 1) + ",";
  payload += "\"pressure_hPa\":null,";
  payload += "\"status_flags\":\"ok\"";
  payload += "}";

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("POST OK (");
    Serial.print(httpCode);
    Serial.print(") → T=");
    Serial.print(tempC, 2);
    Serial.print("°C H=");
    Serial.print(humidity, 1);
    Serial.println("%");
  } else {
    Serial.print("POST failed: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
}

// ─── Setup ───────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== Goldilocks ESP32 Sensor ===");
  
  dht.begin();
  connectWiFi();
  
  Serial.println("Ready — sending readings every 30s");
}

// ─── Main loop ───────────────────────────────────────────────
// Accumulate readings every 2s, send average every 30s
const int READS_PER_SEND = SEND_INTERVAL / 2000; // 15 reads per send

void loop() {
  float tempSum = 0;
  float humSum = 0;
  int validCount = 0;

  for (int i = 0; i < READS_PER_SEND; i++) {
    delay(2000);
    
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    
    if (!isnan(h) && !isnan(t)) {
      tempSum += t;
      humSum += h;
      validCount++;
    } else {
      Serial.println("DHT read error — skipping");
    }
  }

  if (validCount > 0) {
    float avgTemp = tempSum / validCount;
    float avgHum = humSum / validCount;
    sendReading(avgTemp, avgHum);
  } else {
    Serial.println("No valid readings in this cycle");
  }
}
