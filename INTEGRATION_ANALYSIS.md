# HerbTrace + Digital Twin Integration Analysis Document

## 1. Executive Summary

This document presents the detailed architectural analysis and non-invasive integration plan for embedding **Digital Twin** functionality into the existing **HerbTrace Blockchain Supply Chain** platform.

**Core Principles:**
- **HerbTrace Blockchain Project is the BASE / PROTECTED SYSTEM.**
- The existing smart contract (`HerbTrace.sol`), batch lifecycle (CREATE, LAB TEST, PROCESS, TRANSFER), Merkle tree anchoring, multi-oracle location verification, MongoDB database schemas, REST APIs, and frontend pages **MUST NOT be broken or altered unnecessarily**.
- Digital Twin functionality (real-time websocket updates, OSRM routing, GPS location simulation, delay analysis, interactive GIS maps) is integrated as an additive, non-invasive service layer surrounding the core blockchain backend and frontend.

---

## 2. Existing Blockchain Architecture (HerbTrace Baseline)

### 2.1 Backend (`herbtrace-backend`)
- **Technology Stack**: Node.js, Express, MongoDB (Mongoose), Ethers.js v6.
- **REST Endpoints**:
  - `/auth`: User registration, login, profile, role management, approval workflows.
  - `/batch`: Batch creation, lab test recording, batch processing (with parent lineage), custody transfer, Merkle root fetching, location verification queries.
- **Database Models (`models/`)**:
  - `User.js`: Role-based auth (Farmer, Lab, Processor, Distributor, Admin).
  - `Batch.js`: Core batch metadata, current status, owner, data hash.
  - `BatchMerkleRoot.js`: Stored Merkle trees and roots per stage.
  - `LocationVerification.js`: GPS location consensus and oracle verification records.
- **Services (`services/`)**:
  - `batchService.js`: Core business logic for state transitions and MongoDB updates.
  - `blockchainService.js`: Low-level Ethers.js contract instantiation and transaction execution.
  - `merkleService.js`: Tree construction and Merkle proof generation.
  - `multiOracleService.js`: Geofencing and oracle location verification.
  - `pinataService.js`: IPFS file storage.
  - `qrService.js`: QR code generation.

### 2.2 Smart Contract (`herbtrace-contracts`)
- **Contract**: `contracts/HerbTrace.sol` (Solidity `^0.8.0`, OpenZeppelin `AccessControl`).
- **Roles**: `FARMER_ROLE`, `LAB_ROLE`, `PROCESSOR_ROLE`, `DISTRIBUTOR_ROLE`, `DEFAULT_ADMIN_ROLE`.
- **Enums & Structs**: `Status` (Created, Tested, Processed, Transferred), `Batch`, `MerkleAnchor`, `LocationConsensus`.
- **On-Chain Events**:
  - `BatchCreated(string batchId, address farmer, bytes32 dataHash)`
  - `TestRecorded(string batchId, address lab, bytes32 dataHash)`
  - `BatchProcessed(string batchId, address processor, bytes32 dataHash)`
  - `CustodyTransferred(string batchId, address newOwner, bytes32 dataHash)`
  - `MerkleRootAnchored(string batchId, uint256 stageIndex, bytes32 merkleRoot)`
  - `LocationVerified(string batchId, uint256 stageIndex, bool verified, string location)`

### 2.3 Frontend (`herbtrace-frontend`)
- **Technology Stack**: React, Vite, React Router DOM, Lucide Icons, Tailwind / Custom CSS.
- **Pages**:
  - `Home.jsx`: Landing page & supply chain overview.
  - `Login.jsx` & `Signup.jsx`: Auth pages.
  - `Verify.jsx`: Public batch provenance and Merkle proof verification.
  - Role-specific pages: `CreateBatch.jsx` (Farmer), `LabTest.jsx` (Lab), `ProcessBatch.jsx` (Processor), `TransferCustody.jsx` (Distributor), `Admin.jsx` (Admin).

---

## 3. Existing Digital Twin Architecture (`HERBTRACE_NEW`)

### 3.1 Digital Twin Definition & Concept
The Digital Twin represents the real-time physical-to-digital reflection of herbal batches in motion across geographic facilities:
1. **State Representation**: Real-time position (`lat`, `lng`), transit leg (`legKey`), progress percentage (`progress`), transit delay status (`delayed`), and historical trajectory.
2. **Event Sync**: `blockchainSync.js` performs historical block scanning and live event listening to capture `BatchCreated`, `TestRecorded`, `BatchProcessed`, and `CustodyTransferred` events.
3. **Location Simulation & OSRM Routing**:
   - `facilityRegistry.js`: Fixed geographic coordinates for Farms, Labs, Processing Plants, and Distribution Centers.
   - `osrmService.js`: Fetches real road geometries and transit durations between facilities via Open Source Routing Machine (OSRM).
   - `locationSimulator.js`: Simulates real-time GPS waypoint streams over route geometries.
   - `delayService.js`: Evaluates threshold violations and flags transit delays.
4. **Caching & Real-Time Transport**:
   - `dbCache.js`: SQLite cache (`herbtrace_cache.db`) storing fast-access off-chain state snapshots, route geometries, and delay records without cluttering MongoDB.
   - `Socket.IO`: Emits websocket channels:
     - `state:snapshot`: Initial state broadcast upon client connection.
     - `batch:updated`: Triggered upon blockchain contract events.
     - `batch:location`: Live streaming waypoint positions.
