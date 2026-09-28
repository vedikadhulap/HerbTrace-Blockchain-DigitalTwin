### Experiment 5 — Merkle Proof Generation and Tamper Verification Benchmark

#### 5.1 Objective
The objective of Experiment 5 is to evaluate the performance overhead and cryptographic integrity of the Merkle proof verification mechanism implemented in HerbTrace (`herbtrace-backend/services/merkleService.js`). Specifically, this experiment measures the microsecond execution latencies of leaf data generation, tree construction, proof generation, and proof verification across repeated iterations, while evaluating the system's ability to detect data tampering across all four supply chain lifecycle stages.

#### 5.2 Research Question
How efficiently does the fixed 4-stage SHA-256 Merkle tree implementation construct stage proofs and verify authenticity off-chain, and with what detection accuracy does it catch controlled synthetic data tampering?

#### 5.3 Experimental Setup
- **Evaluation Target**: Production Merkle Service (`herbtrace-backend/services/merkleService.js`)
- **Environment**: Node.js runtime environment (Windows environment, high-resolution performance timers `perf_hooks.performance.now()`)
- **Lifecycle Scope**: Fixed 4-stage lifecycle (CREATE, LAB TEST, PROCESS, TRANSFER)
- **Sample Size**: 1000 timing iterations per operation following 50 warmup iterations
- **Tampering Test Cases**: 6 controlled synthetic tampering scenarios

#### 5.4 Merkle Implementation Details
The HerbTrace Merkle implementation operates on a fixed 4-leaf binary tree architecture:
1. **Stage Mapping**: Leaf 0 = CREATE, Leaf 1 = LAB TEST, Leaf 2 = PROCESS, Leaf 3 = TRANSFER. Unfilled stages use deterministic `sha256("EMPTY")` placeholders.
2. **Leaf Hashing**: Stage payload objects are key-sorted deterministically and prefixed by stage name before SHA-256 hashing: `sha256Hex(stageName + ":" + JSON.stringify(stageData))`.
3. **Tree Construction**: A 3-layer bottom-up binary tree where child pairs are lexically sorted before hashing (`hashPair(a, b) = sha256(min(a,b) + max(a,b))`), rendering proof verification order-independent.
4. **Proof Structure**: 2 sibling hashes per stage proof (1 leaf sibling at Layer 0 and 1 parent sibling at Layer 1).
5. **Anchoring**: The 32-byte hex root is stored in MongoDB (`BatchMerkleRoot`) and anchored on-chain via smart contract transaction during the final TRANSFER stage.

#### 5.5 Performance Evaluation
The performance benchmark executed 1000 independent timing iterations for each core Merkle operation. Microsecond timing results are summarized in Table 5.1.

**Table 5.1: Merkle Service Execution Latencies (Milliseconds)**

| Operation | Iterations | Mean (ms) | Median (ms) | Std. Dev. | P95 (ms) | Min (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Leaf Generation | 1000 | 0.03122 | 0.01350 | 0.14041 | 0.04790 | 0.00860 | 2.51370 |
| Tree Construction | 1000 | 0.02483 | 0.01530 | 0.07333 | 0.04660 | 0.00980 | 1.56360 |
| Proof Generation | 1000 | 0.08935 | 0.06265 | 0.12005 | 0.18050 | 0.03450 | 1.60800 |
| Proof Verification | 1000 | 0.02596 | 0.01610 | 0.06682 | 0.04740 | 0.01020 | 1.56030 |

#### 5.6 Tamper Detection Results
Six controlled tampering scenarios were evaluated against original Merkle roots and proof sets. For each scenario, data or hashes were modified while retaining the original reference root and proof parameters. Results are detailed in Table 5.2.

**Table 5.2: Controlled Synthetic Tamper Detection Evaluation**

| Scenario ID | Stage Tested | Synthetic Modification | Expected Result | Verification Result | Tampering Detected |
|---|---|---|---|---|---|
| TAMPER-CREATE | CREATE | Farmer Location tampered from 'Pune, MH' to 'Nagpur, MH' | INVALID | INVALID (REJECTED) | YES ✅ |
| TAMPER-TEST | LAB TEST | Purity percentage modified from 98.7% to 75.0% | INVALID | INVALID (REJECTED) | YES ✅ |
| TAMPER-PROCESS | PROCESS | Yield output inflated from 450kg to 900kg | INVALID | INVALID (REJECTED) | YES ✅ |
| TAMPER-TRANSFER | TRANSFER | Destination owner altered to unauthorized wallet address | INVALID | INVALID (REJECTED) | YES ✅ |
| TAMPER-ROOT-BITFLIP | ROOT HASH | Single bit modified in anchored Merkle root hash | INVALID | INVALID (REJECTED) | YES ✅ |
| TAMPER-PROOF-SIBLING | PROOF SIBLING | Proof sibling hash corrupted by replacing with random hash | INVALID | INVALID (REJECTED) | YES ✅ |

All tested synthetic tampering scenarios were detected (6/6, 100.0% detection rate). In all cases, modifying stage data resulted in a leaf hash mismatch that failed path reconstruction to the original Merkle root.

#### 5.7 Lifecycle Verification Results
In the full 4-stage end-to-end synthetic lifecycle evaluation (CREATE → LAB TEST → PROCESS → TRANSFER), all 4 stage proofs verified successfully against the final calculated Merkle root (`f91b00646ca20664ae39f904cb93167768bcb1a92e9463d3b7f3e9959e2f06b0`).

#### 5.8 Discussion
The benchmark results demonstrate that Merkle operations in HerbTrace impose negligible computational overhead. Mean execution latencies across all operations remain well under 0.1 milliseconds per batch lifecycle, making Merkle proof generation and verification suitable for real-time API responses and high-throughput batch auditing.

#### 5.9 Limitations
This experiment evaluates off-chain cryptographic integrity and tamper detection under controlled synthetic scenarios. It does not evaluate on-chain transaction execution costs (which are evaluated separately in the Gas Benchmark), nor does it guarantee universal system security against external threats such as compromised private keys or compromised oracle infrastructure.

#### 5.10 Reproducibility Instructions
To re-run the benchmark and verify all reported statistics:
```bash
node journal_experiments/merkle/merkle_benchmark.js
```
