# 12. Testing and Validation

The project contains several test suites verifying both off-chain logic and on-chain smart contract functionality.

## 1. Smart Contract Tests
**File:** `herbtrace-contracts/test/HerbTraceV2.test.js`
- **Purpose:** Hardhat tests verifying the core features of `HerbTrace.sol`.
- **Validates:**
  - `anchorMerkleRoot()` emits correct events.
  - Reverts if Merkle root is anchored twice for the same batch.
  - `recordLocationVerification()` works for all 4 stage indices.
  - Regression tests for existing functions (`createBatch`, `recordTest`, `processBatch`, `transferCustody`).
- **Expected Result:** All assertions pass. Events are emitted correctly. 

## 2. Merkle Tree Off-Chain Tests
**File:** `herbtrace-backend/tests/merkleService.test.js`
- **Purpose:** Unit tests for `merkleService.js`.
- **Validates:** 
  - SHA-256 hash generation (`buildLeafData`, `sha256Hex`).
  - Tree construction (`buildMerkleTree`) producing exactly 4 leaves and a 32-byte root.
  - Empty stage handling (hashing `"EMPTY"`).
  - Proof generation and verification (`generateProof`, `verifyProof`).

## 3. Merkle Lineage E2E Tests
**File:** `herbtrace-backend/tests/chainId-merkle-e2e.test.js`
- **Purpose:** Full 4-stage lifecycle test to verify `chainId` threading.
- **Validates:**
  - `chainId` logic: A new batch sets `chainId` to its `batchId`.
  - Processed batches inherit the `chainId` of their parent.
  - The Merkle tree is successfully built across multiple `batchId`s that share the same `chainId`.
  - MongoDB integration: Creates documents and asserts `chainId` is used as the key for `BatchMerkleRoot`.

## 4. Location Oracle Tests
**File:** `herbtrace-backend/tests/multiOracleService.test.js`
- **Purpose:** Tests the multi-oracle consensus logic.
- **Validates:**
  - Aggregation of results from Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage.
  - Distance threshold logic (default 100m).
  - Proper flagging of `verified` vs `low_confidence`.
