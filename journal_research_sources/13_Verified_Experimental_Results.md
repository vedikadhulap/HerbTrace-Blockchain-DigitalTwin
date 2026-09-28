# 13. Verified Experimental Results

## EXISTING VERIFIED RESULTS

### Smart Contract Execution Verification
- **Experiment:** Execution of `anchorMerkleRoot()` and `recordLocationVerification()`.
- **Measurement:** Event emission and state variable updates.
- **Value:** `true` (Tests pass)
- **Environment:** Local Hardhat Network
- **Source file/log/test:** `herbtrace-contracts/test/HerbTraceV2.test.js`
- **Can it be used in a journal paper?** YES (to prove functional correctness)

### Lineage Threading Verification
- **Experiment:** Merkle tree generation across multiple stages and batch changes (processing).
- **Measurement:** Verification of the `chainId` mechanism ensuring 4 stages resolve to 1 root.
- **Value:** `true` (Tests pass)
- **Environment:** Local Node.js / MongoDB
- **Source file/log/test:** `herbtrace-backend/tests/chainId-merkle-e2e.test.js`
- **Can it be used in a journal paper?** YES (to prove architectural correctness of the lineage solution)

## MISSING METRICS

> [!WARNING]
> NO VERIFIED MEASUREMENT FOUND for the following critical metrics:
> 
> - **Gas used / Gas estimates:** No `gasReporter` output or documented transaction receipts containing gas metrics were found in the codebase.
> - **Execution times / API response times:** No verified logging of latency or execution speed exists in the repository.
> - **Testnet transaction hashes:** While Sepolia is configured in `hardhat.config.js`, no actual transaction hashes or logs from a testnet deployment were found in the repository.

**Recommendation for Journal Paper:** You must run the tests with `hardhat-gas-reporter` enabled or deploy to a Testnet to gather verifiable gas usage and latency data before including those numbers in the paper.
