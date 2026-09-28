# 16. Potential Research Contributions

Based ONLY on the actual current implementation, the following technical contributions can be claimed:

## Contribution 1: Cross-Stage Merkle Tree Threading for Batch Lineage
- **Implementation evidence:** A processed batch inherits the `chainId` of its parent, allowing a single 4-leaf Merkle Tree to verify data across multiple `batchId`s representing different physical forms of the herb.
- **Relevant source files:** `herbtrace-backend/models/Batch.js` (line 10), `herbtrace-backend/tests/chainId-merkle-e2e.test.js`.
- **Why it may be research-relevant:** Solves the data explosion problem on-chain when tracing transformed products. Instead of creating new Merkle trees and anchoring them at every processing step, the system unifies them under one root, minimizing gas costs.
- **Experimental evidence needed:** A comparison of gas costs between "one root per stage" vs "one root per lineage".

## Contribution 2: Multi-Oracle Geospatial Consensus
- **Implementation evidence:** The system queries 4 separate geocoding APIs and requires distance-based agreement between their coordinates before granting a `verified` status.
- **Relevant source files:** `herbtrace-backend/models/LocationVerification.js`, `herbtrace-backend/tests/multiOracleService.test.js`.
- **Why it may be research-relevant:** Addresses the "garbage-in, garbage-out" oracle problem for supply chain location tracking. By using consensus, it mitigates reliance on a single point of failure for reverse geocoding.
- **Experimental evidence needed:** Latency tests showing the time required to achieve consensus vs a single oracle; success rate measurements based on real-world test data.

> [!CAUTION]
> Do NOT claim the system is the "first" or "most secure" unless extensive literature review and comparative benchmarking is conducted to support those claims.
