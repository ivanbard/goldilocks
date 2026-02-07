// #include <Wire.h>
// #include <Adafruit_SPA06_003.h>

// Adafruit_SPA06_003 spa;

// void setup() {
//   Serial.begin(115200);
//   while (!Serial) delay(10);

//   if (!spa.begin()) {
//     Serial.println("Could not find SPA06-003 sensor!");
//     while (1) delay(10);
//   }

//   Serial.println("SPA06-003 found");
// }

// void loop() {
//   sensors_event_t temp, pressure;

//   spa.getTemperatureSensor()->getEvent(&temp);
//   spa.getPressureSensor()->getEvent(&pressure);

//   Serial.print("T=");
//   Serial.print(temp.temperature, 2);
//   Serial.print(",P=");
//   Serial.print(pressure.pressure, 2);
//   Serial.println(" hPa");

//   delay(500);
// }



#include <Wire.h>
#include <math.h>
#include <Adafruit_SPA06_003.h>

Adafruit_SPA06_003 spa;
const int TEMP_PIN = A0;

float readGroveThermistorC() {
  int raw = analogRead(TEMP_PIN);
  if (raw <= 0) return NAN;

  const float B = 4275.0;
  const float R0 = 100000.0;

  float R = (1023.0 / raw - 1.0) * R0;
  float tempK = 1.0 / (log(R / R0) / B + 1.0 / 298.15);
  return tempK - 273.15;
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  if (!spa.begin()) {
    Serial.println("Could not find SPA06-003 sensor!");
    while (1) delay(10);
  }
  Serial.println("Sensors ready");
}

void loop() {
  // Barometer (Adafruit SPA06-003)
  sensors_event_t tempBaro, pressure;
  spa.getTemperatureSensor()->getEvent(&tempBaro);
  spa.getPressureSensor()->getEvent(&pressure);

  // Grove temp sensor (thermistor on A0)
  float tempTherm = readGroveThermistorC();

  // One clean line for your web app to parse:
  // (Use whichever temp you want — thermistor is your “external” temp)
  Serial.print("T=");
  Serial.print(tempTherm, 2);
  Serial.print(",P=");
  Serial.print(pressure.pressure, 2);
  Serial.print(",Tbaro=");
  Serial.println(tempBaro.temperature, 2);

  delay(500);
}
