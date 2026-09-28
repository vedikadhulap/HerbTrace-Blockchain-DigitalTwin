# 01. Project Overview

## 1. Overall Project Purpose
HerbTrace is a blockchain-based traceability system designed specifically for the herbal medicine supply chain. It aims to ensure data integrity, verifiable lineage, and geospatial authenticity across the entire lifecycle of a herbal batch, from cultivation to final distribution.

## 2. Main Research Problem Being Addressed
The project addresses the lack of transparency, trust, and data immutability in traditional herbal supply chains. It tackles challenges related to unverified location claims, tampered testing data, and broken batch lineage (e.g., when batches are merged or processed) by anchoring critical verification data to a blockchain using Merkle trees.

## 3. Main Users/Actors
- **Farmers:** Cultivate herbs and create the initial raw batches. (Role: `FARMER_ROLE`)
- **Laboratories (Labs):** Perform tests (e.g., moisture, purity) and record the results. (Role: `LAB_ROLE`)
- **Processors:** Transform raw batches into processed batches, merging parent batches. (Role: `PROCESSOR_ROLE`)
- **Distributors:** Transfer custody of the final batches. (Role: `DISTRIBUTOR_ROLE`)
- **Admins:** Manage roles, anchor Merkle roots, and record location verifications. (Role: `DEFAULT_ADMIN_ROLE`)

## 4. System Architecture
The system follows a three-tier architecture augmented with a blockchain layer:
- **Frontend:** A React/Vite-based web application for user interaction.
- **Backend:** A Node.js/Express.js server handling business logic, API requests, and blockchain communication.
- **Database:** MongoDB for off-chain storage of detailed batch data, Merkle structures, and location verification records.
- **Blockchain:** Ethereum-compatible network (via Hardhat/Ethers.js) hosting the `HerbTrace.sol` smart contract for immutable anchoring.

## 5. Frontend
Built with React (Vite), featuring role-specific pages (e.g., `CreateBatch.jsx`, `LabTest.jsx`, `ProcessBatch.jsx`, `TransferCustody.jsx`) and verification tools (`Verify.jsx`). It includes components like `GPSBar.jsx` for capturing location coordinates.

## 6. Backend
Built with Node.js and Express.js (`server.js`). It uses modular controllers (`batchController.js`) and services (`batchService.js`, `merkleService.js`, `blockchainService.js`) to process data and interact with both MongoDB and the blockchain network.

## 7. Database
MongoDB is used. Key models include:
- `Batch.js`: Stores batch data, metadata, and the `chainId` for lineage.
- `BatchMerkleRoot.js`: Stores the Merkle tree leaves, root, and proofs for a specific `chainId`.
- `LocationVerification.js`: Stores multi-oracle consensus data for GPS coordinates.
- `User.js`: User authentication and role management.

## 8. Blockchain/Smart Contract Layer
Implemented in Solidity (`HerbTrace.sol`, `v0.8.27`). It uses OpenZeppelin's `AccessControl` for role management. The contract stores essential batch hashes, Merkle root anchors (`merkleAnchors`), and location verifications (`locationVerifications`), minimizing on-chain storage costs.

## 9. External Services/Oracles
The backend implements a multi-oracle service to verify location data. It checks coordinates against multiple external APIs (e.g., Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage) to establish consensus on the human-readable location.

## 10. Data Flow
1. User submits data via the Frontend.
2. Backend API receives data, processes it, and updates MongoDB.
3. For specific stage completions (e.g., Transfer) or administrative actions, the Backend signs a transaction via `blockchainService.js` and sends it to the Smart Contract.
4. Smart Contract emits events and stores hashes/roots.

## 11. Batch Lifecycle
The lifecycle consists of four distinct stages:
1. **Create** (Stage 0)
2. **Test** (Stage 1)
3. **Process** (Stage 2)
4. **Transfer** (Stage 3)

## 12. Verification Workflow
Verification can be done via the `Verify.jsx` frontend page, which calls the backend `verify` endpoint. The system uses Merkle proofs (`getMerkleProof` API) to allow independent verification of each stage's data against the on-chain anchored Merkle root.

## 13. Security/Integrity Mechanisms
- **Role-based Access Control (RBAC):** Enforced both on-chain (`AccessControl`) and off-chain (JWT/Middleware).
- **Data Hashing:** Stage data is hashed (SHA-256) before being included in the Merkle tree.
- **Merkle Trees:** Instead of storing all data on-chain, a single 32-byte Merkle root is anchored on-chain for the entire batch lifecycle, enabling selective and efficient verification.

## 14. Batch Lineage Mechanism
Implemented using a unique `chainId` concept off-chain. When a batch is created, its `chainId` equals its `batchId`. When processed, the new batch inherits the `chainId` of its first parent. This allows all four stages of a lineage to share a single Merkle tree. Parent-child relationships are also tracked via the `parentBatchIds` array in MongoDB and the `parents` mapping on-chain.
