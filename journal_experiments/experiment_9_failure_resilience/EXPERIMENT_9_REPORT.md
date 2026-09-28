# Experiment 9 — Failure Resilience in HerbTrace Blockchain Supply Chain

## Metadata
| Field       | Value                                                              |
|-------------|-------------------------------------------------------------------|
| Date        | 2026-09-27                                                        |
| Version     | HerbTrace v3 (Failure Resilience Edition)                         |
| Network     | Hardhat Local (unit/integration), Sepolia Testnet (manual verify) |
| Test Files  | `Experiment9.test.js`, `experiment9.backend.test.js`             |
| Contract    | `HerbTrace.sol` (v3)                                              |

---

## 1. Overview

This experiment implements and validates three production-level failure resilience improvements to the HerbTrace blockchain-backed herb traceability system:

1. **Lab Test Failure / Quarantine Handling** — Batches that fail lab quality tests are permanently blocked from downstream processing and transfer at both the smart contract and backend service layers.

2. **Lineage-Based Batch Recall** — When a batch is found to be contaminated, a single recall command propagates through the entire parentBatchIds/chainId lineage graph, blocking all descendant batches.

3. **Blockchain ↔ MongoDB Reconciliation** — A detection service identifies inconsistencies between authoritative on-chain state and the MongoDB off-chain cache.

All improvements are additive — no existing lifecycle functions were removed or behaviorally changed for passing batches.

---

## 2. Contract Changes (HerbTrace.sol v2 → v3)

### 2.1 New Status Enum Values

```solidity
enum Status {
    Created,      // 0 — existing
    Tested,       // 1 — existing (now means lab PASSED)
    Processed,    // 2 — existing
    Transferred,  // 3 — existing
    TestFailed,   // 4 — NEW: lab test failed, batch blocked
    Quarantined,  // 5 — NEW: admin hold, batch blocked
    Recalled      // 6 — NEW: safety recall, batch blocked
}
```

**Design decision**: Enum values 0–3 were NOT reordered to preserve backward compatibility with any existing deployed records that may reference numeric status values.

### 2.2 New LabOutcome Enum

```solidity
enum LabOutcome { Pass, Fail, Flagged }
```

- `Pass` (0) → status = `Tested`
- `Fail` (1) → status = `TestFailed` (blocked)
- `Flagged` (2) → status = `Tested` (not blocked, advisory only)

### 2.3 Updated `recordTest()` Signature

```solidity
// v2 (old):
function recordTest(string memory batchId, bytes32 dataHash)

// v3 (new):
function recordTest(string memory batchId, bytes32 dataHash, LabOutcome outcome, string memory reason)
```

### 2.4 New Admin Functions

```solidity
function recallBatch(string memory batchId, string memory reason) public onlyRole(DEFAULT_ADMIN_ROLE)
function quarantineBatch(string memory batchId, string memory reason) public onlyRole(DEFAULT_ADMIN_ROLE)
```

### 2.5 processBatch() Guards

```solidity
// ADDED: all parent batches must be Tested/Processed (not failed/recalled)
require(!_isBlocked(batches[pid].status), "One or more parent batches are blocked ...");
require(
    batches[pid].status == Status.Tested || batches[pid].status == Status.Processed,
    "Parent batch must be in Tested or Processed state"
);
```

### 2.6 transferCustody() Guard

```solidity
// ADDED: blocked batches cannot be transferred
require(!_isBlocked(batches[batchId].status), "Batch is blocked ...");
```

### 2.7 New Events

```solidity
event TestFailed(string indexed batchId, address indexed lab, bytes32 dataHash, string reason);
event BatchRecalled(string indexed batchId, address indexed admin, string reason);
```

---

## 3. Backend Changes

### 3.1 New Services

| File | Purpose |
|------|---------|
| `services/recallService.js` | BFS-based lineage traversal, MongoDB + on-chain recall |
| `services/reconciliationService.js` | Detection-only field comparison (status, hash, parents) |

### 3.2 Updated Services

| File | Change |
|------|--------|
| `services/batchService.js` | `recordLabTest()` forwards `labOutcome` to contract; `processBatch()` and `transferBatch()` enforce blocked status guards; re-exports recall functions |

### 3.3 Model Changes (Batch.js)

New fields added to Batch schema:

