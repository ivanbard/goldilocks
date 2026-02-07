/**
 * Goldilocks — Keystudio DHT11 Temperature & Humidity Sensor
 * 
 * Wiring:
 *   DHT11 Signal → Digital Pin 4
 *   DHT11 VCC   → 5V
 *   DHT11 GND   → GND
 * 
 * Output format (parsed by gateway):
 *   T=<temp>,H=<humidity>
 * 
 * Requires: DHT sensor library by Adafruit
 *   Arduino IDE → Sketch → Include Library → Manage Libraries
 *   Search "DHT sensor library" → Install "DHT sensor library" by Adafruit
 *   (It will also prompt to install "Adafruit Unified Sensor" — say Yes)
 */

#include <DHT.h>

#define DHTPIN 4        // Digital pin connected to the DHT sensor
#define DHTTYPE DHT11   // Keystudio module uses DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  dht.begin();
  Serial.println("DHT11 ready");
}

void loop() {
  // DHT11 needs ~2s between reads
  delay(2000);

  float humidity = dht.readHumidity();
  float tempC    = dht.readTemperature();

  // Check for failed reads
  if (isnan(humidity) || isnan(tempC)) {
    Serial.println("ERR=DHT_READ_FAIL");
    return;
  }

  // Output in gateway-compatible format
  Serial.print("T=");
  Serial.print(tempC, 2);
  Serial.print(",H=");
  Serial.println(humidity, 1);
}
