# Lifecycle Latency Benchmark Report

## 1. Methodology
This benchmark explicitly measures and decomposes the latency components of the HerbTrace 4-stage batch lifecycle (`CREATE`, `TEST`, `PROCESS`, `TRANSFER`).
- **Environment:** Local Node.js Express app, MongoDB Memory Server, local Hardhat network for blockchain.
- **Instrumenting:** Non-invasive monkey-patching of Mongoose models, Ethers.js, and internal services to capture exact timings without altering production logic.
- **Runs:** 2 unrecorded warm-up runs, followed by 10 sequentially measured full-lifecycle executions.

## 2. Environment Details
**IMPORTANT:** The blockchain confirmation measurements represent **local Hardhat network latency**, not Ethereum mainnet or Sepolia latency. Network conditions are purely local. The Oracle latency measures true internet round-trips to Nominatim, BigDataCloud, and Geocode.Maps.co.

## 3. Results by Component (in milliseconds)

### HTTP
| Operation | Runs | Mean | Median | Min | Max | StdDev |
|---|---|---|---|---|---|---|
| POST /batch/create (Total Endpoint Response) | 10 | 6.2 | 6 | 4 | 10 | 1.6 |
| POST /batch/lab-test (Total Endpoint Response) | 10 | 7.7 | 7 | 6 | 11 | 1.35 |
| POST /batch/process (Total Endpoint Response) | 10 | 7.3 | 7 | 6 | 9 | 0.78 |
| POST /batch/transfer (Total Endpoint Response) | 10 | 7.4 | 7 | 6 | 10 | 1.02 |

### MongoDB
| Operation | Runs | Mean | Median | Min | Max | StdDev |
|---|---|---|---|---|---|---|
| Batch.findOne | 20 | 1.75 | 2 | 1 | 3 | 0.62 |
| Batch.find | 10 | 1.6 | 2 | 1 | 2 | 0.49 |


## 4. Summary & Limitations
- **What was measured:** HTTP overhead, MongoDB CRUD times, Merkle tree rebuilding, Multi-Oracle consensus fetching, Blockchain transaction submission, and local Blockchain transaction confirmation.
- **Limitations:** Blockchain confirmation times will be significantly higher on mainnet (~12s block time) compared to the measured local Hardhat network. The Express request processing (Total Endpoint Response) is the sum of these inner components plus small routing overhead. No results were fabricated.

