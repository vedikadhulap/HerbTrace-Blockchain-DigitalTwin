# 18. Old vs Current Project

> [!NOTE]
> No "old paper" or legacy documentation files were found in the workspace. However, based on typical transitions from theoretical models to actual implementations, the following key architectural observations about the CURRENT system are highlighted.

## The CURRENT SYSTEM Implementation Facts

| Feature | Current System Implementation |
|---|---|
| **Architecture** | Hybrid. Frontend (React) <-> Backend (Node.js/Mongo) <-> Blockchain (Solidity). The smart contract is merely an anchoring layer, not the primary data store. |
| **Blockchain** | Tested on Hardhat local network. Configured for Sepolia. |
| **Smart Contract** | `HerbTrace.sol` stores hashes and Merkle roots only. It DOES NOT store JSON data or location coordinates. |
| **Batch Structure** | Kept in MongoDB. Linked via an off-chain `chainId`. |
| **Lineage** | Handled exclusively off-chain using the `chainId` parameter, which maps a parent's Merkle tree to a child batch. |
| **Merkle Verification** | 4-leaf tree per `chainId`. Roots are anchored on-chain. Off-chain proofs are served via API. |
| **Location Verification** | Captures GPS on the frontend, uses 4 backend web oracles to reverse-geocode and establish a distance-based consensus. |
| **Digital Twin** | **NOT IMPLEMENTED.** No code or references to a Digital Twin exist in the current scope. |

The CURRENT implementation must be treated as the sole authoritative source for any technical claims in the journal paper.
