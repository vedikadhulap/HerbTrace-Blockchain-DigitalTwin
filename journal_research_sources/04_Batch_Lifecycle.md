# 04. Batch Lifecycle

The current batch lifecycle is exactly implemented as a 4-stage sequential workflow:
**CREATE → LAB TEST → PROCESS → TRANSFER**

| Stage | Name | Actor | Frontend Action | Backend Endpoint | Database Operation | Smart-Contract Function | Data Recorded | Merkle Operation |
|---|---|---|---|---|---|---|---|---|
| **0** | **CREATE** | Farmer | Submits form on `CreateBatch.jsx` | `POST /batch/create` | Creates new `Batch` doc with `chainId = batchId`. Creates `BatchMerkleRoot`. | `createBatch()` | Herb type, method, GPS, farmer info, initial dataHash. | Leaf 0 generated and stored in `BatchMerkleRoot`. Root updated (not anchored yet). |
| **1** | **TEST** | Lab | Submits lab data on `LabTest.jsx` | `POST /batch/lab-test` | Updates `Batch` doc with `labData` and `labLocation`. | `recordTest()` | Test results (moisture, purity, etc.), Lab GPS. | Leaf 1 generated. Root updated (not anchored yet). |
| **2** | **PROCESS** | Processor | Submits processing data on `ProcessBatch.jsx` | `POST /batch/process` | Creates NEW `Batch` doc with new `batchId`, inherits `chainId` from parent. Maps `parentBatchIds`. | `processBatch()` | Processing notes, yield, processor GPS, parents. | Leaf 2 generated under the parent's `chainId`. Root updated (not anchored yet). |
| **3** | **TRANSFER** | Distributor | Submits transfer on `TransferCustody.jsx` | `POST /batch/transfer` | Updates the processed `Batch` doc with `transferData`. | `transferCustody()` | Destination, new owner, distributor GPS. | Leaf 3 generated. Tree complete. **FINAL Root anchored on-chain** via `anchorMerkleRoot()`. |

> [!NOTE]
> Location verification runs at every stage. The backend captures GPS coordinates, queries Oracles, establishes consensus, stores it in `LocationVerification`, and anchors it on-chain via `recordLocationVerification()`.
