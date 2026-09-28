### Experiment 6 — End-to-End ChainId Threading and Batch Storage Integrity Benchmark

#### 6.1 Objective
The objective of Experiment 6 is to evaluate whether the HerbTrace implementation correctly preserves batch lineage and data storage integrity across multi-stage and multi-batch supply-chain operations using off-chain `chainId` threading and `parentBatchIds` relationships.

#### 6.2 Research Question
How accurately does the off-chain MongoDB lineage mechanism track parent-child relationships, propagate `chainId` identifiers across stage transitions, maintain storage record consistency, and preserve Merkle proof resolution without cross-lineage contamination?

#### 6.3 Experimental Setup
- **Evaluation Scope**: Production models (`Batch.js`, `BatchMerkleRoot.js`) and services (`batchService.js`, `merkleService.js`)
- **Environment**: Isolated Node.js test environment with Mongoose database integration
- **Test Scenarios Evaluated**:
  1. Scenario A: Single Raw Batch Full Lifecycle (CREATE → TEST → PROCESS → TRANSFER)
  2. Scenario B: Two Raw Batches Combined into One Derived Batch
  3. Scenario C: Derived Batch Multi-Stage Lifecycle Progression
  4. Scenario D: Independent Lineages Isolation (Lineage A vs Lineage B)
- **Total Batches Created**: 8
- **Total Lineages Evaluated**: 4 distinct lineage chains

#### 6.4 ChainId and Parent-Batch Mechanism
The HerbTrace architecture implements an off-chain lineage tracking scheme:
1. **Off-Chain Identification**: `chainId` is an indexed off-chain MongoDB field stored in the `Batch` document. It is **not** written to Ethereum smart contract state.
2. **Chain Creation**: A newly created raw batch sets `chainId = batchId`.
3. **Chain Inheritance**: When raw batches are combined into a processed batch, the derived batch inherits its `chainId` from its first parent batch (`parents[0].chainId || parents[0].batchId`).
4. **Parent Linkage**: Raw parent batch identifiers are preserved in the `parentBatchIds` string array of the derived batch record.
5. **Merkle Resolution**: `BatchMerkleRoot` documents are keyed by `chainId`. When fetching Merkle proofs for a derived batch, `getMerkleProof` looks up the batch's `chainId` in MongoDB to locate the root Merkle tree document.

#### 6.5 Experimental Procedure
1. **Scenario A Execution**: A single raw batch (`EXP6-SGL-RAW-001`) was created, tested, processed, and transferred. At each stage, storage records were inspected to verify that `chainId` remained unchanged.
2. **Scenario B Execution**: Two distinct raw batches (`EXP6-COMB-RAW-101` and `EXP6-COMB-RAW-102`) were created and tested. They were combined into derived batch `EXP6-COMB-PROC-103` with `parentBatchIds: ["EXP6-COMB-RAW-101", "EXP6-COMB-RAW-102"]`.
3. **Scenario C Execution**: The derived batch was transferred, completing all 4 leaves of the inherited `chainId` Merkle root.
4. **Scenario D Execution**: Two independent supply chains (Lineage A and Lineage B) were executed concurrently. Merkle proof lookup calls were verified to ensure complete isolation.

#### 6.6 Lineage Integrity Results
Table 6.1 summarizes the lineage integrity metrics observed across all test scenarios.

**Table 6.1: Lineage Integrity and Parent Relationship Verification**

| Scenario | Batches Created | Parent Relationships Tested | ChainId Correct | Parent IDs Correct | Verification Result |
|---|---:|---:|---:|---:|---|
| Scenario A — Single Raw Batch | 1 | 1 | YES | YES | PASSED |
| Scenario B — Two Raw Batches Combined | 3 | 1 | YES | YES | PASSED |
| Scenario C — Multi-Stage Derived Batch | 1 | 1 | YES | YES | PASSED |
| Scenario D — Lineage Isolation | 4 | 1 | YES | YES | PASSED |

All evaluated lineage relationships were correctly preserved under the tested scenarios (8/8 correct `chainId` assignments, 100% accuracy).

#### 6.7 Storage Integrity Results
Storage record consistency checks are presented in Table 6.2.

**Table 6.2: Batch Storage Record Integrity Checks**

| Metric | Expected Count | Observed Count | Storage Result |
|---|---:|---:|---|
| Total Batch Records | 8 | 8 | MATCH (Clean) |
| Missing Records | 0 | 0 | NONE |
| Duplicate Records | 0 | 0 | NONE |
| Inconsistent Lineage Records | 0 | 0 | NONE |
| Merkle Root Documents | 5 | 5 | MATCH |

#### 6.8 Verification Results
Across all 12 Merkle proof lookup attempts, the `chainId` resolution mechanism successfully retrieved the corresponding Merkle tree document and verified stage proofs against the anchored root without error.

**Table 6.3: Merkle Proof Lineage Integration Verification**

| Scenario | Verification Attempts | Stages Completed | All Proofs Valid | Overall Result |
|---|---:|---:|---|---|
| Single Batch (Scenario A) | 4 | 4 | TRUE | PASSED |
| Derived Batch (Scenario C) | 4 | 4 | TRUE | PASSED |
| Independent Lineages (Scenario D) | 4 | 2 per chain | TRUE | PASSED |

#### 6.9 Lineage Isolation Results
In Scenario D, Lineage A (`EXP6-ISO-A-001`) and Lineage B (`EXP6-ISO-B-001`) maintained distinct `chainId` identifiers and generated unique Merkle roots (`proofA.merkleRoot != proofB.merkleRoot`). Zero cross-lineage record associations or state leaks were observed (0 contamination cases).

#### 6.10 Discussion
The experiment demonstrates that HerbTrace's off-chain `chainId` threading and `parentBatchIds` mechanisms effectively track multi-stage supply chain lineage. By storing `chainId` in MongoDB and keying `BatchMerkleRoot` documents by this shared identifier, the system unifies stage data across derived batch IDs while maintaining strict data isolation between independent supply chains.

#### 6.11 Limitations
This experiment evaluates off-chain database records and Merkle lineage resolution under controlled synthetic scenarios. The findings validate the specific code pathways implemented in HerbTrace and do not guarantee universal database integrity under arbitrary external data corruption or direct database tampering outside application boundaries.

#### 6.12 Reproducibility Instructions
To re-run the Experiment 6 benchmark and verify all results:
```bash
node journal_experiments/chainid_lineage/chainid_lineage_experiment.js
```
