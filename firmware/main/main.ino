/*
  Smart Plant Irrigation System — ESP32-WROOM-32
  ------------------------------------------------
  Main firmware sketch.

  Status: Phase 5 — Custom backend integration (Render).
  - Wakes every COMMAND_CHECK_INTERVAL_SECONDS to poll the backend
    for pending manual commands (activate pump / suspension state).
  - Every FULL_CYCLE_EVERY_N_CHECKS wake-ups, runs a full cycle:
    reads all sensors, applies thresholds, waters if needed, and
    reports data back to the backend.
  - Blynk is kept running in parallel as a fallback dashboard.
  - Per-plant pump duration and suspension are fetched from the
    backend; thresholds fall back to config.h defaults if the
    backend is unreachable.
*/

#define BLYNK_TEMPLATE_ID   "TMPL4vPmJfxOb"
#define BLYNK_TEMPLATE_NAME "Smart Irrigation"

#include "config.h"
#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_sleep.h"

// ---------------------------------------------------------------
// Pin mapping (ESP32-WROOM-32 generic dev board)
// ---------------------------------------------------------------

#define SENSOR_1_PIN 32   // ADC1_4
#define SENSOR_2_PIN 33   // ADC1_5
#define SENSOR_3_PIN 34   // ADC1_6 (input-only)
#define SENSOR_POWER_PIN 25

#define RELAY_PUMP_1_PIN 26  // IN1
#define RELAY_PUMP_2_PIN 27  // IN2
#define RELAY_PUMP_3_PIN 14  // IN3

// ---------------------------------------------------------------
// Blynk Virtual Pin mapping (fallback dashboard)
// V0-V2 = moisture, V3-V5 = manual pump buttons
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// Persistent counter across deep sleep cycles (RTC memory)
// ---------------------------------------------------------------
RTC_DATA_ATTR int wakeCount = 0;

// ---------------------------------------------------------------
// Per-plant runtime state, fetched from backend each wake-up
// ---------------------------------------------------------------
struct PlantState {
  int threshold;
  unsigned long pumpDurationMs;
  bool suspended;
  bool manualActivate;
};

PlantState plants[3]; // index 0,1,2 => plant 1,2,3

const int relayPins[3] = { RELAY_PUMP_1_PIN, RELAY_PUMP_2_PIN, RELAY_PUMP_3_PIN };
const int sensorPins[3] = { SENSOR_1_PIN, SENSOR_2_PIN, SENSOR_3_PIN };
const int defaultThresholds[3] = { MOISTURE_THRESHOLD_1, MOISTURE_THRESHOLD_2, MOISTURE_THRESHOLD_3 };

// ---------------------------------------------------------------
// Forward declarations
// ---------------------------------------------------------------
int  readMoistureSensor(int sensorPin);
void activatePump(int relayPin, unsigned long durationMs);
bool fetchPlantCommands(int plantIndex);
void postReadings(int m1, int m2, int m3, bool watered[3]);
void goToSleep();

// ---------------------------------------------------------------
// Blynk handlers — manual pump control from the Blynk app
// (kept as fallback alongside the custom dashboard)
// ---------------------------------------------------------------

BLYNK_WRITE(V3) {
  if (param.asInt() == 1) {
    Serial.println("Blynk: manual activation -- Pump 1");
    activatePump(RELAY_PUMP_1_PIN, plants[0].pumpDurationMs);
    Blynk.virtualWrite(V3, 0);
  }
}
BLYNK_WRITE(V4) {
  if (param.asInt() == 1) {
    Serial.println("Blynk: manual activation -- Pump 2");
    activatePump(RELAY_PUMP_2_PIN, plants[1].pumpDurationMs);
    Blynk.virtualWrite(V4, 0);
  }
}
BLYNK_WRITE(V5) {
  if (param.asInt() == 1) {
    Serial.println("Blynk: manual activation -- Pump 3");
    activatePump(RELAY_PUMP_3_PIN, plants[2].pumpDurationMs);
    Blynk.virtualWrite(V5, 0);
  }
}

