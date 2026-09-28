# HerbTrace Gas Consumption Benchmark Report

## 1. Experiment Objective
Measure actual gas consumption of the current HerbTrace smart contract and compare it against a controlled baseline architecture that anchors one Merkle root after every lifecycle stage.

## 2. Research Question Addressed
What is the measured gas difference between anchoring Merkle roots at every stage (baseline) versus anchoring once at the final stage (current design)?

## 3. Experimental Environment
- **Network**: Hardhat Local Network
- **Contract**: `HerbTrace.sol`
- **Timestamp**: 2026-09-21T20:05:32.496Z

## 4. Smart Contract Functions Tested
- `createBatch`
- `recordTest`
- `processBatch`
- `transferCustody`
- `anchorMerkleRoot`
- `recordLocationVerification` (benchmarked separately)

## 5. Benchmark Procedure
The benchmark executed 10 independent valid batch lifecycles. A fresh contract was deployed, roles were granted, and operations were called sequentially using synthetic deterministic data. The actual `gasUsed` was recorded from transaction receipts.

## 6. Sample Size
- **Iterations per function**: 10

## 7. Statistical Summary & Raw Gas Measurements
| Function | Min Gas | Max Gas | Mean Gas | Median Gas | Std Dev |
|---|---|---|---|---|---|
| `createBatch` | 119061 | 119073 | 119070.60 | 119073 | 4.80 |
| `recordTest` | 44723 | 44735 | 44732.60 | 44735 | 4.80 |
| `processBatch` | 166899 | 166911 | 166908.60 | 166911 | 4.80 |
| `transferCustody` | 46055 | 46067 | 46064.60 | 46067 | 4.80 |
| `anchorMerkleRoot` | 143113 | 143125 | 143123.80 | 143125 | 3.60 |
| `recordLocationVerification` | 168072 | 168072 | 168072.00 | 168072 | 0.00 |

## 8. Controlled Baseline Definition
Controlled baseline architecture in which a Merkle root is anchored on-chain after each of the four lifecycle stages. Constructed analytically as 4 × measured anchor gas.

## 9. Current Design Definition
The current HerbTrace design where the four lifecycle stages are represented in one Merkle structure and the completed root is anchored at the final transfer stage (1 × measured anchor gas).

## 10. Baseline vs Current Comparison
- **Baseline Anchor Transactions**: 4
- **Current Anchor Transactions**: 1
- **Baseline Total Gas**: 949271.60
- **Current Total Gas**: 519900.20
- **Absolute Gas Difference**: 429371.40
- **Percentage Difference**: 45.23%

## 11. Interpretation of Results
The controlled baseline required 4 anchor transactions, whereas the current design required 1 anchor transaction, resulting in a measured difference of 429371.40 gas under the benchmark conditions. This represents a 45.23% reduction in gas consumption for the overall lifecycle compared to the analytical baseline.

## 12. Threats to Validity
- The baseline is constructed analytically (multiplying the cost of `anchorMerkleRoot` by 4) rather than executing a distinct smart contract variant.
- Benchmark data is synthetic and string sizes (e.g., batch IDs, location strings) may slightly influence gas costs in a real-world scenario.
- Network base fee and priority fee fluctuations are not captured since testing occurred on a local Hardhat network.

## 13. Reproducibility Instructions
1. Navigate to `herbtrace-contracts`
2. Run `npx hardhat test test/Benchmark.gas.test.js`
3. Review the outputs in `journal_experiments/gas/`
