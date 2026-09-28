# 14. Sample Batch Lifecycle

This sample is based on the data flow verified in `herbtrace-backend/tests/chainId-merkle-e2e.test.js`.

## Stage 0: Create (Raw Batch)
- **Farmer Action:** Creates a new batch.
- **Generated `batchId`:** `TEST-CHAIN-001`
- **Generated `chainId`:** `TEST-CHAIN-001` (Set to itself as it is a new batch)
- **Herb Type:** Ashwagandha
- **Location:** 18.52 Lat, 73.85 Lon (Pune, Maharashtra)
- **Merkle Status:** Leaf 0 generated. Root recalculated but not anchored.

## Stage 1: Lab Test
- **Lab Action:** Records moisture and purity.
- **Target `batchId`:** `TEST-CHAIN-001`
- **Target `chainId`:** `TEST-CHAIN-001`
- **Results:** `{ moisture: 11.2, purity: 98.5 }`
- **Location:** 18.50 Lat, 73.87 Lon
- **Merkle Status:** Leaf 1 generated. Root recalculated but not anchored.

## Stage 2: Process (Transforming the Batch)
- **Processor Action:** Converts the raw herb into a processed product.
- **New `batchId`:** `TEST-CHAIN-002`
- **Parent `batchId`:** `TEST-CHAIN-001`
- **Inherited `chainId`:** `TEST-CHAIN-001` (Inherited from the parent)
- **Processing Data:** `{ yield: 82, method: "spray-drying" }`
- **Location:** 18.51 Lat, 73.84 Lon
- **Merkle Status:** Leaf 2 generated (under `chainId` `TEST-CHAIN-001`). Root recalculated but not anchored.

## Stage 3: Transfer Custody
- **Distributor Action:** Assumes custody of the processed batch.
- **Target `batchId`:** `TEST-CHAIN-002`
- **Target `chainId`:** `TEST-CHAIN-001`
- **Transfer Data:** `{ destination: "Mumbai", quantity: 25 }`
- **Location:** 19.07 Lat, 72.87 Lon
- **Merkle Status:** Leaf 3 generated. Tree is now complete (all 4 leaves filled). 
- **Final Action:** The Backend calls `anchorMerkleRoot` on the Smart Contract to permanently record the 32-byte root.

## Verification
A user can query `TEST-CHAIN-002`. The backend traces it back via its `chainId` (`TEST-CHAIN-001`) to retrieve the Merkle proofs and location verifications for all four stages.
