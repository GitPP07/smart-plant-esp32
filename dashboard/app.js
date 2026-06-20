/*
  app.js
  ------------------------------------------------
  Frontend logic for the Smart Irrigation dashboard.
  Polls the backend for status/history and sends commands
  (activate pump, suspend, change duration) on user interaction.
*/

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------

const BACKEND_URL = window.location.protocol === "file:" ? "http://localhost:3000" : "";

const PLANT_NAMES = {
  "1": "Pianta 1",
  "2": "Pianta 2",
  "3": "Pianta 3"
};

// Optional pot-size tags shown next to plant names. Edit freely.
const PLANT_TAGS = {
  "1": "",
  "2": "vaso grande",
  "3": ""
};

const REFRESH_INTERVAL_MS = 15000;
const MAX_ADC_VALUE = 4095;

let currentState = null;
let activeSuspendPlant = null;

// ---------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------

async function apiGet(path) {
  const res = await fetch(BACKEND_URL + path);
  if (!res.ok) throw new Error("Request failed: " + path);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(BACKEND_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error("Request failed: " + path);
  return res.json();
}

// ---------------------------------------------------------------
// Moisture conversion
// ADC reading is inverted: higher value = drier soil.
// Convert to an intuitive 0-100% "wetness" score for display.
// ---------------------------------------------------------------

function moistureToPercent(adcValue) {
  if (adcValue === null || adcValue === undefined) return null;
  const pct = 100 - (adcValue / MAX_ADC_VALUE) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function isDry(adcValue, threshold) {
  return adcValue !== null && adcValue > threshold;
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------

function renderPlants(plants) {
  const grid = document.getElementById("plants-grid");
  grid.innerHTML = "";

  for (const id of ["1", "2", "3"]) {
    const p = plants[id];
    const pct = moistureToPercent(p.lastMoisture);
    const dry = isDry(p.lastMoisture, p.threshold);
    const tag = PLANT_TAGS[id] ? `<span class="pot-tag"> &middot; ${PLANT_TAGS[id]}</span>` : "";

    const card = document.createElement("div");
    card.className = "plant-card";
    card.innerHTML = `
      <p class="plant-name">${PLANT_NAMES[id]}${tag}</p>

      <div class="moisture-row">
        <div class="water-bar">
          <div class="water-fill ${dry ? 'dry' : ''}" style="height: ${pct === null ? 0 : pct}%"></div>
        </div>
        <div>
          <p class="moisture-value">${pct === null ? '--' : pct + '%'}</p>
          <p class="moisture-label ${dry ? 'dry' : ''}">${pct === null ? 'In attesa dati' : (dry ? 'Asciutto' : 'Umido')}</p>
        </div>
      </div>

      <div class="quantity-block">
        <div class="quantity-row">
          <span>Quantit&agrave;</span>
          <span class="value" id="duration-value-${id}">${(p.pumpDurationMs / 1000).toFixed(1)} sec</span>
        </div>
        <input type="range" min="1" max="15" step="0.5" value="${p.pumpDurationMs / 1000}" data-plant="${id}" class="duration-slider">
      </div>

      <button class="activate-btn" data-plant="${id}">Attiva pompa</button>
      <button class="suspend-toggle-btn ${p.suspended ? 'active' : ''}" data-plant="${id}">
        ${p.suspended ? 'Sospesa' : 'Sospendi'}
      </button>
    `;
    grid.appendChild(card);
  }

  attachPlantCardListeners();
}

function renderHistory(history) {
  const list = document.getElementById("history-list");

  if (!history.length) {
    list.innerHTML = '<p class="empty-state">Nessuna irrigazione registrata.</p>';
    return;
  }

  list.innerHTML = history.slice(0, 10).map(entry => {
    const date = new Date(entry.timestamp);
    const timeStr = formatRelativeTime(date);
    const typeLabel = entry.type === "automatic" ? "automatica" : "manuale";
    const durationStr = (entry.durationMs / 1000).toFixed(1) + " sec";
    return `
      <div class="history-item">
        <span class="history-left">
          <span class="drop"></span>
          ${PLANT_NAMES[entry.plantId]} &mdash; ${typeLabel} &middot; ${durationStr}
        </span>
        <span class="history-time">${timeStr}</span>
      </div>
    `;
  }).join("");
}

function formatRelativeTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Oggi, ${timeStr}`;
  if (isYesterday) return `Ieri, ${timeStr}`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) + ", " + timeStr;
}

function renderConnectionStatus(online) {
  const pill = document.getElementById("connection-status");
  const text = document.getElementById("connection-text");
  pill.className = "status-pill " + (online ? "online" : "offline");
  text.textContent = online ? "Online" : "Non raggiungibile";
}

function renderLastUpdated(plants) {
  const timestamps = Object.values(plants)
    .map(p => p.lastUpdated)
    .filter(Boolean)
    .map(t => new Date(t).getTime());

  const el = document.getElementById("last-updated");
  if (!timestamps.length) {
    el.textContent = "Nessun dato ricevuto ancora";
    return;
  }
  const mostRecent = new Date(Math.max(...timestamps));
  el.textContent = "Ultimo aggiornamento: " + formatRelativeTime(mostRecent);
}

// ---------------------------------------------------------------
// Suspend panel
// ---------------------------------------------------------------

function openSuspendPanel(plantId) {
  activeSuspendPlant = plantId;
  const panel = document.getElementById("suspend-panel");
  document.getElementById("suspend-title").textContent = `Sospensione ${PLANT_NAMES[plantId]}`;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeSuspendPanel() {
  activeSuspendPlant = null;
  document.getElementById("suspend-panel").hidden = true;
}

// ---------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------

function attachPlantCardListeners() {
  document.querySelectorAll(".activate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const plantId = btn.dataset.plant;
      btn.textContent = "Attivazione...";
      btn.disabled = true;
      try {
        await apiPost(`/api/pump/${plantId}/activate`);
        btn.textContent = "Avviata";
        setTimeout(refresh, 1000);
      } catch (e) {
        btn.textContent = "Errore";
      } finally {
        setTimeout(() => { btn.disabled = false; btn.textContent = "Attiva pompa"; }, 2000);
      }
    });
  });

  document.querySelectorAll(".suspend-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const plantId = btn.dataset.plant;
      const isSuspended = currentState.plants[plantId].suspended;
      if (isSuspended) {
        apiPost(`/api/pump/${plantId}/resume`).then(refresh);
      } else {
        openSuspendPanel(plantId);
      }
    });
  });

  document.querySelectorAll(".duration-slider").forEach(slider => {
    slider.addEventListener("input", () => {
      const plantId = slider.dataset.plant;
      document.getElementById(`duration-value-${plantId}`).textContent =
        parseFloat(slider.value).toFixed(1) + " sec";
    });
    slider.addEventListener("change", async () => {
      const plantId = slider.dataset.plant;
      const durationMs = Math.round(parseFloat(slider.value) * 1000);
      try {
        await apiPost(`/api/pump/${plantId}/duration`, { durationMs });
      } catch (e) {
        console.error("Failed to update duration", e);
      }
    });
  });
}

document.getElementById("cancel-suspend").addEventListener("click", () => {
  if (activeSuspendPlant) {
    apiPost(`/api/pump/${activeSuspendPlant}/resume`).then(() => {
      closeSuspendPanel();
      refresh();
    });
  }
});

document.querySelectorAll(".suspend-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!activeSuspendPlant) return;
    const hours = parseFloat(btn.dataset.hours);
    document.querySelectorAll(".suspend-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    try {
      await apiPost(`/api/pump/${activeSuspendPlant}/suspend`, { hours });
      setTimeout(() => {
        closeSuspendPanel();
        refresh();
      }, 400);
    } catch (e) {
      console.error("Failed to suspend", e);
    }
  });
});

// ---------------------------------------------------------------
// Main refresh loop
// ---------------------------------------------------------------

async function refresh() {
  try {
    const [statusData, historyData] = await Promise.all([
      apiGet("/api/status"),
      apiGet("/api/history?limit=10")
    ]);

    currentState = statusData;
    renderPlants(statusData.plants);
    renderHistory(historyData.history);
    renderLastUpdated(statusData.plants);
    renderConnectionStatus(true);
  } catch (e) {
    console.error("Refresh failed", e);
    renderConnectionStatus(false);
  }
}

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
