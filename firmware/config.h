/*
  config.h
  ------------------------------------------------
  Configuration placeholder for Wi-Fi credentials,
  cloud endpoint, and irrigation thresholds.

  IMPORTANT: this file should be added to .gitignore
  and never committed with real credentials.
  Keep a "config.example.h" with placeholder values
  in the repo so others can see the expected format.
*/

#ifndef CONFIG_H
#define CONFIG_H

// ---------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------
#define WIFI_SSID     "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// ---------------------------------------------------------------
// Cloud / dashboard endpoint (Phase 4 - TBD)
// ---------------------------------------------------------------
#define CLOUD_API_URL "https://example.com/api/irrigation"
#define CLOUD_API_KEY "your-api-key"

// ---------------------------------------------------------------
// Moisture thresholds (raw ADC values, 0-4095 on ESP32)
// Lower value = wetter soil (typical for resistive sensors).
// Calibrate these after testing each sensor in dry/wet soil.
// ---------------------------------------------------------------
#define MOISTURE_THRESHOLD_1 2200
#define MOISTURE_THRESHOLD_2 2200
#define MOISTURE_THRESHOLD_3 2200

// ---------------------------------------------------------------
// Pump activation duration (milliseconds)
// ---------------------------------------------------------------
#define PUMP_DURATION_MS 3000

// ---------------------------------------------------------------
// Deep sleep interval between reading cycles (seconds)
// ---------------------------------------------------------------
#define SLEEP_INTERVAL_SECONDS 1800 // 30 minutes

#endif
