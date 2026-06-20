/*
  config.h
  ------------------------------------------------
  Configuration for Wi-Fi credentials, Blynk auth token,
  custom backend URL, and irrigation thresholds.

  IMPORTANT: this file is listed in .gitignore and must
  NEVER be committed with real credentials.
  Keep a "config.example.h" with placeholder values
  in the repo so others can see the expected format.
*/

#ifndef CONFIG_H
#define CONFIG_H

// ---------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------
#define WIFI_SSID     "TP-Link_11A3"
#define WIFI_PASSWORD "35048138"

// ---------------------------------------------------------------
// Blynk authentication token (kept as a fallback dashboard)
// ---------------------------------------------------------------
#define BLYNK_AUTH_TOKEN "L4-Cxvy0A0Ul7JVyb2XXVmyK8Q3j6uPE"

// ---------------------------------------------------------------
// Custom backend URL (Render deployment)
// Replace with your actual Render URL once deployed, e.g.:
// "https://smart-irrigation-backend.onrender.com"
// ---------------------------------------------------------------
#define BACKEND_URL "https://your-app-name.onrender.com"

// ---------------------------------------------------------------
// Moisture thresholds (raw ADC values, 0-4095 on ESP32)
// Calibrated on actual hardware:
//   Dry (in air): ~4095 for all sensors
//   Wet (in water): S1 ~1050 | S2 ~800 | S3 ~700
// Threshold set midway between dry and wet for each sensor.
// Pump activates when reading is ABOVE threshold (soil is dry).
// These are DEFAULTS - the backend can override them at runtime,
// but they're used as a fallback if the backend is unreachable.
// ---------------------------------------------------------------
#define MOISTURE_THRESHOLD_1 2500
#define MOISTURE_THRESHOLD_2 2400
#define MOISTURE_THRESHOLD_3 2400

// ---------------------------------------------------------------
// Default pump activation duration (milliseconds)
// Overridden per-plant by the backend once configured there.
// ---------------------------------------------------------------
#define PUMP_DURATION_MS 3000

// ---------------------------------------------------------------
// Timing
// ---------------------------------------------------------------
// How often the ESP32 wakes briefly to check for pending commands
// (manual activation, suspension) from the dashboard.
#define COMMAND_CHECK_INTERVAL_SECONDS 90

// How many command-check cycles before running a full sensor +
// watering cycle. 80 * 90s = 7200s = 2 hours.
#define FULL_CYCLE_EVERY_N_CHECKS 80

#endif
