/*
  server.js
  ------------------------------------------------
  Backend for the Smart Plant Irrigation System.

  Acts as the bridge between the ESP32 (which posts sensor
  readings and polls for commands) and the web dashboard
  (which displays status/history and sends commands).

  Storage: simple JSON file (data/state.json) under backend directory.
*/

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Paths and constants
const STATE_FILE = path.join(__dirname, 'data', 'state.json');
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');
const MAX_HISTORY_ENTRIES = 200;

// Default state if file is missing or corrupted
const DEFAULT_STATE = {
  plants: {
    "1": { lastMoisture: null, threshold: 2500, pumpDurationMs: 3000, suspendedUntil: null, lastUpdated: null },
    "2": { lastMoisture: null, threshold: 2400, pumpDurationMs: 8000, suspendedUntil: null, lastUpdated: null },
    "3": { lastMoisture: null, threshold: 2400, pumpDurationMs: 3000, suspendedUntil: null, lastUpdated: null }
  },
  manualActivations: { "1": false, "2": false, "3": false },
  history: []
};

// ---------------------------------------------------------------
// State helpers (robust with error recovery)
// ---------------------------------------------------------------

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      writeState(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading/parsing state.json, falling back to default:", err);
    return DEFAULT_STATE;
  }
}

function writeState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Error writing to state.json:", err);
  }
}

function isValidPlantId(id) {
  return ['1', '2', '3'].includes(id);
}

// Wrapper for safe exception-free routing
const safeRoute = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    console.error("Caught error in route:", err);
    res.status(500).json({ error: 'internal server error' });
  }
};

// ---------------------------------------------------------------
// Static Files serving (Dashboard)
// ---------------------------------------------------------------
app.use(express.static(DASHBOARD_DIR));

// ---------------------------------------------------------------
// ESP32 -> Backend: post sensor readings
// ---------------------------------------------------------------

app.post('/api/readings', safeRoute(async (req, res) => {
  const { plant1, plant2, plant3, watered } = req.body || {};
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
}));

// ---------------------------------------------------------------
// ESP32 -> Backend: poll commands for a specific plant
// ---------------------------------------------------------------

app.get('/api/commands/:plantId', safeRoute(async (req, res) => {
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
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: current status of all plants
// ---------------------------------------------------------------

app.get('/api/status', safeRoute(async (req, res) => {
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
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: watering history
// ---------------------------------------------------------------

app.get('/api/history', safeRoute(async (req, res) => {
  const state = readState();
  const limit = parseInt(req.query.limit) || 20;
  res.json({ history: state.history.slice(0, limit) });
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: trigger a manual pump activation
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/activate', safeRoute(async (req, res) => {
  const { plantId } = req.params;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  const state = readState();
  state.manualActivations[plantId] = true;
  writeState(state);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: suspend automatic watering for X hours
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/suspend', safeRoute(async (req, res) => {
  const { plantId } = req.params;
  const { hours } = req.body || {};
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
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: cancel a suspension
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/resume', safeRoute(async (req, res) => {
  const { plantId } = req.params;
  if (!isValidPlantId(plantId)) {
    return res.status(400).json({ error: 'invalid plant id' });
  }
  const state = readState();
  state.plants[plantId].suspendedUntil = null;
  writeState(state);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------
// Dashboard -> Backend: update pump duration for a plant
// ---------------------------------------------------------------

app.post('/api/pump/:plantId/duration', safeRoute(async (req, res) => {
  const { plantId } = req.params;
  const { durationMs } = req.body || {};
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
}));

// ---------------------------------------------------------------
// Health check (relocated to /api/health)
// ---------------------------------------------------------------

app.get('/api/health', safeRoute(async (req, res) => {
  res.json({ status: 'Smart Irrigation backend running' });
}));

// Fallback for non-API client routes to serve the dashboard SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------
// Start server
// ---------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Smart Irrigation backend listening on port ${PORT}`);
});
