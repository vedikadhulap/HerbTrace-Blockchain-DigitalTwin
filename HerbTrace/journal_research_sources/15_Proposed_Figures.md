# 15. Proposed Figures for Journal Paper

Based on the actual implementation, the following figures are recommended for the journal paper to accurately reflect the system:

## Figure 1: System Architecture
- **Title:** Overall System Architecture of HerbTrace
- **What it should show:** The interaction between the React Frontend, Node.js Backend, MongoDB off-chain storage, IPFS (for images), and the Ethereum Smart Contract.
- **Important labels:** Frontend (Vite/React), API Server (Express.js), Off-Chain DB (MongoDB), IPFS (Pinata), Blockchain (Ethers.js/Solidity).
- **Why it is useful:** Establishes the foundational context of the hybrid on-chain/off-chain model.

## Figure 2: The `chainId` Lineage Mechanism
- **Title:** Batch Lineage and ChainID Threading
- **What it should show:** A flowchart showing `BATCH-A` moving from Create to Test, then being Processed into `BATCH-B`. It must clearly show how `BATCH-B` inherits `chainId = BATCH-A`, allowing a single Merkle Tree to track the combined lifecycle.
- **Source components:** `Batch.js` model and `batchService.js`.
- **Why it is useful:** This is the core technical solution to the problem of maintaining cryptographic lineage when batches are transformed.

## Figure 3: Four-Stage Merkle Tree Verification
- **Title:** Merkle Tree Anchoring across Lifecycle Stages
- **What it should show:** A diagram of a 4-leaf Merkle Tree. 
  - Leaf 0 (Create)
  - Leaf 1 (Test)
  - Leaf 2 (Process)
  - Leaf 3 (Transfer)
  Shows that intermediate stages update the root off-chain, but the final root is anchored on-chain only after the Transfer stage.
- **Source components:** `merkleService.js`.
- **Why it is useful:** Explains how the system minimizes gas costs by only performing one on-chain anchor for the entire batch lifecycle.

## Figure 4: Multi-Oracle Location Verification
- **Title:** Multi-Oracle Consensus Flow for Location Verification
- **What it should show:** The Backend receiving GPS from the Frontend, querying 4 independent Oracles concurrently, calculating the distance between returned coordinates (Threshold < 100m), and producing a Consensus (Verified vs. Low Confidence).
- **Source components:** `LocationVerification.js` model, `multiOracleService.test.js`.
- **Why it is useful:** Demonstrates the geospatial security mechanism used to prevent location spoofing.
