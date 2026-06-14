# 🌿 Smart Plant Irrigation System

> An ESP32-based IoT system that monitors soil moisture for 3 plants and automates watering — battery-powered, Wi-Fi connected, and cloud-enabled.

![Status](https://img.shields.io/badge/status-in%20progress-yellow)
![Platform](https://img.shields.io/badge/platform-ESP32-blue)
![Power](https://img.shields.io/badge/power-4×AA%20battery-green)
![IDE](https://img.shields.io/badge/IDE-Arduino-teal)

---

## 📌 Overview

This project automates the irrigation of 3 houseplants using an ESP32 microcontroller. Resistive soil moisture sensors detect when the soil is dry and trigger small submersible pumps via a relay module. All sensor data is transmitted over Wi-Fi to a cloud dashboard, which also allows manual pump control from anywhere.

The system is designed to run entirely on AA batteries, leveraging the ESP32's **Deep Sleep** mode to minimize power consumption between readings.

---

## 🎯 Project Goals

| Goal | Description |
|------|-------------|
| **Monitoring** | Independently read soil moisture for 3 plants |
| **Automation** | Activate pumps only when soil is dry — no water waste |
| **Remote control** | Send data to a cloud dashboard, receive manual commands via Wi-Fi |
| **Energy efficiency** | Maximize battery life using ESP32 Deep Sleep (~10 µA idle) |

---

## 🔩 Hardware

### Components checklist

#### Microcontroller
- [X] `1×` ESP32 NodeMCU Development Board

#### Sensors & Actuators
- [X] `5×` Resistive soil moisture sensors — AZ-Delivery fork type *(3 in use + 2 spare)*
- [X] `3×` 5V brushless submersible mini pumps (DC 3V–6V)
- [X] `1×` 4-channel 5V optoisolated relay module
- [X] `1×` Flexible PVC tube, 3m *(cut into 3 sections — diameter must fit pump nozzle)*

#### Power Supply
- [X] `1×` 4×AA battery holder with ON/OFF switch *(nominal output: 6V)*
- [X] `4×` AA batteries *(disposable or rechargeable)*

#### Tools & Wiring
- [X] Soldering station + solder wire
- [X] Low-gauge electrical wire *(e.g. telephone twisted pair or Ethernet cable conductors)*
- [X] USB cable for firmware flashing *(Micro-USB or USB-C depending on ESP32 board)*

---

## 🔌 Wiring Diagram (Logical Schema)

```
          +----------------------+
          |  4×AA Battery Pack   |  ===> ON/OFF Switch
          |        (~6V)         |
          +-----------+----------+
                      |
       +--------------+--------------+
       | (+) 6V                      | (-) GND
       v                             v
 +------------------+       +------------------+
 |  ESP32 (VIN pin) |       |   ESP32 (GND)    |
 +--------+---------+       +--------+---------+
          |                          |
          +--> Relay module (VCC)    +--> Relay (GND)
          +--> Sensor VCC (via GPIO) +--> Sensor (GND)
                                     +--> Pumps (negative terminal)

[Control & Data signals]
  ESP32 (GPIO Output) ====> Relay inputs (IN1, IN2, IN3)
  ESP32 (ADC Input)   <==== Sensor analog outputs (AO1, AO2, AO3)
```

---

## ⚙️ Key Technical Decisions

### 1. Software-driven galvanic corrosion prevention
Moisture sensors are not powered continuously. A GPIO pin is set `HIGH` only for the few milliseconds needed to take an ADC reading, then immediately pulled `LOW`. This minimises electrolysis on the electrodes buried in damp soil, significantly extending sensor lifespan.

### 2. Power decoupling via relay module
Pumps draw far more current than the ESP32 GPIO pins can safely supply (max ~40 mA per pin). The relay module acts as an electrically isolated switch: the ESP32 drives only the relay's logic stage, while pump current is drawn directly from the battery pack.

### 3. Deep Sleep for battery efficiency
Between reading cycles, the ESP32 and its Wi-Fi modem enter deep sleep, dropping consumption to approximately **10 µA**. This dramatically extends the runtime on a set of AA batteries compared to a continuously active system.

---

## 🗺️ Development Roadmap

- [X] **Phase 1 — Hardware validation**
  Connect ESP32 to PC, flash a Blink sketch to verify the board and Arduino IDE environment are working correctly.

- [ ] **Phase 2 — Prototype assembly**
  Solder wires to sensors and relay module, wire up power lines, verify all physical connections.

- [ ] **Phase 3 — Local firmware development**
  Write firmware for sequential sensor reading, pump activation thresholds, and deep sleep cycles.

- [ ] **Phase 4 — Cloud integration & IoT dashboard**
  Configure Wi-Fi stack, transmit data to a remote database, implement bidirectional control logic and web UI.

---

## 📁 Repository Structure

```
smart-plant-esp32/
├── README.md               ← you are here
├── firmware/
│   ├── main.ino            ← main Arduino sketch
│   └── config.h            ← Wi-Fi credentials & thresholds (gitignored)
├── hardware/
│   └── wiring_diagram.png  ← physical wiring schema
└── docs/
    └── notes.md            ← build log & progress notes
```

---

## 📓 Build Log

| Date | Update |
|------|--------|
| 4/06/2026| Project started |
| 9/06/2026| Collected all parts |
| 10/06/2026| Connected the first parts|
| 14/06/2026| Added folders: firmware, hardware, docs|

*(Update this table as the project progresses)*

---

## 🛠️ Tech Stack

- **Microcontroller**: ESP32 (Espressif)
- **IDE**: Arduino IDE
- **Language**: C++ (Arduino framework)
- **Cloud / Dashboard**: *TBD — candidates: Blynk, Home Assistant, custom Node.js*
- **Connectivity**: Wi-Fi 802.11 b/g/n (built-in on ESP32)

---

## 👤 Author

**[GitPP07]**
Student project — part of my e-portfolio.
Feel free to open an issue or reach out if you have questions or suggestions.

---

*This project is a work in progress. Documentation and code will be updated as each phase is completed.*
