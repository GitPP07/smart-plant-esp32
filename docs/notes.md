# Build Log & Progress Notes

## Repository Structure Restructuring (20/06/2026)
- Created `backend/` and `dashboard/` directories to separate concern areas.
- Moved and configured Express REST API backend files in `backend/`:
  - Moved `server.js` and `package.json`.
  - Created `backend/data/state.json` to properly persist plant state.
- Moved and configured static dashboard files in `dashboard/`:
  - Moved `index.html`, `style.css`, and `app.js`.
  - Updated `app.js` to dynamically point `BACKEND_URL` to `localhost:3000` when running locally, and Render URL when deployed.
- Moved visual reference mockup `smart_irrigation_dashboard_v3.html` to `docs/`.

## Progress Notes
- **Phase 1 (Hardware Validation)**: Complete.
- **Phase 2 (Prototype Assembly)**: Complete.
- **Phase 3 (Local Firmware Development)**: Complete.
- **Phase 4 (Cloud Integration & IoT Dashboard)**: Backend restructured and prepared; dynamic API routing verified.
