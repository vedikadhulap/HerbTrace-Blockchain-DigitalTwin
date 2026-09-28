# README: HerbTrace Research Documentation Package

## What this package contains
This directory (`journal_research_sources/`) contains a comprehensive, 19-part technical documentation package representing the **CURRENT** implementation of the HerbTrace project.

## Purpose
This package is intended to be provided to NotebookLM as the authoritative source for writing a journal research paper. It ensures that the paper is based strictly on what is currently coded and tested, preventing the hallucination of features.

## Authoritative Files
All Markdown files in this directory are authoritative. They map directly to the source code located in:
- `herbtrace-backend/`
- `herbtrace-contracts/`
- `herbtrace-frontend/`

**Key Mappings to Note:**
- The Smart Contract (`HerbTrace.sol`) is minimalist; it handles anchoring.
- Complex lineage logic (`chainId`) is handled off-chain in MongoDB.
- Digital Twin functionality is **NOT** present and must not be mentioned in the paper.

## Verified Information
- System architecture and data flow.
- The 4-stage batch lifecycle.
- The Merkle Tree implementation (`merkleService.js`).
- The Multi-Oracle Location Consensus (`LocationVerification.js`).
- The off-chain Lineage threading model.

## Missing Information & Required Experiments
Before submitting the journal paper, the following experiments **MUST** be performed and documented:
1. **Gas Cost Analysis:** Run Hardhat tests with the gas reporter enabled to get actual gas usage for `anchorMerkleRoot`, `createBatch`, etc.
2. **Latency Measurements:** Measure the response times of the backend API, particularly the `getLocationVerification` consensus mechanism.
3. **Testnet Deployment:** Deploy to Sepolia and record actual transaction hashes and confirmation times if real-world network data is required for the paper.

## Claims to AVOID
Do **NOT** claim the following in the research paper:
- Do not claim the system has a "Digital Twin".
- Do not claim that complete batch JSON data is stored on the blockchain.
- Do not claim the system is fully decentralized (it uses a custodial backend wallet design).
- Do not invent hypothetical gas metrics.

> **Instruction for NotebookLM:** Treat this `journal_research_sources/` folder as the absolute ground truth for the current HerbTrace implementation.
