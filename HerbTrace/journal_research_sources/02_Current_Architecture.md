# 02. Current Architecture

This document details the architecture of the HerbTrace project strictly based on the current implementation.

## Frontend Technologies
- **Framework:** React using Vite build tool (`vite.config.js`).
- **Pages/Routing:** Distinct pages for roles (`CreateBatch.jsx`, `LabTest.jsx`, `ProcessBatch.jsx`, `TransferCustody.jsx`, `Verify.jsx`, `Admin.jsx`).
- **Components:** Reusable UI elements (`GPSBar.jsx`, `StatusPill.jsx`, `ErrorCard.jsx`).
- **Communication:** Uses standard HTTP (REST) calls to the backend.

## Backend Technologies
- **Runtime:** Node.js.
- **Framework:** Express.js (`server.js`).
- **Authentication:** JWT (JSON Web Tokens) based (inferred from `authRoutes.js` and typical setups).
- **Structure:** MVC-like (Models, Controllers, Routes, Services).

## Database Technology
- **Database:** MongoDB.
- **ODM:** Mongoose (`models/Batch.js`, `models/BatchMerkleRoot.js`, `models/LocationVerification.js`).

## Blockchain Platform/Network
- **Environment:** Ethereum-compatible networks.
- **Configured Environments:** 
  - **Local/Development:** Hardhat local network (used in tests).
  - **Testnet:** Sepolia (configured in `hardhat.config.js` via `SEPOLIA_RPC_URL`).
  - **RPC Provider Configuration:** Uses `ALCHEMY_RPC_URL` in backend `.env` (seen in `blockchainService.js`).

## Smart-Contract Technology
- **Language:** Solidity `^0.8.0` (compiled with `0.8.27`).
- **Libraries:** OpenZeppelin Contracts (`@openzeppelin/contracts/access/AccessControl.sol`).
- **Development Environment:** Hardhat (`hardhat.config.js`).

## APIs
- **Backend API:** RESTful endpoints mounted at `/auth` and `/batch` (`server.js`).
- **Endpoints:** `createBatch`, `labTest`, `process`, `transfer`, `verify`, `getMerkleProof`, `getLocationVerification`.

## External Services
- **IPFS:** Used for image/document uploads (via Pinata, seen in `uploadDirect` in `batchController.js`).

## Oracle Services
- **Multi-Oracle Location Verification:** The backend aggregates location data from multiple providers (Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage) as defined in `LocationVerification.js` schema to form a consensus.

## Merkle-Tree Implementation
- **Off-Chain Tree Generation:** Handled by `merkleService.js` using Node's native `crypto` (SHA-256).
- **Structure:** 4 leaves corresponding to the 4 lifecycle stages (Create, Test, Process, Transfer).
- **On-Chain Anchoring:** The final root is anchored to the smart contract via `anchorMerkleRoot`.
- **Proof Storage:** Stored in MongoDB `BatchMerkleRoot` collection.

## Authentication/Authorization
- **On-Chain:** Role-based access control (`FARMER_ROLE`, `LAB_ROLE`, `PROCESSOR_ROLE`, `DISTRIBUTOR_ROLE`, `DEFAULT_ADMIN_ROLE`).
- **Off-Chain:** Middleware in the backend, checking JWTs and user roles.

## Storage Mechanisms
- **Off-Chain Data:** Comprehensive JSON metadata and proofs in MongoDB.
- **On-Chain Data:** Hashes (`dataHash`), `merkleRoot`, boolean flags (`verified`), and role assignments in `HerbTrace.sol`.
- **Decentralized Storage:** Images and files on IPFS (via Pinata).

## Communication Flow

```text
Frontend (React/Vite)
       ↓ (HTTP REST / JSON)
Backend/API (Node.js/Express)
       ↓ 
   (Internal Logic & Services)
   /           |           \
  /            |            \
 ↓             ↓             ↓
MongoDB      IPFS/Pinata   Blockchain (Ethers.js -> RPC)
(Data)       (Images)      ↓
                           Smart Contract (HerbTrace.sol)
                           ↓
                           External Oracle Services (for Location)
```
*(Note: External Oracles are invoked by the Backend, not the Smart Contract directly. The diagram above groups them logically.)*
