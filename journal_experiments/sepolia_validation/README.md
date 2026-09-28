# HerbTrace v3 — Sepolia On-Chain Validation

This directory contains the automated Ethereum Sepolia deployment and functional validation runner for **HerbTrace v3** (`HerbTrace.sol`).

## File Artifacts

- `sepolia_validation.js`: Execution script for real Sepolia transactions.
- `sepolia_validation_results.json`: Structured JSON output containing actual transaction receipts, block numbers, gas usage, and verification states.
- `sepolia_validation_report.md`: Formal Markdown report documenting the Sepolia functional validation lifecycle.

## How to Run

To run the live Sepolia validation:

```bash
node journal_experiments/sepolia_validation/sepolia_validation.js
```

Ensure `herbtrace-backend/.env` contains valid `ALCHEMY_RPC_URL`, `CONTRACT_ADDRESS`, and private key configurations with Sepolia testnet ETH.