| Field | Type | Purpose |
|-------|------|---------|
| `status` | Enum | Extended with `TEST_FAILED`, `QUARANTINED`, `RECALLED` |
| `labOutcome` | Enum (PASS/FAIL/FLAGGED) | Explicit lab result |
| `labFailReason` | String | Reason for lab failure |
| `recallReason` | String | Reason for recall |
| `recalledAt` | Date | Timestamp of recall |
| `recalledBy` | ObjectId | Admin who initiated recall |
| `quarantineReason` | String | Reason for quarantine hold |

### 3.4 New API Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| `POST` | `/batch/recall` | Admin | Initiate lineage recall |
| `GET` | `/batch/reconcile` | Admin | Reconcile all batches (paginated) |
| `GET` | `/batch/reconcile/:batchId` | Admin | Reconcile single batch |
| `GET` | `/batch/:batchId/lineage` | Public | View batch lineage chain |
| `GET` | `/batch/:batchId/recall-status` | Public | Check if batch is blocked |

---

## 4. Test Results

### 4.1 Smart Contract Tests (Hardhat)

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Experiment9 — Suite A: Lab Failure | 12 | 12 | 0 |
| Experiment9 — Suite B: Recall | 12 | 12 | 0 |
| Experiment9 — Suite C: Regression | 12 | 12 | 0 |
| Experiment9 — Suite D: Authorization | 4 | 4 | 0 |
| HerbTraceV2 — Regression | 5 | 5 | 0 |
| HerbTraceV2 — Feature 1: Merkle | 6 | 6 | 0 |
| HerbTraceV2 — Feature 2: Location | 7 | 7 | 0 |
| Gas Benchmark | 1 | 1 | 0 |
| **Total** | **59** | **59** | **0** |

### 4.2 Backend Tests (Node.js)

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Suite A: Status Mapping | 9 | 9 | 0 |
| Suite B: Lineage BFS | 6 | 6 | 0 |
| Suite C: MongoDB Recall Integration | 5 | 5 | 0 |
| Suite D: Reconciliation Logic | 8 | 8 | 0 |
| Suite E: Model Validation | 4 | 4 | 0 |
| **Total** | **32** | **32** | **0** |

### 4.3 Chain ID / Merkle E2E Tests

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Suite 1: chainId Threading | 4 | 4 | 0 |
| Suite 2: Merkle Tree Across Batches | 4 | 4 | 0 |
| Suite 3: MongoDB Integration | 3 | 3 | 0 |
| **Total** | **11** | **11** | **0** |

**Grand total: 102 tests — 102 passing, 0 failing.**

---

## 5. Gas Consumption Analysis

Gas readings from Benchmark test (5 iterations, Hardhat local):

| Operation | Description |
|-----------|-------------|
| `createBatch()` | Creates farmer batch on-chain |
| `recordTest()` | Records lab outcome (Pass/Fail/Flagged) |
| `processBatch()` | Creates processed batch with parent lineage |
| `transferCustody()` | Transfers custody to distributor |
| `anchorMerkleRoot()` | Anchors Merkle root for stage |
| `recordLocationVerification()` | Records oracle consensus location |

> Note: See gas benchmark output file for exact Wei/Gas figures. The addition of new status enum values (4, 5, 6) and LabOutcome enum does not significantly increase gas for existing operations since enum storage costs are determined by slot usage (uint8) which was already allocated.

---

## 6. Security Properties Verified

| Property | Verification Method | Result |
|----------|---------------------|--------|
| Failed batch cannot be processed | Solidity require + test A4 | ✅ |
| Failed batch cannot be transferred | Solidity require + test A5 | ✅ |
| Quarantined batch cannot be processed | Solidity require + test A11 | ✅ |
| Quarantined batch cannot be transferred | Solidity require + test A12 | ✅ |
| Recalled batch cannot be transferred | Solidity require + test B3 | ✅ |
| Recalled batch cannot be re-used as parent | Solidity require + test B4 | ✅ |
| Only admin can recall | AccessControl + test B7, B8 | ✅ |
| Only admin can quarantine | AccessControl + test D3 | ✅ |
| Only lab can record test | AccessControl + test A6 | ✅ |
| Duplicate recall rejected | Solidity require + test B5 | ✅ |
| Unrelated batches unaffected by recall | BFS scope + test B10 | ✅ |
| FLAGGED outcome does not block processing | Test A3 | ✅ |
| Existing PASS lifecycle unchanged | Regression tests C1-C12 | ✅ |

