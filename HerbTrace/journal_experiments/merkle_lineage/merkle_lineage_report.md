# Merkle Lineage Tampering Experiment Report

## Overview
This experiment evaluates the cross-stage Merkle lineage mechanism in HerbTrace. It verifies the normal workflow (Create -> Test -> Process -> Transfer -> Anchor -> Verify) and ensures that tampering with stage data breaks the Merkle proof verification.

## Distinction of Terms
- **batchId**: A unique identifier for a specific batch state (e.g. raw, processed).
- **chainId**: An off-chain MongoDB construct that links a lineage of batches (e.g. raw batch and its processed child) to a single shared Merkle tree.
- **parentBatchIds**: An array of upstream batchIds combined to form a processed batch.
- **Merkle leaf**: The SHA-256 hash of a deterministic serialization of a single stage's data.
- **Merkle root**: The 32-byte top hash of the Merkle tree covering all 4 stages.
- **On-chain anchor**: The transaction that permanently writes the final Merkle root to the smart contract.

## Results

| Test Name | Input | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Inherit chainId | parent=BATCH-ROOT-123, child=BATCH-PROC-123 | BATCH-ROOT-123 | BATCH-ROOT-123 | ✅ PASS |
| Anchor Merkle Root | 166a4ecc448884a234cd800edb8db9f89795b46381d3f5a480a6a6ff92fbeeb1 | 0x166a4ecc448884a234cd800edb8db9f89795b46381d3f5a480a6a6ff92fbeeb1 | 0x166a4ecc448884a234cd800edb8db9f89795b46381d3f5a480a6a6ff92fbeeb1 | ✅ PASS |
| Verify Valid Proof | TEST stage proof | true | true | ✅ PASS |
| Tamper CREATE data | quantityKg: 500 | false | false | ✅ PASS |
| Tamper TEST data | testResults: Fail | false | false | ✅ PASS |
| Tamper PROCESS data | processorNotes: Cut with fillers | false | false | ✅ PASS |
| Tamper TRANSFER data | transferData: Shipped to US | false | false | ✅ PASS |
| Tamper parentBatchIds | parentBatchIds: ['FAKE-PARENT-999'] | false | false | ✅ PASS |
| Tamper chainId root (DB) | altered root in db | false | false | ✅ PASS |

## Conclusion
The tests demonstrate that the Merkle proof verification successfully detects tampering across all tested stages (CREATE, TEST, PROCESS, TRANSFER, and parentBatchIds). This provides cryptographic evidence of the exact data recorded at each stage as it was anchored on-chain. Note that this experiment only demonstrates the specific behaviors tested; it does not constitute a proof of absolute security for the system as a whole.