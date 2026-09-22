# 06. Batch Lineage

## 1. What `batchId` represents
`batchId` is a unique identifier generated on the frontend (usually a UUID or a custom format) that represents a specific physical state of a herb batch at a given time.

## 2. What `chainId` represents
`chainId` is an **off-chain** construct in MongoDB used to thread the Merkle tree across stage transitions. It represents the "origin" batch of a lineage. All four stages (Create, Test, Process, Transfer) must share one Merkle tree, and `chainId` is the key for that tree in the `BatchMerkleRoot` collection.

## 3. What `parentBatchIds` represents
When a raw batch is processed (e.g., dried, ground), it results in a new processed batch. `parentBatchIds` is an array that stores the `batchId`s of all raw batches that were combined/used to create the new processed batch.

## 4. Relationship Between Processed Batch and Parent
A processed batch inherits its `chainId` from its **first parent** (`parents[0].chainId`). This ensures that the newly created processed batch continues the Merkle tree lineage started by the original raw batch.

## 5. Storage of Lineage
- **Off-chain:** `parentBatchIds` array and `chainId` string are stored in the MongoDB `Batch` document.
- **On-chain:** `parents` mapping (`mapping(string => string[]) public parents;`) stores the `parentBatchIds` for a given `batchId`. `chainId` is NOT stored on-chain.

## 6. Retrieval of Lineage
Lineage can be retrieved off-chain via the backend `verify` endpoint (which populates the parent batches) and on-chain via the `getParents(string memory batchId)` smart contract function.

## 7. Verification of Lineage
Verified by traversing the `parentBatchIds` recursively or querying the Merkle proofs using the inherited `chainId`.

## 8. Multiple Parent Batches
If multiple parent batches are involved during processing (e.g., merging two raw batches of Ashwagandha into one powder batch), the current implementation in `chainId-merkle-e2e.test.js` shows the new batch inherits the `chainId` of the *first* parent batch (`parents[0].chainId` or fallback to `parents[0].batchId`).

## Simple Example

```text
Original Batch (batchId: "BATCH-A")
  [ chainId: "BATCH-A" ]
        ↓
Processed Batch (batchId: "BATCH-B")
  [ chainId: "BATCH-A", parentBatchIds: ["BATCH-A"] ]
        ↓
Transferred Batch (update on "BATCH-B")
  [ chainId: "BATCH-A" ]
```

All these actions update the single Merkle Tree keyed by `chainId = "BATCH-A"`.
