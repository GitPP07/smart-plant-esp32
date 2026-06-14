/*
  Smart Plant Irrigation System — ESP32-WROOM-32
  ------------------------------------------------
  Main firmware sketch.

  Status: Phase 2 — prototype assembly / early firmware skeleton.
  This file defines pin mapping, basic setup, and placeholder
  functions for sensor reading and pump control. Logic will be
  filled in during Phase 3.
*/

#include "config.h"

// ---------------------------------------------------------------
// Pin mapping (ESP32-WROOM-32 generic dev board)
// ---------------------------------------------------------------

// Moisture sensors (analog inputs, ADC1 channels)
#define SENSOR_1_PIN 32   // ADC1_4
#define SENSOR_2_PIN 33   // ADC1_5
#define SENSOR_3_PIN 34   // ADC1_6 (input-only)

// Shared digital pin to power the sensors only during reading
// (reduces galvanic corrosion of the electrodes)
#define SENSOR_POWER_PIN 25

// Relay module channels (drive pumps)
#define RELAY_PUMP_1_PIN 26  // IN1
#define RELAY_PUMP_2_PIN 27  // IN2
#define RELAY_PUMP_3_PIN 14  // IN3

// ---------------------------------------------------------------
// Setup
// ---------------------------------------------------------------

void setup() {
  Serial.begin(115200);

  // Sensor power switch
  pinMode(SENSOR_POWER_PIN, OUTPUT);
  digitalWrite(SENSOR_POWER_PIN, LOW);

  // Relay outputs (LOW = pumps off, assuming active-HIGH relay module)
  pinMode(RELAY_PUMP_1_PIN, OUTPUT);
  pinMode(RELAY_PUMP_2_PIN, OUTPUT);
  pinMode(RELAY_PUMP_3_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_1_PIN, LOW);
  digitalWrite(RELAY_PUMP_2_PIN, LOW);
  digitalWrite(RELAY_PUMP_3_PIN, LOW);

  // TODO: connect to Wi-Fi (see config.h for credentials)
  // TODO: initialize cloud/dashboard connection (Phase 4)

  Serial.println("Smart Plant Irrigation System - boot OK");
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------

void loop() {
  int moisture1 = readMoistureSensor(SENSOR_1_PIN);
  int moisture2 = readMoistureSensor(SENSOR_2_PIN);
  int moisture3 = readMoistureSensor(SENSOR_3_PIN);

  Serial.printf("Moisture readings -> P1: %d | P2: %d | P3: %d\n",
                 moisture1, moisture2, moisture3);

  // TODO: compare readings against MOISTURE_THRESHOLD (config.h)
  // TODO: activate corresponding pump via activatePump() if soil is dry
  // TODO: send readings to cloud dashboard (Phase 4)
  // TODO: enter deep sleep for SLEEP_INTERVAL_SECONDS (Phase 3)

  delay(2000); // temporary delay, will be replaced by deep sleep
}

// ---------------------------------------------------------------
// Sensor reading
// ---------------------------------------------------------------

// Reads a moisture sensor while minimizing electrode exposure time.
// Powers the sensor on, takes the reading, then powers it off again.
int readMoistureSensor(int sensorPin) {
  digitalWrite(SENSOR_POWER_PIN, HIGH);
  delay(10); // allow sensor to stabilize
  int value = analogRead(sensorPin);
  digitalWrite(SENSOR_POWER_PIN, LOW);
  return value;
}

// ---------------------------------------------------------------
// Pump control
// ---------------------------------------------------------------

// Activates a pump for a given duration (milliseconds).
// relayPin: one of RELAY_PUMP_1_PIN / RELAY_PUMP_2_PIN / RELAY_PUMP_3_PIN
void activatePump(int relayPin, unsigned long durationMs) {
  digitalWrite(relayPin, HIGH);
  delay(durationMs);
  digitalWrite(relayPin, LOW);
}
