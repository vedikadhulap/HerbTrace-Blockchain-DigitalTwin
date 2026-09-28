# 11. Blockchain Transaction Flow

This document traces the complete flow of a blockchain transaction in the HerbTrace system, from user action to final recording.

## 1. Flow of a Transaction
```text
User action (e.g., submit Create form)
       ↓
Frontend (React) captures form data and GPS
       ↓
Backend API receives HTTP POST at `/batch/create`
       ↓
Backend `batchService` creates MongoDB record and updates `BatchMerkleRoot`
       ↓
Backend generates `dataHash` (SHA-256 of the payload)
       ↓
Backend `blockchainService` initializes `ethers.Contract` with correct Wallet
       ↓
Transaction signed & sent to RPC Provider (e.g., Alchemy)
       ↓
Smart contract (`HerbTrace.sol`) executes `createBatch`
       ↓
Transaction hash returned & receipt awaited
       ↓
Backend stores `txHash` in MongoDB
       ↓
Frontend receives success response
```

## 2. Configuration Details

- **RPC Provider:** `ALCHEMY_RPC_URL` (Environment variable)
- **Network Configuration:** Handled via Hardhat (`hardhat.config.js`). 
  - Supports Sepolia (`SEPOLIA_RPC_URL`).
  - Supports localhost node.
- **Contract Address Configuration:** `CONTRACT_ADDRESS` (Environment variable)
- **ABI Source:** Loaded from `../abi/HerbTrace.json` inside `blockchainService.js`.

## 3. Wallet and Signing Mechanism
The system utilizes backend-managed wallets (custodial design) rather than Web3 provider injected wallets (like MetaMask) on the frontend. Wallets are instantiated in `blockchainService.js` using `ethers.Wallet`:

Environment Variables (Redacted values):
- `FARMER_PRIVATE_KEY` (Signs `createBatch` txs)
- `LAB_PRIVATE_KEY` (Signs `recordTest` txs)
- `PROCESSOR_PRIVATE_KEY` (Signs `processBatch` txs)
- `DISTRIBUTOR_PRIVATE_KEY` (Signs `transferCustody` txs)
- `ADMIN_PRIVATE_KEY` (Signs `anchorMerkleRoot` and `recordLocationVerification` txs)

## 4. Transaction Waiting/Confirmation Mechanism
The backend uses standard `ethers.js` Promises. The transaction is awaited (`await tx.wait()`), confirming it has been mined before proceeding to update the MongoDB document with the `txHash`.

## 5. Error Handling
Transactions wrapped in `try/catch` blocks in controllers. Errors bubble up and return `500` HTTP status codes with the error message to the frontend.
