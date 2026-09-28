# 17. Current Limitations

Based on the visible implementation, the following limitations exist:

## 1. Fixed Lifecycle Stages
- **Limitation:** The Merkle tree is hardcoded to exactly 4 stages (Create, Test, Process, Transfer) in `merkleService.js`.
- **Impact:** The system cannot easily adapt to a supply chain that requires fewer or additional stages (e.g., a secondary processing stage or retail stage) without structural code changes.

## 2. Custodial Wallet Design
- **Limitation:** The backend uses predefined private keys from the `.env` file to sign transactions on behalf of users (Farmer, Lab, Processor, Distributor).
- **Impact:** Users must trust the central backend server with their transaction signing, which reduces the trustless nature typical of decentralized applications. It does not use MetaMask or injected Web3 providers on the frontend.

## 3. Reliance on External Oracles
- **Limitation:** Location verification depends on the availability and accuracy of Web2 third-party APIs (Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage).
- **Impact:** If these APIs rate-limit the server or experience downtime, location consensus will fail or degrade to `low_confidence`.

## 4. Off-Chain Data Dependence
- **Limitation:** Only hashes and Merkle roots are stored on the blockchain.
- **Impact:** If the MongoDB database is lost, the Merkle tree leaves and `leafData` are lost, making it impossible to reconstruct the proofs, even though the root remains on-chain.

## 5. Missing Experimental Evaluation
- **Limitation:** As noted in Document 13, there are no verifiable logs of gas usage, API latency, or real-world execution times.
- **Impact:** Claims regarding efficiency or performance cannot currently be substantiated in a journal paper.
