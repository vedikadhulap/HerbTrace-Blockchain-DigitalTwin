# Ethereum Sepolia On-Chain Deployment & Functional Validation Report

## Executive Summary

This report documents the empirical functional validation of the **HerbTrace v3** smart contract (`HerbTrace.sol`) deployed on the public **Ethereum Sepolia test network**.

> [!IMPORTANT]  
> **Scope Distinction:**  
> This experiment is strictly a **functional lifecycle validation** on a live, public Ethereum test network to verify smart contract correctness, role enforcement, lineage tracking, and Merkle root anchoring under real network conditions. It is **NOT** a performance benchmark. Local gas efficiency and latency benchmarks are evaluated separately under controlled conditions.

---

## Deployment & Configuration Details

| Parameter | Value |
| :--- | :--- |
| **Contract Name** | `HerbTrace.sol` (v3 Failure Resilience Edition) |
| **Deployed Address** | `[0x721069cf9EF3eF6C8fd7C5d8d6f1b1487015b330](https://sepolia.etherscan.io/address/0x721069cf9EF3eF6C8fd7C5d8d6f1b1487015b330)` |
| **Target Network** | Ethereum Sepolia Testnet (`chainId: 11155111`) |
| **RPC Endpoint** | Alchemy (`eth-sepolia.g.alchemy.com`) |
| **Validation Timestamp** | `2026-09-28T16:33:52.608Z` |
| **Overall Status** | **PASSED (100% On-Chain Verification)** |

---

## On-Chain Transaction Execution Ledger

Every transaction listed below represents an actual, non-mock transaction executed on the Ethereum Sepolia network, confirmed by a block receipt.

| Step | Operation | Target Batch ID | Actor Role | Block Number | Gas Used | Receipt Status | Etherscan Link |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | `createBatch()` | `SEP-VAL-1790613140808-RAW` | `FARMER_ROLE` | `11801733` | `119262` | `1 (Success)` | [View Tx](https://sepolia.etherscan.io/tx/0xfb238b13aea53d7007dc4ace8fd33e91b7d88fb86714ced04181bb59df801565) |
| **2** | `recordTest(PASS)` | `SEP-VAL-1790613140808-RAW` | `LAB_ROLE` | `11801734` | `52959` | `1 (Success)` | [View Tx](https://sepolia.etherscan.io/tx/0x26be950d2acfd92df8ca0fc59b91cdbda895664a0412b9ab2dd32f574591e121) |
| **3** | `processBatch()` | `SEP-VAL-1790613140808-PROC` | `PROCESSOR_ROLE` | `11801736` | `176356` | `1 (Success)` | [View Tx](https://sepolia.etherscan.io/tx/0x0c6563e7563b9b18f7440f6787906490c56547a45b821f728b4de9aeac292dee) |
| **4** | `transferCustody()` | `SEP-VAL-1790613140808-PROC` | `DISTRIBUTOR_ROLE` | `11801737` | `52823` | `1 (Success)` | [View Tx](https://sepolia.etherscan.io/tx/0xba050966a6f57288dd66c13fd5501e5e40880ee558f1ae61437fc399fa83c18c) |
| **5** | `anchorMerkleRoot()` | `SEP-VAL-1790613140808-PROC` | `DISTRIBUTOR_ROLE` | `11801739` | `198776` | `1 (Success)` | [View Tx](https://sepolia.etherscan.io/tx/0xa7e6479da4c8adaf68d3b380f38af9b32b7bbe22418a736cb1e9fd76a3daef06) |

---

## Detailed Lifecycle Verification Results

### 1. Raw Batch Creation (`createBatch`)
- **Actor:** Farmer Wallet (`0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8`)
- **Batch ID:** `SEP-VAL-1790613140808-RAW`
- **Resulting State:** `Created (0)`
- **Transaction Hash:** `0xfb238b13aea53d7007dc4ace8fd33e91b7d88fb86714ced04181bb59df801565`

### 2. Quality Assurance Test Recording (`recordTest`)
- **Actor:** Lab Wallet (`0x20Fe2c5d074128b6c411BAF5CF704863C7764e50`)
- **Outcome:** `LabOutcome.Pass (0)`
- **Resulting State:** `Tested (1)`
- **Transaction Hash:** `0x26be950d2acfd92df8ca0fc59b91cdbda895664a0412b9ab2dd32f574591e121`

### 3. Processing & Parent-Child Lineage (`processBatch`)
- **Actor:** Processor Wallet (`0x61E3f0448395f8Fd239a968a2a319c8526D99faF`)
- **Child Batch ID:** `SEP-VAL-1790613140808-PROC`
- **Parent Lineage:** `["SEP-VAL-1790613140808-RAW"]`
- **Resulting State:** `Processed (2)`
- **Transaction Hash:** `0x0c6563e7563b9b18f7440f6787906490c56547a45b821f728b4de9aeac292dee`

### 4. Custody Transfer (`transferCustody`)
- **Actor:** Distributor Wallet (`0x2999b14C8B373Aea1bAaC0e2879fc497a479F761`)
- **New Owner Address:** `0x2999b14C8B373Aea1bAaC0e2879fc497a479F761`
- **Resulting State:** `Transferred (3)`
- **Transaction Hash:** `0xba050966a6f57288dd66c13fd5501e5e40880ee558f1ae61437fc399fa83c18c`

### 5. Merkle Root Anchoring (`anchorMerkleRoot`)
- **Stage Index:** `3` (Transfer Stage)
- **Anchored Root Hash:** `0xa130de54172185b4393ef8416f89e159faf8ebfc2aa21a66a3f2cfab1f7f0097`
- **Transaction Hash:** `0xa7e6479da4c8adaf68d3b380f38af9b32b7bbe22418a736cb1e9fd76a3daef06`

---

## On-Chain Verification Assertions

| Verification Target | Expected Value | Observed On-Chain Value | Status |
| :--- | :--- | :--- | :---: |
| **Raw Batch Status** | `Tested (1)` | `Tested (1)` | PASSED |
| **Processed Batch Status** | `Transferred (3)` | `Transferred (3)` | PASSED |
| **Processed Batch Owner** | `0x2999b14C8B373Aea1bAaC0e2879fc497a479F761` | `0x2999b14C8B373Aea1bAaC0e2879fc497a479F761` | PASSED |
| **Parent/Child Lineage** | `["SEP-VAL-1790613140808-RAW"]` | `["SEP-VAL-1790613140808-RAW"]` | PASSED |
| **Merkle Root Anchored** | `0xa130de54172185b4393ef8416f89e159faf8ebfc2aa21a66a3f2cfab1f7f0097` | `0xa130de54172185b4393ef8416f89e159faf8ebfc2aa21a66a3f2cfab1f7f0097` | PASSED |

---

## Distinction Between Public Testnet Validation and Controlled Benchmarks

1. **Sepolia Deployment Validation (This Report):**  
   Validates public network compatibility, EVM execution integrity, AccessControl role compliance, real gas usage per transaction on Sepolia, and multi-actor lifecycle correctness. Public testnet block times (12–15s per block) introduce network delay but prove real-world usability.

2. **Controlled Local Performance Benchmarks (Separate Reports):**  
   - **Gas Efficiency Benchmark:** Evaluated locally via Hardhat EVM to eliminate network variance.
   - **Latency Benchmark:** Evaluated under controlled load to measure API and database synchronization overhead.

---

## Conclusion

The on-chain validation of **HerbTrace v3** on Ethereum Sepolia passed all functional assertions with **100% success rate across all 5 state transitions**. The contract demonstrated robust execution of role-restricted actions, lineage linking, and cryptographic Merkle root anchoring.
