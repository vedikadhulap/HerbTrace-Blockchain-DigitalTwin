# 19. Source File Index

This index maps critical technical claims to their exact source files in the current implementation.

| Claim / Feature | Source File | Function / Class | Evidence |
|---|---|---|---|
| **Smart Contract Storage** | `herbtrace-contracts/contracts/HerbTrace.sol` | `Batch` struct | Only `dataHash` and `status` are stored on-chain. No large data. |
| **Batch Lineage (`chainId`)** | `herbtrace-backend/models/Batch.js` | `batchSchema` | `chainId` defined as String; comments explicitly explain threading. |
| **Merkle Tree Logic** | `herbtrace-backend/services/merkleService.js` | `buildMerkleTree`, `generateProof` | Generates 4-leaf tree; hashes using `crypto.createHash("sha256")`. |
| **Merkle Lineage Testing** | `herbtrace-backend/tests/chainId-merkle-e2e.test.js` | `simulateFullLifecycle` | Proves `chainId` inheritance and Merkle tree generation across batches. |
| **Multi-Oracle Model** | `herbtrace-backend/models/LocationVerification.js` | `locationVerificationSchema` | Defines `oracleResults`, `agreementPairs`, `consensus` fields. |
| **Blockchain Transactions** | `herbtrace-backend/services/blockchainService.js` | `getContract` | Instantiates `ethers.Wallet` using private keys from `.env`. |
| **API Endpoints** | `herbtrace-backend/controllers/batchController.js` | `createBatch`, `labTest`, etc. | Defines all HTTP endpoints and req/res structure. |
| **Frontend GPS Capture** | `herbtrace-frontend/src/components/GPSBar.jsx` | React component | Uses `navigator.geolocation.getCurrentPosition`. |
| **Role Access Control** | `herbtrace-contracts/contracts/HerbTrace.sol` | `FARMER_ROLE`, etc. | Uses OpenZeppelin `AccessControl` modifier `onlyRole`. |