// ---------------------------------------------------------------
// Setup
// ---------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(SENSOR_POWER_PIN, OUTPUT);
  digitalWrite(SENSOR_POWER_PIN, LOW);

  pinMode(RELAY_PUMP_1_PIN, OUTPUT);
  pinMode(RELAY_PUMP_2_PIN, OUTPUT);
  pinMode(RELAY_PUMP_3_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_1_PIN, HIGH);
  digitalWrite(RELAY_PUMP_2_PIN, HIGH);
  digitalWrite(RELAY_PUMP_3_PIN, HIGH);

  // Defaults in case backend is unreachable this cycle
  for (int i = 0; i < 3; i++) {
    plants[i].threshold = defaultThresholds[i];
    plants[i].pumpDurationMs = PUMP_DURATION_MS;
    plants[i].suspended = false;
    plants[i].manualActivate = false;
  }

  Serial.printf("\n=== Wake #%d ===\n", wakeCount);

  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(300);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWi-Fi connection failed -- skipping this cycle.");
    goToSleep();
    return; // unreachable, but keeps structure clear
  }
  Serial.println("\nWi-Fi connected.");

  Blynk.config(BLYNK_AUTH_TOKEN);
  Blynk.connect(3000); // short timeout, non-blocking failure is fine

  // 1. Always check for pending commands (manual activation, suspension)
  bool anyManual = false;
  for (int i = 0; i < 3; i++) {
    bool ok = fetchPlantCommands(i);
    if (ok && plants[i].manualActivate) {
      Serial.printf("Plant %d: manual activation requested via dashboard\n", i + 1);
      activatePump(relayPins[i], plants[i].pumpDurationMs);
      anyManual = true;
    }
  }

  // 2. Decide whether this wake-up is a full sensor cycle
  bool isFullCycle = (wakeCount % FULL_CYCLE_EVERY_N_CHECKS == 0);

  if (isFullCycle) {
    Serial.println("\n--- Full reading cycle ---");

    int moisture[3];
    moisture[0] = readMoistureSensor(SENSOR_1_PIN);
    moisture[1] = readMoistureSensor(SENSOR_2_PIN);
    moisture[2] = readMoistureSensor(SENSOR_3_PIN);

    Serial.printf("Moisture readings -> S1: %d | S2: %d | S3: %d\n",
                  moisture[0], moisture[1], moisture[2]);

    bool watered[3] = { false, false, false };

    for (int i = 0; i < 3; i++) {
      if (plants[i].suspended) {
        Serial.printf("Plant %d: suspended -- skipping\n", i + 1);
        continue;
      }
      if (moisture[i] > plants[i].threshold) {
        Serial.printf("Plant %d: DRY (%d > %d) -- watering for %lu ms\n",
                      i + 1, moisture[i], plants[i].threshold, plants[i].pumpDurationMs);
        activatePump(relayPins[i], plants[i].pumpDurationMs);
        watered[i] = true;
      } else {
        Serial.printf("Plant %d: OK (%d <= %d)\n", i + 1, moisture[i], plants[i].threshold);
      }
    }

    // Send readings + watering events to backend
    postReadings(moisture[0], moisture[1], moisture[2], watered);

    // Also mirror to Blynk fallback dashboard
    if (Blynk.connected()) {
      Blynk.virtualWrite(V0, moisture[0]);
      Blynk.virtualWrite(V1, moisture[1]);
      Blynk.virtualWrite(V2, moisture[2]);
    }
  }

  if (Blynk.connected()) {
    Blynk.run();
  }

  wakeCount++;
  goToSleep();
}

void loop() {
  // Not used -- all logic runs once per wake in setup(), then deep sleep.
}

// ---------------------------------------------------------------
// Backend communication
// ---------------------------------------------------------------

// Fetches threshold, pump duration, suspension state, and any
// pending manual activation for a given plant (0-indexed).
// Returns true on success, leaves plants[i] at defaults on failure.
bool fetchPlantCommands(int plantIndex) {
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/commands/" + String(plantIndex + 1);
  http.begin(url);
  http.setTimeout(5000);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.printf("Backend commands fetch failed for plant %d (HTTP %d)\n", plantIndex + 1, httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("Backend commands JSON parse error");
    return false;
  }

  plants[plantIndex].threshold = doc["threshold"] | defaultThresholds[plantIndex];
  plants[plantIndex].pumpDurationMs = doc["pumpDurationMs"] | (unsigned long)PUMP_DURATION_MS;
  plants[plantIndex].suspended = doc["suspended"] | false;
  plants[plantIndex].manualActivate = doc["manualActivate"] | false;

  return true;
}

// Posts the latest sensor readings and watering events to the backend.
void postReadings(int m1, int m2, int m3, bool watered[3]) {
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/readings";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<256> doc;
  doc["plant1"] = m1;
  doc["plant2"] = m2;
  doc["plant3"] = m3;

  JsonArray wateredArr = doc.createNestedArray("watered");
  for (int i = 0; i < 3; i++) {
    if (watered[i]) wateredArr.add(i + 1);
  }

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode == 200) {
    Serial.println("Readings posted to backend successfully.");
  } else {
    Serial.printf("Failed to post readings (HTTP %d)\n", httpCode);
  }
  http.end();
}

// ---------------------------------------------------------------
// Sensor reading
// ---------------------------------------------------------------

int readMoistureSensor(int sensorPin) {
  digitalWrite(SENSOR_POWER_PIN, HIGH);
  delay(10);
  int value = analogRead(sensorPin);
  digitalWrite(SENSOR_POWER_PIN, LOW);
  return value;
}

// ---------------------------------------------------------------
// Pump control
// ---------------------------------------------------------------

// Relay module is Low-Level-Trigger: LOW = pump ON, HIGH = pump OFF.
void activatePump(int relayPin, unsigned long durationMs) {
  digitalWrite(relayPin, LOW);
  delay(durationMs);
  digitalWrite(relayPin, HIGH);
}

// ---------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------

void goToSleep() {
  Serial.printf("Sleeping for %d seconds...\n", COMMAND_CHECK_INTERVAL_SECONDS);
  Serial.flush();
  esp_sleep_enable_timer_wakeup((uint64_t)COMMAND_CHECK_INTERVAL_SECONDS * 1000000ULL);
  esp_deep_sleep_start();
}
