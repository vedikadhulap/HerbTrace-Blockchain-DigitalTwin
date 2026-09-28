# 09. Backend API Documentation

The backend exposes RESTful API endpoints via Express.js.

## Batch Endpoints

| HTTP Method | Endpoint | Purpose | Lifecycle Stage | Auth Required | DB Operation | SC Operation |
|---|---|---|---|---|---|---|
| `POST` | `/batch/create` | Creates a raw batch | Create (0) | Yes (Farmer) | `Batch`, `BatchMerkleRoot` insert | `createBatch()` |
| `POST` | `/batch/lab-test` | Records test results | Test (1) | Yes (Lab) | `Batch` update | `recordTest()` |
| `POST` | `/batch/process` | Creates processed batch | Process (2) | Yes (Processor)| `Batch` insert | `processBatch()` |
| `POST` | `/batch/transfer` | Transfers custody | Transfer (3) | Yes (Distributor)| `Batch` update | `transferCustody()` & `anchorMerkleRoot()` |
| `GET` | `/batch/:id` | Retrieves batch details | All | No | `Batch` query | None |
| `GET` | `/batch/verify/:batchId` | Full verification data | Verification | No | `Batch` query | None |
| `GET` | `/batch/:batchId/merkle-proof/:stageIndex`| Gets stage Merkle proof | Verification | No | `BatchMerkleRoot` query | None |
| `GET` | `/batch/:batchId/location-verification`| Gets oracle consensus | Verification | No | `LocationVerification` query | None |
| `GET` | `/batch/count` | Total batches | System | No | `Batch` count | None |
| `GET` | `/batch/recent` | Recent activity feed | System | No | `Batch` query | None |
| `POST` | `/batch/upload-image` | Uploads image to IPFS | Any | Yes | IPFS/Pinata | None |
| `POST` | `/batch/upload-direct` | Direct IPFS upload | Any | No (Currently) | IPFS/Pinata | None |
| `GET` | `/batch/qrcode/:batchId` | Generates QR code | Any | No | None | None |

## Auth Endpoints (Inferred from standard structure)
- `POST /auth/register`
- `POST /auth/login`