---

## 7. Lineage Recall Design

### 7.1 Algorithm

The lineage recall uses **Breadth-First Search (BFS)** through the `parentBatchIds` edges:

```
Input: rootBatchId
1. Find all batches sharing chainId with root → build adjacency map (parent→children)
2. BFS from root → collect all reachable descendants
3. For each affected batch:
   a. MongoDB: set status=RECALLED, recallReason, recalledAt
   b. On-chain: call recallBatch(batchId, reason) via admin wallet
4. Return: { affectedBatchIds, mongoRecalls, chainRecalls, errors }
```

### 7.2 Safety Properties

- **Non-destructive**: Records are never deleted; full audit trail is preserved.
- **Best-effort on-chain**: If an on-chain recall fails (e.g. batch not on-chain), MongoDB is still updated. Failures are logged in the result's `errors[]` array.
- **Idempotent (MongoDB)**: `findOneAndUpdate()` is safe to re-run.
- **Scoped to chain**: Only batches with the same `chainId` are considered for BFS — unrelated batches in other chains are never touched.

---

## 8. Reconciliation Service Design

### 8.1 Compared Fields

| Field | MongoDB Source | On-Chain Source |
|-------|---------------|-----------------|
| `status` | `batch.status` (string) | `getBatch().status` (uint8 enum) |
| `dataHash` | `batch.dataHash` (hex) | `getBatch().dataHash` (bytes32) |
| `parentBatchIds` | `batch.parentBatchIds[]` | `getParents()` |
| `txHash` | `batch.txHash` | Derived from `lastUpdated > 0` |

### 8.2 Inconsistency Severity

| Severity | Meaning |
|----------|---------|
| CRITICAL | Data hash mismatch — possible tampering |
| HIGH | Status mismatch or batch missing from one side |
| MEDIUM | Lineage (parent IDs) divergence |
| LOW | Missing txHash reference |

### 8.3 Design Principle

The reconciliation service is **detection-only** — it never automatically overwrites MongoDB or on-chain data. All remediation decisions must be made explicitly by an admin. This design avoids unintended data corruption from automated "fixes".

---

## 9. Backward Compatibility

All changes are **backward-compatible** for existing batches:

1. The Status enum preserves numeric values 0–3 for existing states.
2. The updated `recordTest()` signature adds optional `outcome` and `reason` parameters — the backend defaults to `Pass` when not provided, preserving existing behavior.
3. No existing MongoDB schema fields were removed.
4. The `processBatch()` and `transferCustody()` guards only affect batches in blocked states — all previously functional batches remain functional.

---

## 10. Limitations and Future Work

1. **Propagation model**: On-chain recall is per-batch (not propagated). The backend's BFS propagation works for MongoDB, but each descendant needs an individual on-chain `recallBatch()` call. In a production system with hundreds of descendants, this should be batched or done via a multi-send pattern.

2. **Reconciliation scope**: The current reconciliation only compares batches that exist in MongoDB. Batches created on-chain but never recorded in MongoDB (e.g., from direct contract interactions) would appear as `MISSING_MONGO` results.

3. **Oracle-triggered quarantine**: A future enhancement could automate quarantine triggering based on multi-oracle consensus failures (e.g., the `spatiotemporalFraudService` detecting impossible location jumps).

---

## 11. Files Modified / Created

### Smart Contract
- `herbtrace-contracts/contracts/HerbTrace.sol` — v3 (modified)
- `herbtrace-contracts/test/Experiment9.test.js` — NEW
- `herbtrace-contracts/test/HerbTraceV2.test.js` — updated for v3 interface
- `herbtrace-contracts/test/Benchmark.gas.test.js` — updated for v3 interface

### Backend
- `herbtrace-backend/services/recallService.js` — NEW
- `herbtrace-backend/services/reconciliationService.js` — NEW
- `herbtrace-backend/services/batchService.js` — modified
- `herbtrace-backend/controllers/recallController.js` — NEW
- `herbtrace-backend/controllers/batchController.js` — modified
- `herbtrace-backend/models/Batch.js` — modified
- `herbtrace-backend/routes/batchRoutes.js` — modified
- `herbtrace-backend/abi/HerbTrace.json` — updated to v3 ABI
- `herbtrace-backend/tests/experiment9.backend.test.js` — NEW
