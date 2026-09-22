# HerbTrace + Digital Twin Integration Changelog

## 1. Summary of Changes

Digital Twin real-time physical observation, OSRM transit leg routing, software GPS waypoint simulation, delay monitoring, and Leaflet interactive GIS mapping were integrated into HerbTrace as a **purely additive observation layer**.

---

## 2. File Inventory

### 2.1 Files Created (Backend)
- `herbtrace-backend/services/digitalTwinBootstrap.js`: Non-blocking bootstrap manager initializing SQLite, OSRM pre-warming, historical sync, and live listeners.
- `herbtrace-backend/services/dbCache.js`: Fast off-chain SQLite database manager (`herbtrace_cache.db`) for storing transient route geometries, leg states, and block timestamps.
- `herbtrace-backend/services/facilityRegistry.js`: Geographical coordinates of supply chain facilities (Farms, Labs, Processing Plants, Distribution Hubs).
- `herbtrace-backend/services/osrmService.js`: OSRM routing client with fallback haversine distance calculation and local caching.
- `herbtrace-backend/services/delayService.js`: Dynamic per-leg delay detection and buffer threshold evaluation.
- `herbtrace-backend/services/locationSimulator.js`: Software GPS waypoint simulator emitting batch coordinates over OSRM polyline routes.
- `herbtrace-backend/services/blockchainSync.js`: Read-only historical block scanner and live listener for HerbTrace smart contract events.

### 2.2 Files Created (Frontend)
- `herbtrace-frontend/src/pages/DigitalTwinDashboard.jsx`: Digital Twin monitoring page.
- `herbtrace-frontend/src/components/SupplyChainPipeline.jsx`: Interactive batch stage timeline cards with map triggers.
- `herbtrace-frontend/src/components/SupplyChainStats.jsx`: Analytics metric cards.
- `herbtrace-frontend/src/components/DelayTable.jsx`: Transit leg delay tracker table.
- `herbtrace-frontend/src/components/MapModal.jsx`: Leaflet GIS route map modal with animated vehicle markers.
- `herbtrace-frontend/src/components/DigitalTwin.css`: Styling for Digital Twin visual elements.

### 2.3 Files Modified
- `herbtrace-backend/package.json`: Added `socket.io` (`^4.8.3`) and `better-sqlite3` (`^13.0.3`).
- `herbtrace-backend/server.js`: Wrapped Express in HTTP server (`http.createServer`), mounted Socket.IO, and triggered isolated `digitalTwinBootstrap`.
- `herbtrace-frontend/package.json`: Added `socket.io-client` (`^4.8.3`), `leaflet` (`^1.9.4`), `react-leaflet` (`^5.0.0`), and `recharts` (`^3.10.1`).
- `herbtrace-frontend/src/App.jsx`: Added "Digital Twin" navigation link and registered route `/digital-twin`.

### 2.4 Files Intentionally Left Untouched
- `herbtrace-contracts/contracts/HerbTrace.sol` (Protected smart contract)
- `herbtrace-contracts/hardhat.config.js`
- `herbtrace-backend/controllers/authController.js`
- `herbtrace-backend/controllers/batchController.js`
- `herbtrace-backend/models/User.js`
- `herbtrace-backend/models/Batch.js`
- `herbtrace-backend/models/BatchMerkleRoot.js`
- `herbtrace-backend/models/LocationVerification.js`
- `herbtrace-backend/routes/authRoutes.js`
- `herbtrace-backend/routes/batchRoutes.js`
- `herbtrace-backend/services/batchService.js`
- `herbtrace-backend/services/blockchainService.js`
- `herbtrace-backend/services/merkleService.js`
- `herbtrace-backend/services/multiOracleService.js`
- `herbtrace-backend/services/pinataService.js`
- `herbtrace-backend/services/qrService.js`
- `herbtrace-frontend/src/pages/Home.jsx`
- `herbtrace-frontend/src/pages/Login.jsx`
- `herbtrace-frontend/src/pages/Signup.jsx`
- `herbtrace-frontend/src/pages/PendingApproval.jsx`
- `herbtrace-frontend/src/pages/Verify.jsx`
- `herbtrace-frontend/src/pages/CreateBatch.jsx`
- `herbtrace-frontend/src/pages/LabTest.jsx`
- `herbtrace-frontend/src/pages/ProcessBatch.jsx`
- `herbtrace-frontend/src/pages/TransferCustody.jsx`
- `herbtrace-frontend/src/pages/Admin.jsx`
- `herbtrace-frontend/src/pages/Profile.jsx`

---

## 3. Database & API Changes

- **MongoDB Schema Modifications**: NONE (0 changes).
- **SQLite Database Added**: `herbtrace_cache.db` created for Digital Twin off-chain caching.
- **REST API Endpoint Modifications**: NONE (All existing REST endpoints remain 100% behaviorally compatible).
- **Websocket Events Added**:
  - `state:snapshot`: Initial state broadcast on client connection.
  - `batch:updated`: Broadcast upon smart contract lifecycle events.
  - `batch:location`: Live streaming waypoint positions for map animation.
- **Blockchain Files Modified**: NONE.
- **Existing Blockchain Logic Modified**: **NONE**.
