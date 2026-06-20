/*
  server.js
  ------------------------------------------------
  Backend for the Smart Plant Irrigation System.

  Acts as the bridge between the ESP32 (which posts sensor
  readings and polls for commands) and the web dashboard
  (which displays status/history and sends commands).

  Storage: simple JSON file (data/state.json). No database
  needed for this scale of project.
*/

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const STATE_FILE = path.join(__dirname, 'data', 'state.json');
const MAX_HISTORY_ENTRIES = 200;

// ---------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------

function readState() {
  const raw = fs.readFileSync(STATE_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isValidPlantId(id) {
  return ['1', '2', '3'].includes(id);
}

// ---------------------------------------------------------------
// ESP32 -> Backend: post sensor readings
// Body: { plant1: int, plant2: int, plant3: int, watered: [1,2] }
// "watered" is an optional array of plant IDs that were just
// auto-watered during this cycle (for history logging).
// ---------------------------------------------------------------

app.post('/api/readings', (req, res) => {
  const { plant1, plant2, plant3, watered } = req.body;
  const state = readState();
  const now = new Date().toISOString();

  const readings = { '1': plant1, '2': plant2, '3': plant3 };

  for (const id of ['1', '2', '3']) {
    if (typeof readings[id] === 'number') {
      state.plants[id].lastMoisture = readings[id];
      state.plants[id].lastUpdated = now;
    }
  }

  if (Array.isArray(watered)) {
    for (const id of watered) {
      const plantId = String(id);
      if (isValidPlantId(plantId)) {
        state.history.unshift({
          plantId,
          type: 'automatic',
          durationMs: state.plants[plantId].pumpDurationMs,
          timestamp: now
        });
      }
    }
  }

  state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
  writeState(state);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// ESP32 -> Backend: poll commands for a specific plant
// Returns threshold, pump duration, and whether suspended.
// If a manual activation was requested from the dashboard,
// it is returned once and then cleared (consumed).
// ---------------------------------------------------------------

app.get('/api/commands/:plantId', (req, res) => {
  const { plantId } = req.params;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }

  const state = readState();
  const plant = state.plants[plantId];
  const now = Date.now();

  const isSuspended = plant.suspendedUntil !== null && new Date(plant.suspendedUntil).getTime() > now;

  const manualActivate = state.manualActivations[plantId];
  if (manualActivate) {
    state.manualActivations[plantId] = false;
    state.history.unshift({
      plantId,
      type: 'manual',
      durationMs: plant.pumpDurationMs,
      timestamp: new Date().toISOString()
    });
    state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
    writeState(state);
  }

  res.json({
    threshold: plant.threshold,
    pumpDurationMs: plant.pumpDurationMs,
    suspended: isSuspended,
    manualActivate: manualActivate
  });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: current status of all plants
// ---------------------------------------------------------------

app.get('/api/status', (req, res) => {
  const state = readState();
  const now = Date.now();

  const plants = {};
  for (const id of ['1', '2', '3']) {
    const p = state.plants[id];
    const isSuspended = p.suspendedUntil !== null && new Date(p.suspendedUntil).getTime() > now;
    plants[id] = {
      lastMoisture: p.lastMoisture,
      threshold: p.threshold,
      pumpDurationMs: p.pumpDurationMs,
      suspended: isSuspended,
      suspendedUntil: isSuspended ? p.suspendedUntil : null,
      lastUpdated: p.lastUpdated
    };
  }

  res.json({ plants });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: watering history
// ---------------------------------------------------------------

app.get('/api/history', (req, res) => {
  const state = readState();
  const limit = parseInt(req.query.limit) || 20;
  res.json({ history: state.history.slice(0, limit) });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: trigger a manual pump activation
// The ESP32 will pick this up on its next poll cycle.
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/activate', (req, res) => {
  const { plantId } = req.params;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  const state = readState();
  state.manualActivations[plantId] = true;
  writeState(state);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: suspend automatic watering for X hours
// Body: { hours: number }
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/suspend', (req, res) => {
  const { plantId } = req.params;
  const { hours } = req.body;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  if (typeof hours !== 'number' || hours <= 0) {
    return res.status(400).json({ error: 'invalid hours' });
  }

  const state = readState();
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  state.plants[plantId].suspendedUntil = until;
  writeState(state);
  res.json({ ok: true, suspendedUntil: until });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: cancel a suspension
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/resume', (req, res) => {
  const { plantId } = req.params;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  const state = readState();
  state.plants[plantId].suspendedUntil = null;
  writeState(state);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Dashboard -> Backend: update pump duration for a plant
// Body: { durationMs: number }
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/duration', (req, res) => {
  const { plantId } = req.params;
  const { durationMs } = req.body;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  if (typeof durationMs !== 'number' || durationMs < 500 || durationMs > 30000) {
    return res.status(400).json({ error: 'duration must be between 500 and 30000 ms' });
  }

  const state = readState();
  state.plants[plantId].pumpDurationMs = durationMs;
  writeState(state);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Health check (useful for Render / uptime monitoring)
// ---------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({ status: 'Smart Irrigation backend running' });
});

// ---------------------------------------------------------------
// Start server
// ---------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Smart Irrigation backend listening on port ${PORT}`);
});