5. **Digital Twin UI Components**:
   - `SupplyChainPipeline.jsx`: Multi-stage batch tracker cards with map triggers.
   - `SupplyChainStats.jsx`: High-level metrics breakdown (Total, Active, Delayed, Distributed).
   - `DelayTable.jsx`: Detailed breakdown of delayed transit legs.
   - `MapModal.jsx`: Leaflet interactive GIS map rendering animated batch markers along road geometries.

---

## 4. Overlapping & Conflicting Components

| Component | Baseline HerbTrace | Digital Twin (`HERBTRACE_NEW`) | Resolution / Integration Strategy |
|---|---|---|---|
| **HTTP Server (`server.js`)** | Standard Express app listening via `app.listen()` | Express wrapped in `http.createServer()` with attached `Socket.IO` instance | Upgrade `server.js` to wrap Express in HTTP server & initialize Socket.IO. REST routes stay untouched. |
| **Dependencies (`package.json`)** | Standard REST & Mongoose dependencies | Adds `socket.io`, `better-sqlite3` / `sqlite3`, `socket.io-client`, `leaflet`, `react-leaflet` | Carefully add required dependencies to backend and frontend without upgrading existing packages. |
| **Database** | MongoDB (Strict schema for batches & users) | SQLite cache for high-frequency location & route data | Retain MongoDB as primary store. Use local SQLite file (`herbtrace_cache.db`) strictly for Digital Twin caching layer. |
| **Identifiers** | `batchId` (String) | `batchId` (String) | 100% Shared identifier match! Digital Twin maps 1:1 to blockchain `batchId`. No duplicate IDs created. |
| **Smart Contracts** | `HerbTrace.sol` | Listens to `HerbTrace.sol` events | NO SMART CONTRACT MODIFICATION REQUIRED. Baseline smart contract remains 100% untouched. |

---

## 5. Proposed Integration Architecture

```
                                  +-----------------------+
                                  |   HerbTrace.sol       |
                                  |  (Smart Contract)     |
                                  +-----------+-----------+
                                              |
                                      On-Chain Events
                                              |
                                              v
+-----------------------+         +-----------+-----------+         +-----------------------+
|  HerbTrace MongoDB    | <====== |  HerbTrace Backend    | ======> | SQLite Cache          |
|  (User & Batch DB)    | REST    |  (Express + Socket.IO)|         | (herbtrace_cache.db)  |
+-----------------------+         +-----------+-----------+         +-----------------------+
                                              |
                                      Websocket Streams
                                   (snapshot/update/location)
                                              |
                                              v
                                  +-----------+-----------+
                                  |  HerbTrace Frontend   |
                                  |  (React + Leaflet GIS)|
                                  +-----------------------+
```

---

## 6. Detailed File Plan

### 6.1 Files That Should NOT Be Modified
- `herbtrace-contracts/contracts/HerbTrace.sol` (Smart contract strictly protected)
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
- `herbtrace-frontend/src/pages/CreateBatch.jsx`
- `herbtrace-frontend/src/pages/LabTest.jsx`
- `herbtrace-frontend/src/pages/ProcessBatch.jsx`
- `herbtrace-frontend/src/pages/TransferCustody.jsx`
- `herbtrace-frontend/src/pages/Verify.jsx`

### 6.2 Files That Need Modification
1. **`herbtrace-backend/package.json`**: Add `socket.io` and `sqlite3` dependencies.
2. **`herbtrace-backend/server.js`**: Wrap Express app in HTTP server, attach Socket.IO, initialize SQLite cache, OSRM route pre-warming, historical blockchain sync, and live event listeners.
3. **`herbtrace-frontend/package.json`**: Add `socket.io-client`, `leaflet`, `react-leaflet`, `lucide-react`.
4. **`herbtrace-frontend/src/App.jsx`**: Add navigation link and route `/digital-twin` for the new Digital Twin Dashboard page without altering existing routes.

### 6.3 New Files To Be Created
1. **Backend Services (`herbtrace-backend/services/`)**:
   - `blockchainSync.js`: Syncs historical and live contract events with Socket.IO emitting.
   - `dbCache.js`: SQLite cache manager for Digital Twin state.
   - `delayService.js`: Delay calculation service.
   - `facilityRegistry.js`: Facility coordinate registry.
   - `locationSimulator.js`: Waypoint GPS simulator.
   - `osrmService.js`: OSRM routing client.
2. **Frontend Page & Components (`herbtrace-frontend/src/`)**:
   - `pages/DigitalTwinDashboard.jsx`: Digital Twin monitoring page.
   - `components/SupplyChainPipeline.jsx`: Interactive batch pipeline component.
   - `components/SupplyChainStats.jsx`: Analytics metric cards.
   - `components/DelayTable.jsx`: Transit delay tracker table.
   - `components/MapModal.jsx`: Leaflet GIS route map modal.
   - `components/DigitalTwin.css`: Styling dedicated to Digital Twin UI.

---

## 7. Migration, Environment Variables & Potential Risks

### 7.1 Environment Variables (`.env`)
No existing environment variables will be overwritten. The following optional variables will be documented in `.env.example`:
- `FRONTEND_URL`: URL of frontend (default `http://localhost:5173`)
- `OSRM_SERVER_URL`: OSRM routing server endpoint (defaults to public demo OSRM if not provided)
- `SQLITE_DB_PATH`: Path for local SQLite cache database (defaults to `./herbtrace_cache.db`)

### 7.2 Risk Mitigation Strategy
- **Port Conflicts**: HTTP server and Socket.IO share the single port (`PORT 5000`), eliminating cross-port firewall issues.
- **MongoDB Resilience**: If MongoDB is offline, the Digital Twin socket layer remains startup-resilient.
- **Blockchain Connectivity**: `blockchainSync.js` degrades gracefully if RPC node is temporarily unreachable.
